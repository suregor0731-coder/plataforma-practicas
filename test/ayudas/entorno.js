'use strict';

/**
 * Entorno de las pruebas de integración: base PostgreSQL real (DATABASE_URL_TEST), la aplicación
 * Express completa escuchando en un puerto libre, un notificador en memoria y un reloj que cada
 * prueba puede mover. Las peticiones se hacen por HTTP con fetch, igual que lo haría el frontend.
 */

const { cargarConfig } = require('../../server/config');
const { crearPool } = require('../../server/db/pool');
const { migrar } = require('../../server/db/migraciones');
const { sembrar, CLAVE_DEMO } = require('../../server/db/semilla');
const { crearApp } = require('../../server/app');
const { crearNotificadorEnMemoria } = require('../../server/integrations/correo');
const { crearLimitador } = require('../../server/utils/limitador');
const { crearPdfMinimo } = require('../../server/utils/pdfMinimo');

const HOY = '2026-11-09';
const AHORA = new Date('2026-11-09T15:00:00Z'); // 10:00 a. m. en Bogotá

// Cuentas que crea la semilla (todas con la contraseña CLAVE_DEMO)
const CUENTAS = {
  coordinacion: 'coordinacion@practicas.demo',
  camila: 'camila.restrepo@practicas.demo',
  julian: 'julian.ospina@practicas.demo',
  valentina: 'valentina.cardona@practicas.demo',
  mateo: 'mateo.herrera@practicas.demo',
  laura: 'laura.perez@practicas.demo',
  sebastian: 'sebastian.giraldo@practicas.demo',
  nodo: 'rrhh@nododigital.demo', // convenio vigente
  andina: 'talento@logisticaandina.demo', // convenio por vencer
  valle: 'gestion@estudiovalle.demo', // convenio vencido
  horizonte: 'personal@clinicahorizonte.demo', // sin convenio
};

function urlDePruebas() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('Defina DATABASE_URL_TEST con la base de datos de pruebas (vea .env.example).');
  }
  // La base se borra y se recrea en cada corrida: se evita apuntar por error a la base de desarrollo
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error('DATABASE_URL_TEST debe apuntar a una base cuyo nombre contenga "test".');
  }
  return url;
}

const pdfBase64 = (...lineas) => crearPdfMinimo(lineas.length > 0 ? lineas : ['Hoja de vida de prueba']).toString('base64');

const cuerpoPostulacion = (cambios = {}) => ({
  carta_presentacion: 'Me interesa la oferta y cumplo con los requisitos publicados.',
  acepta_datos: true,
  hoja_vida: { nombre: 'hoja-de-vida.pdf', contenido_base64: pdfBase64() },
  ...cambios,
});

const cuerpoOferta = (cambios = {}) => ({
  titulo: 'Practicante de integración de sistemas',
  descripcion: 'Apoyará la integración de servicios internos y la documentación de las interfaces expuestas.',
  requisitos: 'Semestre 8 o superior.',
  cupos: 1,
  ciudad: 'Medellín',
  modalidad: 'hibrida',
  ...cambios,
});

/**
 * Reinicia la base de pruebas (migraciones + datos de demostración), levanta la aplicación y
 * devuelve las herramientas para consultarla. "errores" acumula lo que el servidor registró como
 * error inesperado; cada archivo de pruebas comprueba al final que siga vacío.
 */
async function crearEntorno({ sembrarDatos = true } = {}) {
  const pool = crearPool(urlDePruebas(), { max: 10 });
  await migrar(pool, { reiniciar: true });
  if (sembrarDatos) await sembrar(pool, { hoy: HOY, ahora: AHORA });

  const notificador = crearNotificadorEnMemoria();
  const errores = [];
  const reloj = { ahora: AHORA };
  const config = cargarConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'secreto-de-pruebas-de-integracion-0123456789',
    LOG_PETICIONES: '0',
  });
  const { app } = crearApp({
    config,
    pool,
    notificador,
    reloj: () => reloj.ahora,
    registrar: (...partes) => errores.push(partes.join(' ')),
    limitador: crearLimitador(),
  });

  const servidor = await new Promise((resolver, rechazar) => {
    const escuchando = app.listen(0, '127.0.0.1', () => resolver(escuchando));
    escuchando.once('error', rechazar);
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  /** Hace la petición y devuelve { estado, datos, cabeceras }; "datos" es JSON o, si no lo es, un Buffer. */
  async function pedir(metodo, ruta, { token, cuerpo, cabeceras = {} } = {}) {
    const respuesta = await fetch(`${base}/api/v1${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...cabeceras,
      },
      body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    });
    const tipo = respuesta.headers.get('content-type') || '';
    const datos = tipo.includes('application/json') ? await respuesta.json() : Buffer.from(await respuesta.arrayBuffer());
    return { estado: respuesta.status, datos, cabeceras: respuesta.headers };
  }

  async function ingresar(correo, contrasena = CLAVE_DEMO) {
    const { estado, datos } = await pedir('POST', '/auth/login', { cuerpo: { correo, contrasena } });
    if (estado !== 200) throw new Error(`No se pudo ingresar como ${correo}: ${estado} ${JSON.stringify(datos)}`);
    return datos.token;
  }

  async function cerrar() {
    await new Promise((resolver) => {
      servidor.close(resolver);
      if (servidor.closeAllConnections) servidor.closeAllConnections();
    });
    await pool.end();
  }

  return {
    base,
    pool,
    consulta: (sql, parametros) => pool.query(sql, parametros),
    pedir,
    ingresar,
    cerrar,
    notificador,
    reloj,
    errores,
  };
}

module.exports = { HOY, AHORA, CUENTAS, CLAVE_DEMO, crearEntorno, cuerpoPostulacion, cuerpoOferta, pdfBase64 };
