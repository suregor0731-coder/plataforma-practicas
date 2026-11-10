'use strict';

const { exigir, validarRegistroEstudiante, validarRegistroEmpresa, validarLogin } = require('../utils/validadores');
const { hashear, verificarClave } = require('../utils/hash');
const { firmar } = require('../utils/jwt');
const { ErrorApp, noAutenticado, invalido, conflicto } = require('../utils/errores');
const { esUnica } = require('../utils/pgErrores');

/** Convierte una violación de UNIQUE en el conflicto que debe ver el usuario. */
function traducirDuplicado(error) {
  if (!esUnica(error)) return error;
  if (esUnica(error, 'correo')) return conflicto('CORREO_DUPLICADO', 'Ya existe una cuenta registrada con ese correo.');
  if (esUnica(error, 'documento')) return conflicto('DOCUMENTO_DUPLICADO', 'Ya existe un estudiante registrado con ese documento.');
  if (esUnica(error, 'nit')) return conflicto('NIT_DUPLICADO', 'Ya existe una empresa registrada con ese NIT.');
  return conflicto('REGISTRO_DUPLICADO', 'Ya existe un registro con esos datos.');
}

function crearAuthService({ config, pool, transaccion, repos, reloj, limitador }) {
  let hashFicticio;

  // Si el correo no existe se verifica igual contra un hash falso, para que el tiempo de
  // respuesta no permita descubrir qué correos están registrados.
  async function obtenerHashFicticio() {
    if (!hashFicticio) hashFicticio = await hashear('una-clave-que-nadie-usa-1');
    return hashFicticio;
  }

  async function abrirSesion(idUsuario) {
    const perfil = await repos.usuario.obtenerPerfil(pool, idUsuario);
    const token = firmar({ sub: idUsuario, rol: perfil.rol }, config.jwt.secreto, {
      expiraSegundos: config.jwt.expiraSegundos,
      ahora: reloj().getTime(),
    });
    const usuario = { ...perfil };
    delete usuario.estado;
    return { token, usuario };
  }

  async function registrarEstudiante(cuerpo) {
    const datos = exigir(validarRegistroEstudiante(cuerpo));
    if (!(await repos.catalogo.existePrograma(pool, datos.id_programa))) {
      throw invalido({ id_programa: 'El programa seleccionado no existe.' });
    }
    const hash = await hashear(datos.contrasena);
    let idUsuario;
    try {
      idUsuario = await transaccion(async (db) => {
        const usuario = await repos.usuario.insertarUsuario(db, {
          correo: datos.correo,
          hash,
          rol: 'estudiante',
          consentimiento: true,
        });
        await repos.usuario.insertarEstudiante(db, {
          idUsuario: usuario.id_usuario,
          idPrograma: datos.id_programa,
          nombre: datos.nombre,
          documento: datos.documento,
          semestre: datos.semestre,
        });
        return usuario.id_usuario;
      });
    } catch (error) {
      throw traducirDuplicado(error);
    }
    return abrirSesion(idUsuario);
  }

  async function registrarEmpresa(cuerpo) {
    const datos = exigir(validarRegistroEmpresa(cuerpo));
    const hash = await hashear(datos.contrasena);
    let idUsuario;
    try {
      idUsuario = await transaccion(async (db) => {
        const usuario = await repos.usuario.insertarUsuario(db, {
          correo: datos.correo,
          hash,
          rol: 'empresa',
          consentimiento: true,
        });
        await repos.usuario.insertarEmpresa(db, {
          idUsuario: usuario.id_usuario,
          nombre: datos.nombre,
          nit: datos.nit,
          sector: datos.sector,
          correoContacto: datos.correo,
        });
        return usuario.id_usuario;
      });
    } catch (error) {
      throw traducirDuplicado(error);
    }
    return abrirSesion(idUsuario);
  }

  /** "origen" identifica de dónde llega el intento (la IP); junto con el correo forma la clave del limitador. */
  async function iniciarSesion(cuerpo, origen = 'desconocido') {
    const datos = exigir(validarLogin(cuerpo));
    const clave = `${origen}|${datos.correo}`;
    if (limitador.bloqueado(clave)) {
      throw new ErrorApp(
        429,
        'DEMASIADOS_INTENTOS',
        `Demasiados intentos fallidos. Intente de nuevo en ${limitador.minutosRestantes(clave)} minuto(s).`
      );
    }
    const usuario = await repos.usuario.buscarPorCorreo(pool, datos.correo);
    const coincide = await verificarClave(datos.contrasena, usuario ? usuario.hash_contrasena : await obtenerHashFicticio());
    if (!usuario || !coincide || usuario.estado !== 'activo') {
      limitador.registrarFallo(clave);
      // El mensaje es el mismo en los tres casos para no revelar si el correo existe
      throw noAutenticado('Correo o contraseña incorrectos.', 'CREDENCIALES_INVALIDAS');
    }
    limitador.limpiar(clave);
    return abrirSesion(usuario.id_usuario);
  }

  /** Perfil de la cuenta para el middleware de autenticación (incluye el estado para poder rechazar cuentas inactivas). */
  function obtenerSesion(idUsuario) {
    return repos.usuario.obtenerPerfil(pool, idUsuario);
  }

  return { registrarEstudiante, registrarEmpresa, iniciarSesion, obtenerSesion };
}

module.exports = { crearAuthService, traducirDuplicado };
