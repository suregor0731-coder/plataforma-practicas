/**
 * Recorrido E2E del flujo crítico, con un navegador real (Playwright + Chromium):
 *
 *   registro de un estudiante → búsqueda y postulación con hoja de vida en PDF → preselección de la
 *   empresa → aprobación de Coordinación con convenio vigente → bloqueo por convenio vencido.
 *
 * Reinicia la base de pruebas (DATABASE_URL_TEST), levanta la aplicación en un puerto libre y
 * guarda capturas y un resumen en e2e/salida/.
 *
 * Uso:
 *   npm run test:e2e                      recorrido de verificación (termina con código 1 si algo falla)
 *   npm run test:e2e -- --escala=2        capturas en alta resolución (para el informe)
 *   npm run test:e2e -- --demo            modo demostración: pausas, subtítulos y video (e2e/salida/video)
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(raiz, 'e2e', 'salida');

const { cargarConfig } = require('../server/config');
const { crearPool } = require('../server/db/pool');
const { migrar } = require('../server/db/migraciones');
const { sembrar, CLAVE_DEMO } = require('../server/db/semilla');
const { crearApp } = require('../server/app');
const { crearNotificadorEnMemoria } = require('../server/integrations/correo');
const { crearPdfMinimo } = require('../server/utils/pdfMinimo');

const argumento = (nombre) => process.argv.find((a) => a === `--${nombre}` || a.startsWith(`--${nombre}=`));
const DEMO = Boolean(argumento('demo')) || process.env.E2E_DEMO === '1';
const ESCALA = Number((argumento('escala') || '').split('=')[1]) || Number(process.env.E2E_ESCALA) || 1;
const VISTA = DEMO ? { width: 1280, height: 720 } : { width: 1366, height: 860 };

const ESTUDIANTE = {
  nombre: 'Daniela Mejía Rojas',
  documento: '1000555777',
  correo: 'daniela.mejia@practicas.demo',
  contrasena: 'Clave2026x',
};

function urlDePruebas() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('Defina DATABASE_URL_TEST con la base de datos de pruebas (vea .env.example).');
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error('DATABASE_URL_TEST debe apuntar a una base cuyo nombre contenga "test": se borra en cada corrida.');
  }
  return url;
}

async function levantarAplicacion() {
  if (!fs.existsSync(path.join(raiz, 'web', 'dist', 'app.js'))) {
    console.log('Compilando la interfaz (web/dist)...');
    execFileSync(process.execPath, [path.join(raiz, 'scripts', 'build-web.mjs')], { stdio: 'inherit' });
  }
  const pool = crearPool(urlDePruebas(), { max: 5 });
  await migrar(pool, { reiniciar: true });
  await sembrar(pool);

  const notificador = crearNotificadorEnMemoria();
  const erroresServidor = [];
  const config = cargarConfig({ NODE_ENV: 'test', JWT_SECRET: 'secreto-e2e-0123456789-abcdefghij', LOG_PETICIONES: '0' });
  const { app } = crearApp({ config, pool, notificador, registrar: (...partes) => erroresServidor.push(partes.join(' ')) });
  const servidor = await new Promise((resolver, rechazar) => {
    const escuchando = app.listen(0, '127.0.0.1', () => resolver(escuchando));
    escuchando.once('error', rechazar);
  });
  return { pool, servidor, notificador, erroresServidor, base: `http://127.0.0.1:${servidor.address().port}` };
}

/* ---------- Utilidades del recorrido ---------- */

const resultados = [];
let pagina;
let base;

const foto = (nombre) => pagina.screenshot({ path: path.join(SALIDA, `${nombre}.png`), fullPage: true });
const pausa = (ms) => (DEMO ? pagina.waitForTimeout(ms * 1.8) : Promise.resolve());

/** Subtítulo en la parte baja de la pantalla; solo en modo demostración (el video no lleva audio). */
async function subtitulo(texto) {
  if (!DEMO) return;
  await pagina.evaluate((contenido) => {
    let barra = document.getElementById('subtitulo-demo');
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'subtitulo-demo';
      barra.setAttribute('aria-hidden', 'true');
      Object.assign(barra.style, {
        position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '99999', padding: '14px 28px',
        font: '600 21px/1.35 Inter, "Segoe UI", system-ui, sans-serif', color: '#fff',
        background: 'rgba(17, 24, 39, 0.9)', textAlign: 'center', pointerEvents: 'none',
      });
      document.body.appendChild(barra);
    }
    barra.textContent = contenido;
  }, texto);
  // El video no lleva audio: cada subtítulo se queda en pantalla el tiempo suficiente para leerlo
  await pagina.waitForTimeout(Math.min(4200, 900 + texto.length * 38));
}

