// Compila la interfaz React con esbuild: web/src/main.jsx -> web/dist/app.js + app.css, y copia index.html.
// Uso: node scripts/build-web.mjs [--watch]
import { build, context } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'web', 'dist');
const observar = process.argv.includes('--watch');
const produccion = process.env.NODE_ENV === 'production';

const opciones = {
  entryPoints: [path.join(raiz, 'web', 'src', 'main.jsx')],
  outfile: path.join(salida, 'app.js'),
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  minify: produccion,
  sourcemap: produccion ? false : 'linked',
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': JSON.stringify(produccion ? 'production' : 'development'),
    // El panel de cuentas de demostración de la pantalla de ingreso solo se incluye fuera de producción
    __MOSTRAR_DEMO__: JSON.stringify(!produccion),
  },
};

async function copiarIndice() {
  await copyFile(path.join(raiz, 'web', 'index.html'), path.join(salida, 'index.html'));
}

await rm(salida, { recursive: true, force: true });
await mkdir(salida, { recursive: true });

if (observar) {
  const ctx = await context(opciones);
  await copiarIndice();
  await ctx.watch();
  console.log('Observando cambios en web/src... (Ctrl+C para salir)');
} else {
  await build(opciones);
  await copiarIndice();
}
