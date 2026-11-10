'use strict';

const COLUMNAS = `
  c.id_convenio, c.id_empresa, e.nombre AS empresa_nombre,
  c.fecha_inicio::text AS fecha_inicio, c.fecha_fin::text AS fecha_fin, c.estado`;

async function listarTodos(db) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}
       FROM convenio c
       JOIN empresa e ON e.id_empresa = c.id_empresa
      ORDER BY c.fecha_fin DESC, c.id_convenio DESC`
  );
  return rows;
}

async function listarPorEmpresa(db, idEmpresa) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}
       FROM convenio c
       JOIN empresa e ON e.id_empresa = c.id_empresa
      WHERE c.id_empresa = $1
      ORDER BY c.fecha_fin DESC, c.id_convenio DESC`,
    [idEmpresa]
  );
  return rows;
}

async function buscarPorId(db, idConvenio) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}
       FROM convenio c
       JOIN empresa e ON e.id_empresa = c.id_empresa
      WHERE c.id_convenio = $1`,
    [idConvenio]
  );
  return rows[0];
}

async function insertar(db, { id_empresa, fecha_inicio, fecha_fin }) {
  const { rows } = await db.query(
    `INSERT INTO convenio (id_empresa, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3)
     RETURNING id_convenio`,
    [id_empresa, fecha_inicio, fecha_fin]
  );
  return rows[0];
}

async function cambiarEstado(db, idConvenio, estado) {
  await db.query('UPDATE convenio SET estado = $2 WHERE id_convenio = $1', [idConvenio, estado]);
}

async function existeEmpresa(db, idEmpresa) {
  const { rows } = await db.query('SELECT 1 AS existe FROM empresa WHERE id_empresa = $1', [idEmpresa]);
  return rows.length > 0;
}

module.exports = { listarTodos, listarPorEmpresa, buscarPorId, insertar, cambiarEstado, existeEmpresa };
