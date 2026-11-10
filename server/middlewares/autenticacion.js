'use strict';

const { verificar, ErrorToken } = require('../utils/jwt');
const { noAutenticado, prohibido } = require('../utils/errores');

/**
 * Exige un token "Authorization: Bearer ..." válido y una cuenta activa. Deja en req.usuario el
 * perfil (id, rol, nombre, id_estudiante / id_empresa / id_docente) para el resto de la petición.
 */
function crearAutenticacion({ config, servicios, reloj = () => new Date() }) {
  return async function autenticar(req, res, next) {
    const cabecera = req.get('authorization') || '';
    const [esquema, token] = cabecera.split(' ');
    if (esquema !== 'Bearer' || !token) throw noAutenticado();

    let carga;
    try {
      carga = verificar(token, config.jwt.secreto, { ahora: reloj().getTime() });
    } catch (error) {
      if (error instanceof ErrorToken) throw noAutenticado(error.message, error.codigo);
      throw error;
    }

    // Se consulta la cuenta en cada petición: así una cuenta desactivada pierde el acceso de inmediato
    const perfil = await servicios.auth.obtenerSesion(carga.sub);
    if (!perfil || perfil.estado !== 'activo') {
      throw noAutenticado('La cuenta no está disponible.', 'CUENTA_NO_DISPONIBLE');
    }
    req.usuario = perfil;
    next();
  };
}

/** Permite el paso solo a los roles indicados. Debe usarse después de "autenticar". */
function exigirRol(...roles) {
  return function verificarRol(req, res, next) {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      throw prohibido('Su rol no tiene permiso para esta acción.');
    }
    next();
  };
}

module.exports = { crearAutenticacion, exigirRol };
