'use strict';

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const { hashear } = require('../../server/utils/hash');
const { verificar } = require('../../server/utils/jwt');
const {
  CONFIG,
  AHORA,
  ESTUDIANTE,
  EMPRESA,
  OTRA_EMPRESA,
  OFERTA_BASE,
  CONVENIO_VIGENTE,
  falla,
  crearMundo,
} = require('../ayudas/mundo-falso');

const CLAVE = 'Clave2026x';
let hash;

before(async () => {
  hash = await hashear(CLAVE);
});

const cuenta = (cambios = {}) => ({
  id_usuario: 5,
  correo: 'camila@practicas.demo',
  hash_contrasena: hash,
  rol: 'estudiante',
  estado: 'activo',
  nombre: 'Camila Restrepo Gómez',
  id_estudiante: 3,
  id_empresa: null,
  id_docente: null,
  ...cambios,
});

const registroEstudiante = (cambios = {}) => ({
  nombre: 'Laura Torres Pérez',
  documento: '1000999999',
  correo: 'laura.nueva@practicas.demo',
  contrasena: CLAVE,
  id_programa: 1,
  semestre: 8,
  acepta_datos: true,
  ...cambios,
});

const ofertaNueva = (cambios = {}) => ({
  titulo: 'Practicante de soporte técnico',
  descripcion: 'Atenderá solicitudes de soporte de primer nivel y documentará las soluciones aplicadas.',
  cupos: 1,
  ciudad: 'Cali',
  modalidad: 'presencial',
  ...cambios,
});

const duplicado = (constraint) => Object.assign(new Error('llave duplicada'), { code: '23505', constraint });

