'use strict';

async function insertar(db, { idEstudiante, idOferta, carta, hojaVida, hojaVidaNombre }) {
  const { rows } = await db.query(
    `INSERT INTO postulacion (id_estudiante, id_oferta, carta_presentacion, hoja_vida, hoja_vida_nombre)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_postulacion, id_estudiante, id_oferta, fecha_postulacion, estado_postulacion`,
    [idEstudiante, idOferta, carta, hojaVida, hojaVidaNombre]
  );
  return rows[0];
}

const DETALLE = `
  SELECT po.id_postulacion, po.id_estudiante, po.id_oferta, po.estado_postulacion, po.fecha_postulacion,
         po.carta_presentacion, po.hoja_vida_nombre, po.fecha_decision, po.observacion_decision,
         o.id_empresa, o.titulo AS oferta_titulo, o.cupos AS oferta_cupos,
         e.nombre AS empresa_nombre, e.correo_contacto AS empresa_correo,
         s.nombre AS estudiante_nombre, s.documento AS estudiante_documento, s.semestre AS estudiante_semestre,
         pr.nombre AS estudiante_programa, u.correo_institucional AS estudiante_correo
    FROM postulacion po
    JOIN oferta_practica o ON o.id_oferta = po.id_oferta
    JOIN empresa e ON e.id_empresa = o.id_empresa
    JOIN estudiante s ON s.id_estudiante = po.id_estudiante
    JOIN programa_academico pr ON pr.id_programa = s.id_programa
    JOIN usuario u ON u.id_usuario = s.id_usuario`;

/** Con { bloquear: true } la fila queda reservada hasta el final de la transacción. */
async function buscarPorId(db, idPostulacion, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `${DETALLE} WHERE po.id_postulacion = $1${bloquear ? ' FOR UPDATE OF po' : ''}`,
    [idPostulacion]
  );
  return rows[0];
}

async function buscarPorEstudianteYOferta(db, idEstudiante, idOferta) {
  const { rows } = await db.query(
    'SELECT id_postulacion, estado_postulacion FROM postulacion WHERE id_estudiante = $1 AND id_oferta = $2',
    [idEstudiante, idOferta]
  );
  return rows[0];
}

async function listarDeEstudiante(db, idEstudiante) {
  const { rows } = await db.query(
    `SELECT po.id_postulacion, po.id_oferta, po.estado_postulacion, po.fecha_postulacion,
            po.fecha_decision, po.observacion_decision, po.hoja_vida_nombre,
            o.titulo AS oferta_titulo, o.ciudad, o.modalidad, e.nombre AS empresa_nombre
       FROM postulacion po
       JOIN oferta_practica o ON o.id_oferta = po.id_oferta
       JOIN empresa e ON e.id_empresa = o.id_empresa
      WHERE po.id_estudiante = $1
      ORDER BY po.fecha_postulacion DESC, po.id_postulacion DESC`,
    [idEstudiante]
  );
  return rows;
}

async function listarDeOferta(db, idOferta) {
  const { rows } = await db.query(
    `SELECT po.id_postulacion, po.estado_postulacion, po.fecha_postulacion, po.carta_presentacion,
            po.hoja_vida_nombre, po.observacion_decision,
            s.nombre AS estudiante_nombre, s.semestre AS estudiante_semestre,
            pr.nombre AS estudiante_programa, u.correo_institucional AS estudiante_correo
       FROM postulacion po
       JOIN estudiante s ON s.id_estudiante = po.id_estudiante
       JOIN programa_academico pr ON pr.id_programa = s.id_programa
       JOIN usuario u ON u.id_usuario = s.id_usuario
      WHERE po.id_oferta = $1
      ORDER BY po.fecha_postulacion ASC, po.id_postulacion ASC`,
    [idOferta]
  );
  return rows;
}

/** Listado para Coordinación, filtrado por una lista de estados y paginado. */
async function listarPorEstados(db, estados, { limite, desplazamiento }) {
  const marcadores = estados.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await db.query(
    `SELECT po.id_postulacion, po.estado_postulacion, po.fecha_postulacion, po.fecha_decision,
            po.observacion_decision, po.hoja_vida_nombre,
            s.nombre AS estudiante_nombre, s.semestre AS estudiante_semestre, pr.nombre AS estudiante_programa,
            o.id_empresa, o.id_oferta, o.titulo AS oferta_titulo, e.nombre AS empresa_nombre,
            COUNT(*) OVER ()::int AS total
       FROM postulacion po
       JOIN estudiante s ON s.id_estudiante = po.id_estudiante
       JOIN programa_academico pr ON pr.id_programa = s.id_programa
       JOIN oferta_practica o ON o.id_oferta = po.id_oferta
       JOIN empresa e ON e.id_empresa = o.id_empresa
      WHERE po.estado_postulacion IN (${marcadores})
      ORDER BY po.fecha_postulacion ASC, po.id_postulacion ASC
      LIMIT $${estados.length + 1} OFFSET $${estados.length + 2}`,
    [...estados, limite, desplazamiento]
  );
  return rows;
}

/** Cantidad de postulaciones por estado, p. ej. { enviada: 3, aprobada: 1 }. Los estados sin filas no aparecen. */
async function contarPorEstado(db) {
  const { rows } = await db.query(
    'SELECT estado_postulacion, COUNT(*)::int AS total FROM postulacion GROUP BY estado_postulacion'
  );
  return Object.fromEntries(rows.map((fila) => [fila.estado_postulacion, fila.total]));
}

async function actualizarEstado(db, idPostulacion, estado) {
  await db.query('UPDATE postulacion SET estado_postulacion = $2 WHERE id_postulacion = $1', [idPostulacion, estado]);
}

async function actualizarDecision(db, idPostulacion, { estado, observacion, idUsuario }) {
  await db.query(
    `UPDATE postulacion
        SET estado_postulacion = $2, observacion_decision = $3, id_usuario_decision = $4, fecha_decision = now()
      WHERE id_postulacion = $1`,
    [idPostulacion, estado, observacion, idUsuario]
  );
}

async function obtenerHojaVida(db, idPostulacion) {
  const { rows } = await db.query(
    `SELECT po.hoja_vida, po.hoja_vida_nombre, s.id_usuario AS usuario_estudiante, o.id_empresa
       FROM postulacion po
       JOIN estudiante s ON s.id_estudiante = po.id_estudiante
       JOIN oferta_practica o ON o.id_oferta = po.id_oferta
      WHERE po.id_postulacion = $1`,
    [idPostulacion]
  );
  return rows[0];
}

module.exports = {
  insertar,
  buscarPorId,
  buscarPorEstudianteYOferta,
  listarDeEstudiante,
  listarDeOferta,
  listarPorEstados,
  contarPorEstado,
  actualizarEstado,
  actualizarDecision,
  obtenerHojaVida,
};