/** Escribe como una persona en modo demostración y de golpe en el recorrido de verificación. */
async function escribir(localizador, texto) {
  if (DEMO) {
    await localizador.click();
    await localizador.pressSequentially(texto, { delay: 35 });
  } else {
    await localizador.fill(texto);
  }
}

async function ingresar(correo, contrasena = CLAVE_DEMO) {
  await pagina.goto(`${base}/ingreso`);
  await pagina.getByLabel('Correo electrónico').waitFor();
  await escribir(pagina.getByLabel('Correo electrónico'), correo);
  await escribir(pagina.getByLabel('Contraseña'), contrasena);
  await pagina.getByRole('button', { name: 'Ingresar', exact: true }).click();
  // Se espera a que la sesión quede abierta; si se navega antes, la petición de ingreso se cancelaría
  await pagina.getByText('Salir', { exact: true }).waitFor();
  await pagina.waitForLoadState('networkidle');
}

async function salir() {
  await pagina.getByText('Salir', { exact: true }).click();
  await pagina.waitForLoadState('networkidle');
}

async function paso(id, descripcion, trabajo) {
  const inicio = Date.now();
  try {
    await trabajo();
    resultados.push({ id, descripcion, estado: 'OK', segundos: Number(((Date.now() - inicio) / 1000).toFixed(1)) });
    console.log(`  ✔ ${id} ${descripcion}`);
  } catch (error) {
    resultados.push({ id, descripcion, estado: 'FALLÓ', detalle: error.message });
    console.log(`  ✖ ${id} ${descripcion}\n    ${error.message.split('\n').join('\n    ')}`);
    try {
      await foto(`error-${id}`);
    } catch {
      /* la captura del error es opcional */
    }
    throw error;
  }
}

/* ---------- Recorrido ---------- */