describe('Servicio de cuentas', () => {
  test('PU-66 un ingreso correcto entrega un token válido y un perfil sin estado ni contraseña', async () => {
    const mundo = crearMundo({ usuarios: [cuenta()] });
    const sesion = await mundo.servicios.auth.iniciarSesion({ correo: 'Camila@Practicas.demo', contrasena: CLAVE }, '10.0.0.1');

    const carga = verificar(sesion.token, CONFIG.jwt.secreto, { ahora: AHORA.getTime() });
    assert.equal(carga.sub, 5);
    assert.equal(carga.rol, 'estudiante');
    assert.deepEqual(Object.keys(sesion.usuario).sort(), [
      'correo',
      'id_docente',
      'id_empresa',
      'id_estudiante',
      'id_usuario',
      'nombre',
      'rol',
    ]);
  });

  test('PU-67 correo desconocido, contraseña errónea y cuenta inactiva reciben exactamente el mismo error', async () => {
    const mundo = crearMundo({ usuarios: [cuenta(), cuenta({ id_usuario: 6, correo: 'inactiva@practicas.demo', estado: 'inactivo' })] });
    const intentos = [
      { correo: 'nadie@practicas.demo', contrasena: CLAVE },
      { correo: 'camila@practicas.demo', contrasena: 'OtraClave123' },
      { correo: 'inactiva@practicas.demo', contrasena: CLAVE },
    ];
    const errores = [];
    for (const intento of intentos) {
      await assert.rejects(mundo.servicios.auth.iniciarSesion(intento, '10.0.0.1'), (error) => {
        errores.push([error.estado, error.codigo, error.message]);
        return true;
      });
    }
    assert.deepEqual(errores[0], [401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.']);
    assert.deepEqual(errores[1], errores[0]);
    assert.deepEqual(errores[2], errores[0]);
  });

  test('PU-68 después de 5 intentos fallidos el ingreso se bloquea con 429, aunque la clave sea la correcta', async () => {
    const mundo = crearMundo({ usuarios: [cuenta()] });
    const mal = { correo: 'camila@practicas.demo', contrasena: 'OtraClave123' };
    for (let i = 0; i < 5; i += 1) {
      await assert.rejects(mundo.servicios.auth.iniciarSesion(mal, '10.0.0.1'), falla(401, 'CREDENCIALES_INVALIDAS'));
    }
    const bien = { correo: 'camila@practicas.demo', contrasena: CLAVE };
    await assert.rejects(mundo.servicios.auth.iniciarSesion(bien, '10.0.0.1'), falla(429, 'DEMASIADOS_INTENTOS'));
    // El bloqueo es por origen y correo: desde otra IP sí se puede ingresar
    const otraOrigen = await mundo.servicios.auth.iniciarSesion(bien, '10.0.0.2');
    assert.ok(otraOrigen.token);
  });

  test('PU-69 el registro traduce los duplicados de correo, documento y NIT y valida que el programa exista', async () => {
    const casos = [
      ['estudiante', 'usuario_correo_institucional_key', 'CORREO_DUPLICADO'],
      ['estudiante', 'estudiante_documento_key', 'DOCUMENTO_DUPLICADO'],
      ['empresa', 'empresa_nit_key', 'NIT_DUPLICADO'],
    ];
    for (const [tipo, restriccion, codigo] of casos) {
      const mundo = crearMundo();
      mundo.estado.fallarRegistro = duplicado(restriccion);
      const intento =
        tipo === 'estudiante'
          ? mundo.servicios.auth.registrarEstudiante(registroEstudiante())
          : mundo.servicios.auth.registrarEmpresa({
              nombre: 'Nodo Digital S.A.S.',
              nit: '900123456-7',
              sector: 'Tecnología',
              correo: 'rrhh@nodo.demo',
              contrasena: CLAVE,
              acepta_datos: true,
            });
      await assert.rejects(intento, falla(409, codigo));
    }

    const mundo = crearMundo();
    await assert.rejects(
      mundo.servicios.auth.registrarEstudiante(registroEstudiante({ id_programa: 99 })),
      (error) => error.estado === 422 && Boolean(error.detalles.id_programa)
    );
    assert.deepEqual(mundo.estado.escrituras, []);
  });

  test('PU-70 un registro válido guarda la contraseña como hash y abre sesión', async () => {
    const mundo = crearMundo();
    const sesion = await mundo.servicios.auth.registrarEstudiante(registroEstudiante());
    assert.equal(sesion.usuario.rol, 'estudiante');
    assert.equal(sesion.usuario.correo, 'laura.nueva@practicas.demo');
    const guardada = mundo.estado.usuarios.find((u) => u.correo === 'laura.nueva@practicas.demo');
    assert.notEqual(guardada.hash_contrasena, CLAVE);
    assert.match(guardada.hash_contrasena, /^scrypt\$/);
  });
});

describe('Servicio de ofertas y panel de Coordinación', () => {
  test('PU-71 solo las empresas publican ofertas; la oferta nace abierta, con la fecha de hoy y a nombre de la empresa', async () => {
    const mundo = crearMundo();
    await assert.rejects(mundo.servicios.ofertas.publicar(ESTUDIANTE, ofertaNueva()), falla(403, 'PROHIBIDO'));

    const creada = await mundo.servicios.ofertas.publicar(EMPRESA, ofertaNueva());
    assert.equal(creada.id_empresa, EMPRESA.id_empresa);
    assert.equal(creada.estado, 'abierta');
    assert.equal(creada.fecha_publicacion, '2026-11-09');
  });

  test('PU-72 una oferta sin cupos no puede reabrirse y solo su empresa la cierra', async () => {
    const aprobada = { id_postulacion: 50, id_estudiante: 9, id_oferta: 1, estado_postulacion: 'aprobada' };
    const mundo = crearMundo({ ofertas: [{ ...OFERTA_BASE, cupos: 1, estado: 'cerrada' }], postulaciones: [aprobada] });
    const { cambiarEstado } = mundo.servicios.ofertas;

    await assert.rejects(cambiarEstado(EMPRESA, 1, { estado: 'abierta' }), falla(409, 'SIN_CUPOS'));
    await assert.rejects(cambiarEstado(OTRA_EMPRESA, 1, { estado: 'cerrada' }), falla(403, 'PROHIBIDO'));
    await assert.rejects(cambiarEstado(EMPRESA, 1, { estado: 'archivada' }), (error) => error.estado === 422);
    assert.equal(mundo.estado.ofertas.get(1).estado, 'cerrada');
  });

  test('PU-73 el panel cuenta pendientes y aprobadas, resume los convenios y ofrece solo las acciones que proceden', async () => {
    const ofertas = [
      OFERTA_BASE,
      { ...OFERTA_BASE, id_oferta: 2, id_empresa: 12, titulo: 'Practicante de diseño' },
    ];
    const convenios = [
      CONVENIO_VIGENTE, // empresa 10: vigente
      { ...CONVENIO_VIGENTE, id_convenio: 2, id_empresa: 11, fecha_fin: '2026-11-27' }, // por vencer
      { ...CONVENIO_VIGENTE, id_convenio: 3, id_empresa: 12, fecha_fin: '2026-10-01' }, // vencido
      // la empresa 13 no tiene convenio
    ];
    const postulaciones = [
      { id_postulacion: 1, id_estudiante: 3, id_oferta: 1, estado_postulacion: 'preseleccionada' },
      { id_postulacion: 2, id_estudiante: 4, id_oferta: 2, estado_postulacion: 'preseleccionada' },
      { id_postulacion: 3, id_estudiante: 9, id_oferta: 1, estado_postulacion: 'aprobada' },
      { id_postulacion: 4, id_estudiante: 77, id_oferta: 1, estado_postulacion: 'enviada' },
    ];
    const mundo = crearMundo({ ofertas, convenios, postulaciones });
    const panel = await mundo.servicios.coordinacion.panel({});

    assert.deepEqual(panel.filtro.estados, ['preseleccionada', 'devuelta']);
    assert.equal(panel.resumen.pendientes, 2);
    assert.equal(panel.resumen.aprobadas, 1);
    assert.deepEqual(panel.resumen.convenios, { vigentes: 1, por_vencer: 1, sin_vigencia: 2 });
    assert.equal(panel.paginacion.total, 2);

    const acciones = Object.fromEntries(panel.datos.map((fila) => [fila.id_postulacion, fila.acciones]));
    assert.deepEqual(acciones[1], ['aprobar', 'rechazar']); // convenio vigente
    assert.deepEqual(acciones[2], ['rechazar', 'devolver']); // convenio vencido
    assert.equal('total' in panel.datos[0], false);
  });
});
