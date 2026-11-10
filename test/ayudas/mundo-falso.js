'use strict';

/**
 * Entorno para las pruebas unitarias de los servicios: repositorios que guardan todo en memoria,
 * un reloj fijo y una bandeja de correos. No toca la base de datos, así que cada prueba arma
 * exactamente el escenario que necesita y puede comprobar también lo que NO se escribió.
 */

const { crearServicios } = require('../../server/services');
const { crearNotificadorEnMemoria } = require('../../server/integrations/correo');
const { crearPdfMinimo } = require('../../server/utils/pdfMinimo');

const HOY = '2026-11-09';
const AHORA = new Date('2026-11-09T15:00:00Z'); // 10:00 a. m. en Bogotá

const CONFIG = {
  jwt: { secreto: 'secreto-de-prueba-con-mas-de-16-caracteres', expiraSegundos: 7200 },
  hojaVida: { maxBytes: 2 * 1024 * 1024 },
};

// Quien hace cada petición, tal como lo deja el middleware de autenticación
const ESTUDIANTE = { id_usuario: 5, rol: 'estudiante', id_estudiante: 3 };
const OTRO_ESTUDIANTE = { id_usuario: 77, rol: 'estudiante', id_estudiante: 77 };
const EMPRESA = { id_usuario: 6, rol: 'empresa', id_empresa: 10 };
const OTRA_EMPRESA = { id_usuario: 7, rol: 'empresa', id_empresa: 11 };
const COORDINACION = { id_usuario: 1, rol: 'coordinacion' };

const EMPRESAS = {
  10: { nombre: 'Nodo Digital S.A.S.', correo: 'rrhh@nodo.demo' },
  11: { nombre: 'Logística Andina Ltda.', correo: 'talento@logisticaandina.demo' },
  12: { nombre: 'Estudio Creativo Valle S.A.S.', correo: 'equipo@creativovalle.demo' },
  13: { nombre: 'Clínica Horizonte S.A.', correo: 'practicas@horizonte.demo' },
};

const ESTUDIANTES = {
  3: { id_usuario: 5, nombre: 'Camila Restrepo Gómez', correo: 'camila@practicas.demo' },
  4: { id_usuario: 8, nombre: 'Julián Ortega Ruiz', correo: 'julian@practicas.demo' },
  9: { id_usuario: 9, nombre: 'Laura Torres Pérez', correo: 'laura@practicas.demo' },
};

const OFERTA_BASE = {
  id_oferta: 1,
  id_empresa: 10,
  titulo: 'Practicante de desarrollo web',
  estado: 'abierta',
  cupos: 2,
  fecha_cierre: '2026-12-15',
  fecha_publicacion: '2026-11-01',
};

const CONVENIO_VIGENTE = {
  id_convenio: 1,
  id_empresa: 10,
  estado: 'vigente',
  fecha_inicio: '2026-01-01',
  fecha_fin: '2027-06-30',
};

const PDF = crearPdfMinimo(['Hoja de vida de prueba']);

const cuerpoPostulacion = (cambios = {}) => ({
  carta_presentacion: 'Me interesa esta práctica por su enfoque en desarrollo web.',
  acepta_datos: true,
  hoja_vida: { nombre: 'cv-camila.pdf', contenido_base64: PDF.toString('base64') },
  ...cambios,
});

/** Devuelve un validador para assert.rejects/throws que comprueba el estado HTTP y el código de negocio. */
const falla = (estado, codigo) => (error) => error.estado === estado && error.codigo === codigo;

