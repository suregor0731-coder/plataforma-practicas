// Formato de fechas y textos para la interfaz (todo en hora de Colombia).
const ZONA = 'America/Bogota';

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Acepta "AAAA-MM-DD" o una marca de tiempo ISO y devuelve "DD/MM/AAAA". */
export function fecha(valor) {
  if (!valor) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${anio}`;
  }
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime()) ? '—' : formatoFecha.format(instante);
}

/** Fecha de hoy en Colombia como "AAAA-MM-DD" (sirve para el atributo min de los campos de fecha). */
export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
}

export const MODALIDADES = { presencial: 'Presencial', hibrida: 'Híbrida', remota: 'Remota' };

export const etiquetaModalidad = (modalidad) => MODALIDADES[modalidad] || modalidad;

export function textoCupos(n) {
  return `${n} ${n === 1 ? 'cupo' : 'cupos'}`;
}

export function textoCuposDisponibles(n) {
  return `${n} ${n === 1 ? 'cupo disponible' : 'cupos disponibles'}`;
}

/** Divide un texto en líneas no vacías (los requisitos se guardan uno por línea). */
export function lineas(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
}

/** Divide un texto en párrafos separados por líneas en blanco. */
export function parrafos(texto) {
  return String(texto || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function textoDiasConvenio(convenio) {
  if (!convenio || convenio.dias_restantes === null || convenio.dias_restantes === undefined) return '';
  const dias = convenio.dias_restantes;
  if (convenio.estado === 'vencido') return `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'Vence hoy';
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}
