'use strict';

// Las fechas se devuelven como texto (AAAA-MM-DD) para no depender de cómo el driver convierte el tipo DATE.
const BASE = `
  WITH base AS (
    SELECT o.id_oferta, o.id_empresa, o.titulo, o.descripcion, o.requisitos, o.cupos, o.ciudad, o.modalidad,
           o.id_programa, o.estado, o.fecha_publicacion, o.fecha_cierre,
           e.nombre AS empresa_nombre, e.sector AS empresa_sector,
           p.nombre AS programa_nombre,
           (SELECT COUNT(*)::int FROM postulacion po
             WHERE po.id_oferta = o.id_oferta AND po.estado_postulacion = 'aprobada') AS aprobadas
      FROM oferta_practica o
      JOIN empresa e ON e.id_empresa = o.id_empresa
      LEFT JOIN programa_academico p ON p.id_programa = o.id_programa
  )`;

const COLUMNAS = `
  b.id_oferta, b.id_empresa, b.titulo, b.descripcion, b.requisitos, b.cupos, b.ciudad, b.modalidad,
  b.id_programa, b.estado, b.empresa_nombre, b.empresa_sector, b.programa_nombre, b.aprobadas,
  (b.cupos - b.aprobadas) AS cupos_disponibles,
  b.fecha_publicacion::text AS fecha_publicacion, b.fecha_cierre::text AS fecha_cierre`;

const escaparLike = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

async function insertar(db, o) {
  const { rows } = await db.query(
    `INSERT INTO oferta_practica
       (id_empresa, titulo, descripcion, requisitos, cupos, ciudad, modalidad, id_programa, fecha_publicacion, fecha_cierre)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id_oferta`,
    [o.id_empresa, o.titulo, o.descripcion, o.requisitos, o.cupos, o.ciudad, o.modalidad, o.id_programa, o.fecha_publicacion, o.fecha_cierre]
  );
  return rows[0];
}

async function cambiarEstado(db, idOferta, estado) {
  await db.query('UPDATE oferta_practica SET estado = $2 WHERE id_oferta = $1', [idOferta, estado]);
}

/** Bloquea la fila de la oferta hasta que termine la transacción (evita aprobar de más con los cupos). */
async function bloquear(db, idOferta) {
  const { rows } = await db.query('SELECT id_oferta FROM oferta_practica WHERE id_oferta = $1 FOR UPDATE', [idOferta]);
  return rows.length > 0;
}

async function detalle(db, idOferta) {
  const { rows } = await db.query(`${BASE} SELECT ${COLUMNAS} FROM base b WHERE b.id_oferta = $1`, [idOferta]);
  return rows[0];
}

/** Ofertas que un estudiante puede ver: abiertas, vigentes por fecha y con cupos libres. */
async function listarPublicas(db, filtros, hoy) {
  const params = [hoy];
  const condiciones = [
    "b.estado = 'abierta'",
    '(b.fecha_cierre IS NULL OR b.fecha_cierre >= $1)',
    'b.cupos > b.aprobadas',
  ];
  const agregar = (valor) => {
    params.push(valor);
    return `$${params.length}`;
  };
  if (filtros.texto) {
    const p = agregar(`%${escaparLike(filtros.texto)}%`);
    condiciones.push(`(b.titulo ILIKE ${p} OR b.empresa_nombre ILIKE ${p} OR b.descripcion ILIKE ${p})`);
  }
  if (filtros.id_programa) condiciones.push(`b.id_programa = ${agregar(filtros.id_programa)}`);
  if (filtros.ciudad) condiciones.push(`b.ciudad ILIKE ${agregar(`%${escaparLike(filtros.ciudad)}%`)}`);
  if (filtros.modalidad) condiciones.push(`b.modalidad = ${agregar(filtros.modalidad)}`);

  const limite = agregar(filtros.limite);
  const desplazamiento = agregar((filtros.pagina - 1) * filtros.limite);
  const { rows } = await db.query(
    `${BASE}
     SELECT ${COLUMNAS}, COUNT(*) OVER ()::int AS total
       FROM base b
      WHERE ${condiciones.join(' AND ')}
      ORDER BY b.fecha_publicacion DESC, b.id_oferta DESC
      LIMIT ${limite} OFFSET ${desplazamiento}`,
    params
  );
  return { filas: rows, total: rows.length > 0 ? rows[0].total : 0 };
}

async function listarDeEmpresa(db, idEmpresa) {
  const { rows } = await db.query(
    `SELECT o.id_oferta, o.titulo, o.cupos, o.ciudad, o.modalidad, o.estado,
            o.fecha_publicacion::text AS fecha_publicacion, o.fecha_cierre::text AS fecha_cierre,
            (SELECT COUNT(*)::int FROM postulacion po WHERE po.id_oferta = o.id_oferta) AS postulantes,
            (SELECT COUNT(*)::int FROM postulacion po
              WHERE po.id_oferta = o.id_oferta AND po.estado_postulacion = 'aprobada') AS aprobadas
       FROM oferta_practica o
      WHERE o.id_empresa = $1
      ORDER BY o.fecha_publicacion DESC, o.id_oferta DESC`,
    [idEmpresa]
  );
  return rows;
}

module.exports = { insertar, cambiarEstado, bloquear, detalle, listarPublicas, listarDeEmpresa };
