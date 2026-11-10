'use strict';

/**
 * Consultas SQL de cuentas, estudiantes y empresas.
 * Todas reciben "db" (un Pool o un cliente de transacción) como primer parámetro.
 */

async function insertarUsuario(db, { correo, hash, rol, consentimiento }) {
  const { rows } = await db.query(
    `INSERT INTO usuario (correo_institucional, hash_contrasena, rol, consentimiento_datos, fecha_consentimiento)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_usuario, correo_institucional, rol`,
    [correo, hash, rol, consentimiento, consentimiento ? new Date() : null]
  );
  return rows[0];
}

async function insertarEstudiante(db, { idUsuario, idPrograma, nombre, documento, semestre }) {
  const { rows } = await db.query(
    `INSERT INTO estudiante (id_usuario, id_programa, nombre, documento, semestre)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_estudiante`,
    [idUsuario, idPrograma, nombre, documento, semestre]
  );
  return rows[0];
}

async function insertarEmpresa(db, { idUsuario, nombre, nit, sector, correoContacto }) {
  const { rows } = await db.query(
    `INSERT INTO empresa (id_usuario, nombre, nit, sector, correo_contacto)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_empresa`,
    [idUsuario, nombre, nit, sector, correoContacto]
  );
  return rows[0];
}

async function buscarPorCorreo(db, correo) {
  const { rows } = await db.query(
    `SELECT id_usuario, correo_institucional, hash_contrasena, rol, estado
       FROM usuario
      WHERE correo_institucional = $1`,
    [correo]
  );
  return rows[0];
}

/** Datos públicos de la sesión: cuenta + nombre + identificador del rol (estudiante, empresa o docente). */
async function obtenerPerfil(db, idUsuario) {
  const { rows } = await db.query(
    `SELECT u.id_usuario, u.correo_institucional AS correo, u.rol, u.estado,
            COALESCE(es.nombre, em.nombre, d.nombre,
                     CASE WHEN u.rol = 'coordinacion' THEN 'Coordinación de prácticas' END) AS nombre,
            es.id_estudiante, em.id_empresa, d.id_docente
       FROM usuario u
       LEFT JOIN estudiante es ON es.id_usuario = u.id_usuario
       LEFT JOIN empresa em ON em.id_usuario = u.id_usuario
       LEFT JOIN docente d ON d.id_usuario = u.id_usuario
      WHERE u.id_usuario = $1`,
    [idUsuario]
  );
  return rows[0];
}

async function buscarEstudiantePorUsuario(db, idUsuario) {
  const { rows } = await db.query(
    'SELECT id_estudiante, id_programa, nombre, semestre FROM estudiante WHERE id_usuario = $1',
    [idUsuario]
  );
  return rows[0];
}

async function buscarEmpresaPorUsuario(db, idUsuario) {
  const { rows } = await db.query(
    'SELECT id_empresa, nombre, correo_contacto FROM empresa WHERE id_usuario = $1',
    [idUsuario]
  );
  return rows[0];
}

async function listarEmpresas(db) {
  const { rows } = await db.query('SELECT id_empresa, nombre, nit, sector FROM empresa ORDER BY nombre');
  return rows;
}

async function listarCorreosPorRol(db, rol) {
  const { rows } = await db.query(
    "SELECT correo_institucional AS correo FROM usuario WHERE rol = $1 AND estado = 'activo' ORDER BY id_usuario",
    [rol]
  );
  return rows.map((fila) => fila.correo);
}

module.exports = {
  insertarUsuario,
  insertarEstudiante,
  insertarEmpresa,
  buscarPorCorreo,
  obtenerPerfil,
  buscarEstudiantePorUsuario,
  buscarEmpresaPorUsuario,
  listarEmpresas,
  listarCorreosPorRol,
};