function crearRepos(estado) {
  const aprobadasDe = (idOferta) =>
    [...estado.postulaciones.values()].filter((p) => p.id_oferta === idOferta && p.estado_postulacion === 'aprobada')
      .length;
  const anotar = (...entrada) => estado.escrituras.push(entrada);

  const unirPostulacion = (p) => {
    const oferta = estado.ofertas.get(p.id_oferta);
    const empresa = EMPRESAS[oferta.id_empresa];
    const alumno = ESTUDIANTES[p.id_estudiante] || {
      nombre: `Estudiante ${p.id_estudiante}`,
      correo: `estudiante${p.id_estudiante}@practicas.demo`,
    };
    return {
      ...p,
      id_empresa: oferta.id_empresa,
      oferta_titulo: oferta.titulo,
      empresa_nombre: empresa.nombre,
      empresa_correo: empresa.correo,
      estudiante_nombre: alumno.nombre,
      estudiante_correo: alumno.correo,
      estudiante_semestre: 9,
      estudiante_programa: 'Ingeniería de Software',
    };
  };

  return {
    catalogo: {
      existePrograma: async (_db, id) => id === 1,
      listarProgramas: async () => [{ id_programa: 1, nombre: 'Ingeniería de Software' }],
    },

    oferta: {
      detalle: async (_db, id) => {
        const oferta = estado.ofertas.get(id);
        if (!oferta) return undefined;
        return { ...oferta, empresa_nombre: EMPRESAS[oferta.id_empresa].nombre, aprobadas: aprobadasDe(id) };
      },
      bloquear: async () => true,
      cambiarEstado: async (_db, id, nuevo) => {
        anotar('oferta.cambiarEstado', id, nuevo);
        estado.ofertas.get(id).estado = nuevo;
      },
      insertar: async (_db, datos) => {
        anotar('oferta.insertar', datos.titulo);
        const id = estado.siguienteOferta++;
        estado.ofertas.set(id, { ...datos, id_oferta: id, estado: 'abierta' });
        return { id_oferta: id };
      },
      listarDeEmpresa: async () => [],
    },

    postulacion: {
      insertar: async (_db, datos) => {
        if (estado.fallarInsercion) throw estado.fallarInsercion;
        anotar('postulacion.insertar', datos.idEstudiante, datos.idOferta);
        const id = estado.siguientePostulacion++;
        estado.postulaciones.set(id, {
          id_postulacion: id,
          id_estudiante: datos.idEstudiante,
          id_oferta: datos.idOferta,
          estado_postulacion: 'enviada',
          carta_presentacion: datos.carta,
          hoja_vida: datos.hojaVida,
          hoja_vida_nombre: datos.hojaVidaNombre,
        });
        return { id_postulacion: id };
      },
      buscarPorId: async (_db, id) => {
        const p = estado.postulaciones.get(id);
        return p ? unirPostulacion(p) : undefined;
      },
      buscarPorEstudianteYOferta: async (_db, idEstudiante, idOferta) => {
        const p = [...estado.postulaciones.values()].find(
          (x) => x.id_estudiante === idEstudiante && x.id_oferta === idOferta
        );
        return p ? { id_postulacion: p.id_postulacion, estado_postulacion: p.estado_postulacion } : undefined;
      },
      actualizarEstado: async (_db, id, nuevo) => {
        anotar('postulacion.actualizarEstado', id, nuevo);
        estado.postulaciones.get(id).estado_postulacion = nuevo;
      },
      actualizarDecision: async (_db, id, { estado: nuevo, observacion, idUsuario }) => {
        anotar('postulacion.actualizarDecision', id, nuevo);
        Object.assign(estado.postulaciones.get(id), {
          estado_postulacion: nuevo,
          observacion_decision: observacion,
          id_usuario_decision: idUsuario,
        });
      },
      obtenerHojaVida: async (_db, id) => {
        const p = estado.postulaciones.get(id);
        if (!p) return undefined;
        return {
          hoja_vida: p.hoja_vida,
          hoja_vida_nombre: p.hoja_vida_nombre,
          usuario_estudiante: (ESTUDIANTES[p.id_estudiante] || { id_usuario: p.id_estudiante }).id_usuario,
          id_empresa: estado.ofertas.get(p.id_oferta).id_empresa,
        };
      },
      listarDeOferta: async (_db, idOferta) =>
        [...estado.postulaciones.values()]
          .filter((p) => p.id_oferta === idOferta)
          .map((p) => ({ id_postulacion: p.id_postulacion, estado_postulacion: p.estado_postulacion })),
      listarDeEstudiante: async () => [],
      listarPorEstados: async (_db, estados, { limite, desplazamiento }) => {
        const filas = [...estado.postulaciones.values()].filter((p) => estados.includes(p.estado_postulacion));
        return filas.slice(desplazamiento, desplazamiento + limite).map((p) => ({ ...unirPostulacion(p), total: filas.length }));
      },
      contarPorEstado: async () => {
        const conteo = {};
        for (const p of estado.postulaciones.values()) conteo[p.estado_postulacion] = (conteo[p.estado_postulacion] || 0) + 1;
        return conteo;
      },
    },

    convenio: {
      listarPorEmpresa: async (_db, idEmpresa) => estado.convenios.filter((c) => c.id_empresa === idEmpresa),
      listarTodos: async () => estado.convenios,
    },

    usuario: {
      listarCorreosPorRol: async (_db, rol) => (rol === 'coordinacion' ? estado.correosCoordinacion : []),
      listarEmpresas: async () => Object.entries(EMPRESAS).map(([id, e]) => ({ id_empresa: Number(id), nombre: e.nombre })),
      buscarPorCorreo: async (_db, correo) => {
        const cuenta = estado.usuarios.find((u) => u.correo === correo);
        return cuenta
          ? {
              id_usuario: cuenta.id_usuario,
              correo_institucional: cuenta.correo,
              hash_contrasena: cuenta.hash_contrasena,
              rol: cuenta.rol,
              estado: cuenta.estado,
            }
          : undefined;
      },
      obtenerPerfil: async (_db, id) => {
        const cuenta = estado.usuarios.find((u) => u.id_usuario === id);
        if (!cuenta) return undefined;
        const { hash_contrasena: _oculto, ...perfil } = cuenta; // eslint-disable-line no-unused-vars
        return perfil;
      },
      insertarUsuario: async (_db, datos) => {
        if (estado.fallarRegistro) throw estado.fallarRegistro;
        anotar('usuario.insertar', datos.correo);
        const id = estado.siguienteUsuario++;
        estado.usuarios.push({
          id_usuario: id,
          correo: datos.correo,
          hash_contrasena: datos.hash,
          rol: datos.rol,
          estado: 'activo',
          nombre: null,
          id_estudiante: null,
          id_empresa: null,
          id_docente: null,
        });
        return { id_usuario: id, correo_institucional: datos.correo, rol: datos.rol };
      },
      insertarEstudiante: async (_db, datos) => {
        const cuenta = estado.usuarios.find((u) => u.id_usuario === datos.idUsuario);
        Object.assign(cuenta, { nombre: datos.nombre, id_estudiante: datos.idUsuario });
        return { id_estudiante: datos.idUsuario };
      },
      insertarEmpresa: async (_db, datos) => {
        const cuenta = estado.usuarios.find((u) => u.id_usuario === datos.idUsuario);
        Object.assign(cuenta, { nombre: datos.nombre, id_empresa: datos.idUsuario });
        return { id_empresa: datos.idUsuario };
      },
    },
  };
}