async function recorrido(entorno) {
  const { notificador } = entorno;
  const fila = (texto) => pagina.getByRole('row').filter({ hasText: texto });

  await paso('PE-01', 'Un estudiante nuevo crea su cuenta y entra al listado de ofertas', async () => {
    await pagina.goto(`${base}/registro`);
    await subtitulo('Módulo 1 · Cuentas: un estudiante crea su cuenta y autoriza el tratamiento de sus datos');
    await escribir(pagina.getByLabel('Nombre completo'), ESTUDIANTE.nombre);
    await escribir(pagina.getByLabel('Documento de identidad'), ESTUDIANTE.documento);
    await pagina.getByLabel('Semestre actual').selectOption('9');
    await pagina.getByLabel('Programa académico').selectOption({ label: 'Ingeniería Informática' });
    await escribir(pagina.getByLabel('Correo institucional'), ESTUDIANTE.correo);
    await escribir(pagina.getByLabel('Contraseña'), ESTUDIANTE.contrasena);
    await pagina.getByLabel(/Autorizo el tratamiento/).check();
    await pausa(1200);
    await foto('01-registro-estudiante');
    await pagina.getByRole('button', { name: 'Crear cuenta' }).click();
    await pagina.waitForURL('**/ofertas');
    await pagina.waitForSelector('.tarjeta');
    assert.ok(await pagina.getByText('Ofertas de práctica disponibles').isVisible());
    await subtitulo('Al registrarse, la sesión se abre sola y se muestra el listado de ofertas');
    await pausa(1800);
    await foto('02-ofertas');
  });

  await paso('PE-02', 'El listado se filtra por texto y se pagina de a cuatro ofertas', async () => {
    await pagina.goto(`${base}/ofertas`);
    await pagina.waitForSelector('.tarjeta');
    assert.equal(await pagina.locator('.tarjeta').count(), 4, 'la primera página trae cuatro ofertas');
    await pagina.goto(`${base}/ofertas?texto=React`);
    await pagina.waitForSelector('.tarjeta');
    assert.equal(await pagina.locator('.tarjeta').count(), 1);
    assert.match(await pagina.locator('.tarjeta h2').first().innerText(), /React/);
    await subtitulo('Módulo 2 · Ofertas: búsqueda por texto, programa, ciudad y modalidad');
    await pausa(1800);
    await foto('03-ofertas-filtradas');
  });

  await paso('PE-03', 'El estudiante se postula con su hoja de vida en PDF y ve la postulación como "Enviada"', async () => {
    await pagina.locator('.tarjeta').first().getByRole('link').first().click();
    await pagina.waitForURL(/\/ofertas\/\d+$/);
    await pagina.getByRole('heading', { name: 'Postularme a esta oferta' }).waitFor();
    await subtitulo('Postulación: hoja de vida en PDF, carta de presentación y autorización de datos');
    await pagina.getByLabel('Hoja de vida (PDF, máximo 2 MB)').setInputFiles({
      name: 'HV_Daniela_Mejia.pdf',
      mimeType: 'application/pdf',
      buffer: crearPdfMinimo(['Hoja de vida (datos de demostración)', ESTUDIANTE.nombre, 'Ingeniería Informática - semestre 9']),
    });
    await escribir(
      pagina.getByLabel('Carta de presentación (opcional)'),
      'Me interesa aportar en el desarrollo del frontend y aprender del equipo de ingeniería.'
    );
    await pagina.getByLabel(/Autorizo el tratamiento de mis datos/).check();
    await pausa(1200);
    await foto('04-postulacion-formulario');
    await pagina.getByRole('button', { name: 'Enviar postulación' }).click();
    await pagina.getByRole('heading', { name: 'Postulación enviada' }).waitFor();
    await pausa(1500);
    await foto('05-postulacion-enviada');

    await pagina.goto(`${base}/mis-postulaciones`);
    await fila('Practicante de desarrollo web').getByText('Enviada').waitFor();
    await subtitulo('"Mis postulaciones": el estado inicial es Enviada');
    await pausa(1500);
    await foto('06-mis-postulaciones');
    assert.ok(
      notificador.bandeja.some((m) => m.para.includes('rrhh@nododigital.demo') && /Nueva postulación/.test(m.asunto)),
      'la empresa debía recibir el aviso de la nueva postulación'
    );
  });

  await paso('PE-04', 'La empresa revisa al postulante y lo preselecciona; Coordinación recibe el aviso', async () => {
    await salir();
    await ingresar('rrhh@nododigital.demo');
    await pagina.waitForSelector('table');
    await subtitulo('Rol empresa: ofertas publicadas y postulantes recibidos');
    await pausa(1500);
    await foto('07-empresa-mis-ofertas');
    await pagina.goto(`${base}/empresa/ofertas/1/postulantes`);
    await fila(ESTUDIANTE.nombre).getByText('Enviada').waitFor();
    await pausa(1200);
    await fila(ESTUDIANTE.nombre).getByRole('button', { name: 'Preseleccionar' }).click();
    await pagina.getByText('quedó preseleccionado(a)').waitFor();
    await fila(ESTUDIANTE.nombre).getByText('Preseleccionada').waitFor();
    await subtitulo('La empresa preselecciona y se avisa a Coordinación para validar el convenio');
    await pausa(1800);
    await foto('08-empresa-preseleccion');
    assert.ok(
      notificador.bandeja.some((m) => m.para.includes('coordinacion@practicas.demo') && m.asunto.includes(ESTUDIANTE.nombre)),
      'Coordinación debía recibir el aviso de la preselección'
    );
  });

  await paso('PE-05', 'Coordinación ve el convenio vigente y aprueba la postulación', async () => {
    await salir();
    await ingresar('coordinacion@practicas.demo');
    await pagina.waitForSelector('table');
    await fila(ESTUDIANTE.nombre).waitFor();
    assert.match(await fila(ESTUDIANTE.nombre).innerText(), /Vigente/);
    await subtitulo('Módulo 3 · Aprobación: Coordinación ve la postulación con el estado del convenio de la empresa');
    await pausa(2200);
    await foto('09-coordinacion-panel');
    await fila(ESTUDIANTE.nombre).getByRole('button', { name: 'Aprobar' }).click();
    await pagina.getByRole('dialog').waitFor();
    await pausa(1200);
    await foto('10-coordinacion-dialogo-aprobar');
    await pagina.getByRole('button', { name: 'Confirmar aprobación' }).click();
    await pagina.getByText(`La postulación de ${ESTUDIANTE.nombre} quedó aprobada`).waitFor();
    await subtitulo('Con el convenio vigente la aprobación se registra y se notifica al estudiante y a la empresa');
    await pausa(2000);
    await foto('11-coordinacion-aprobada');

    await pagina.getByRole('button', { name: 'Aprobadas', exact: true }).click();
    await fila(ESTUDIANTE.nombre).getByText('Aprobada').waitFor();
    assert.ok(
      notificador.bandeja.some(
        (m) => m.para.includes(ESTUDIANTE.correo) && m.para.includes('rrhh@nododigital.demo') && /fue aprobada/.test(m.asunto)
      ),
      'el estudiante y la empresa debían recibir el resultado'
    );
  });

  await paso('PE-06', 'Con el convenio vencido no se puede aprobar: solo rechazar o devolver, y la devolución exige un motivo', async () => {
    await pagina.getByRole('button', { name: 'Pendientes', exact: true }).click();
    const laura = fila('Laura Sofía Pérez Arango');
    await laura.waitFor();
    assert.match(await laura.innerText(), /Vencido/);
    assert.equal(await laura.getByRole('button', { name: 'Aprobar', exact: true }).count(), 0, 'no debe ofrecerse Aprobar');
    assert.match(await laura.innerText(), /Aprobar no está disponible: el convenio de la empresa está vencido/);
    await subtitulo('Convenio vencido: el sistema no ofrece "Aprobar" y explica el motivo');
    await pausa(2500);
    await foto('12-coordinacion-convenio-vencido');

    await laura.getByRole('button', { name: 'Devolver', exact: true }).click();
    await pagina.getByRole('dialog').waitFor();
    await pagina.getByRole('button', { name: 'Confirmar devolución' }).click();
    await pagina.locator('dialog .campo__error').waitFor();
    await subtitulo('Devolver o rechazar exige escribir el motivo');
    await pausa(1800);
    await foto('13-coordinacion-motivo-obligatorio');

    await escribir(pagina.getByLabel('Motivo (obligatorio)'), 'El convenio con la empresa está vencido; se solicita su renovación.');
    await pagina.getByRole('button', { name: 'Confirmar devolución' }).click();
    await pagina.getByText('quedó devuelta').waitFor();
    await laura.getByText('Devuelta').waitFor();
    await pausa(1800);
    await foto('14-coordinacion-devuelta');
  });

  await paso('PE-07', 'El estudiante ve su postulación como "Aprobada"', async () => {
    await salir();
    await ingresar(ESTUDIANTE.correo, ESTUDIANTE.contrasena);
    await pagina.goto(`${base}/mis-postulaciones`);
    await fila('Practicante de desarrollo web').getByText('Aprobada').waitFor();
    await subtitulo('El estudiante consulta el resultado de su postulación');
    await pausa(2200);
    await foto('15-estudiante-resultado');
  });

  await paso('PE-08', 'Un estudiante no puede abrir las pantallas de Coordinación ni de las empresas', async () => {
    for (const ruta of ['/coordinacion/postulaciones', '/empresa/ofertas']) {
      await pagina.goto(`${base}${ruta}`);
      await pagina.waitForLoadState('networkidle');
      assert.equal(await pagina.getByRole('heading', { name: 'Postulaciones por aprobar' }).count(), 0, ruta);
      assert.equal(await pagina.locator('table').count() === 0 || !/Estudio Creativo/.test(await pagina.content()), true, ruta);
    }
    await subtitulo('Cada rol solo ve sus propias pantallas');
    await pausa(1500);
  });
}

