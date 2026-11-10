'use strict';

async function listarProgramas(db) {
  const { rows } = await db.query('SELECT id_programa, nombre, facultad FROM programa_academico ORDER BY nombre');
  return rows;
}

async function existePrograma(db, idPrograma) {
  const { rows } = await db.query('SELECT 1 AS existe FROM programa_academico WHERE id_programa = $1', [idPrograma]);
  return rows.length > 0;
}

module.exports = { listarProgramas, existePrograma };
