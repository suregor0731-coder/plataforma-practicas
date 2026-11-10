'use strict';

/**
 * Genera un PDF de una página con unas pocas líneas de texto (Helvetica, 16 pt).
 * Se usa para los datos de demostración y para las pruebas, sin depender de librerías.
 */
function crearPdfMinimo(lineas) {
  const textos = (Array.isArray(lineas) ? lineas : [lineas]).map(String);
  const escapar = (s) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

  let flujo = 'BT /F1 16 Tf 72 740 Td 22 TL\n';
  textos.forEach((linea, i) => {
    flujo += `${i === 0 ? '' : 'T* '}(${escapar(linea)}) Tj\n`;
  });
  flujo += 'ET';

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(flujo, 'latin1')} >>\nstream\n${flujo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];

  let pdf = '%PDF-1.4\n';
  const posiciones = [];
  objetos.forEach((objeto, i) => {
    posiciones.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = { crearPdfMinimo };