async function recorridoMovil(navegador) {
  const contexto = await navegador.newContext({
    viewport: { width: 390, height: 800 },
    deviceScaleFactor: ESCALA,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  });
  const movil = await contexto.newPage();
  await movil.goto(`${base}/ingreso`);
  await movil.getByLabel('Correo electrónico').fill(ESTUDIANTE.correo);
  await movil.getByLabel('Contraseña').fill(ESTUDIANTE.contrasena);
  await movil.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await movil.waitForSelector('.tarjeta');
  const sobra = await movil.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 1, `la página no debe desplazarse en horizontal en 390 px (sobran ${sobra} px)`);
  await movil.screenshot({ path: path.join(SALIDA, '16-movil-ofertas.png'), fullPage: true });
  await contexto.close();
}

/* ---------- Ejecución ---------- */

async function principal() {
  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(SALIDA, { recursive: true });

  const entorno = await levantarAplicacion();
  base = entorno.base;
  const navegador = await chromium.launch();
  const problemas = [];
  let fallo = null;

  const opcionesContexto = {
    viewport: VISTA,
    deviceScaleFactor: ESCALA,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    acceptDownloads: true,
    ...(DEMO ? { recordVideo: { dir: path.join(SALIDA, 'video'), size: VISTA } } : {}),
  };
  const contexto = await navegador.newContext(opcionesContexto);
  if (DEMO) {
    // Punto rojo que sigue al puntero: el video no muestra el cursor del sistema
    await contexto.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const punto = document.createElement('div');
        Object.assign(punto.style, {
          position: 'fixed', left: '-14px', top: '-14px', width: '22px', height: '22px', borderRadius: '50%',
          background: 'rgba(220, 38, 38, 0.75)', border: '2px solid #fff', zIndex: '100000', pointerEvents: 'none',
          transition: 'transform 0.12s ease-out',
        });
        punto.setAttribute('aria-hidden', 'true');
        document.body.appendChild(punto);
        document.addEventListener('mousemove', (e) => {
          punto.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        });
      });
    });
  }
  pagina = await contexto.newPage();
  pagina.setDefaultTimeout(10000);
  pagina.on('console', (m) => {
    if (!['error', 'warning'].includes(m.type())) return;
    // Chromium registra en consola la respuesta 422 de "devolver sin motivo", que el recorrido provoca a propósito
    const esperado = /status of 422/.test(m.text()) && m.location().url.includes('/devolver');
    if (!esperado) problemas.push(`[consola ${m.type()}] ${m.text()}`);
  });
  pagina.on('pageerror', (e) => problemas.push(`[error de página] ${e.message}`));
  pagina.on('requestfailed', (r) => {
    // Las cancelaciones (ERR_ABORTED) las provoca el propio navegador o la aplicación, por ejemplo al reemplazar
    // una búsqueda por otra mientras se escribe; no son fallos de red.
    const motivo = r.failure() ? r.failure().errorText : 'sin detalle';
    if (!/ERR_ABORTED/.test(motivo)) problemas.push(`[petición fallida] ${r.url()} (${motivo})`);
  });
  pagina.on('response', (r) => {
    // El 422 de "devolver sin motivo" es parte del recorrido; cualquier otro estado de error no lo es
    const esperado = r.status() === 422 && r.url().includes('/devolver');
    if (r.status() >= 400 && !esperado) problemas.push(`[http ${r.status()}] ${r.url()}`);
  });

  console.log(`Recorrido E2E${DEMO ? ' (modo demostración)' : ''} sobre ${base}`);
  try {
    await recorrido(entorno);
    await recorridoMovil(navegador);
    resultados.push({ id: 'PE-09', descripcion: 'La interfaz se adapta a un teléfono de 390 px sin desplazamiento horizontal', estado: 'OK' });
    console.log('  ✔ PE-09 La interfaz se adapta a un teléfono de 390 px sin desplazamiento horizontal');
  } catch (error) {
    fallo = error;
  }

  const sinProblemas = problemas.length === 0 && entorno.erroresServidor.length === 0;
  resultados.push({
    id: 'PE-10',
    descripcion: 'Durante todo el recorrido no hubo errores de consola, de red ni del servidor',
    estado: sinProblemas ? 'OK' : 'FALLÓ',
    ...(sinProblemas ? {} : { detalle: [...new Set([...problemas, ...entorno.erroresServidor])].join(' | ') }),
  });
  console.log(`  ${sinProblemas ? '✔' : '✖'} PE-10 Sin errores de consola, de red ni del servidor`);
  if (!sinProblemas) [...new Set([...problemas, ...entorno.erroresServidor])].forEach((p) => console.log(`    ${p}`));

  await contexto.close(); // en modo demostración, esto termina de guardar el video
  await navegador.close();
  await new Promise((resolver) => {
    entorno.servidor.close(resolver);
    if (entorno.servidor.closeAllConnections) entorno.servidor.closeAllConnections();
  });
  await entorno.pool.end();

  fs.writeFileSync(path.join(SALIDA, 'resultado.json'), JSON.stringify({ fecha: new Date().toISOString(), resultados }, null, 2));
  const fallidos = resultados.filter((r) => r.estado !== 'OK');
  console.log(`\n${resultados.length - fallidos.length} de ${resultados.length} verificaciones correctas. Capturas en e2e/salida/`);
  if (fallo || fallidos.length > 0) process.exit(1);
}

principal().catch((error) => {
  console.error('El recorrido E2E no pudo completarse:', error.message);
  process.exit(1);
});