/**
 * Arma los servicios sobre repositorios en memoria. Opciones:
 *   ofertas, postulaciones, convenios, usuarios, correosCoordinacion → datos iniciales
 *   notificador → reemplaza la bandeja en memoria (p. ej. uno que falla)
 *   limitador → limitador de intentos de ingreso
 * Devuelve { servicios, estado, bandeja }; "estado.escrituras" lista lo que se guardó y
 * "estado.registros" lo que el servicio anotó en el registro de errores.
 */
function crearMundo(opciones = {}) {
  const estado = {
    ofertas: new Map(),
    postulaciones: new Map(),
    convenios: opciones.convenios || [CONVENIO_VIGENTE],
    usuarios: opciones.usuarios || [],
    correosCoordinacion: opciones.correosCoordinacion || ['coordinacion@practicas.demo'],
    escrituras: [],
    registros: [],
    fallarInsercion: null,
    fallarRegistro: null,
    siguienteOferta: 100,
    siguientePostulacion: 100,
    siguienteUsuario: 200,
  };
  for (const oferta of opciones.ofertas || [OFERTA_BASE]) estado.ofertas.set(oferta.id_oferta, { ...oferta });
  for (const p of opciones.postulaciones || []) {
    estado.postulaciones.set(p.id_postulacion, { hoja_vida: PDF, hoja_vida_nombre: 'cv.pdf', ...p });
  }

  const notificador = opciones.notificador || crearNotificadorEnMemoria();
  const servicios = crearServicios({
    config: CONFIG,
    pool: { query: async () => ({ rows: [] }) },
    transaccion: (trabajo) => trabajo({}),
    repos: crearRepos(estado),
    notificador,
    reloj: () => AHORA,
    limitador: opciones.limitador,
    registrar: (...argumentos) => estado.registros.push(argumentos),
  });
  return { servicios, estado, bandeja: notificador.bandeja };
}

module.exports = {
  HOY,
  AHORA,
  CONFIG,
  ESTUDIANTE,
  OTRO_ESTUDIANTE,
  EMPRESA,
  OTRA_EMPRESA,
  COORDINACION,
  OFERTA_BASE,
  CONVENIO_VIGENTE,
  cuerpoPostulacion,
  falla,
  crearMundo,
};
