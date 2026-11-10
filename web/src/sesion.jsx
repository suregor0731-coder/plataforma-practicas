import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { alPerderLaSesion, api, fijarToken } from './api.js';

const CLAVE_ALMACEN = 'practicas.token';

export const ROLES = {
  estudiante: 'Estudiante',
  empresa: 'Empresa',
  coordinacion: 'Coordinación',
  docente: 'Docente',
};

/** Pantalla a la que se llega después de ingresar, según el rol. */
export function rutaInicio(rol) {
  const rutas = {
    estudiante: '/ofertas',
    empresa: '/empresa/ofertas',
    coordinacion: '/coordinacion/postulaciones',
    docente: '/informes',
  };
  return rutas[rol] || '/ingreso';
}

// El almacenamiento del navegador puede no estar disponible (modo privado, bloqueo de datos): nunca debe romper la app
function leerToken() {
  try {
    return window.sessionStorage.getItem(CLAVE_ALMACEN);
  } catch {
    return null;
  }
}

function guardarToken(token) {
  try {
    if (token) window.sessionStorage.setItem(CLAVE_ALMACEN, token);
    else window.sessionStorage.removeItem(CLAVE_ALMACEN);
  } catch {
    // sin almacenamiento: la sesión dura solo mientras no se recargue la página
  }
}

const ContextoSesion = createContext(null);

export function ProveedorSesion({ children }) {
  const [tokenInicial] = useState(leerToken);
  const [sesion, setSesion] = useState(null);
  const [verificando, setVerificando] = useState(Boolean(tokenInicial));
  const [motivo, setMotivo] = useState('');

  const cerrarSesion = useCallback((razon = '') => {
    fijarToken(null);
    guardarToken(null);
    setSesion(null);
    setMotivo(razon);
  }, []);

  // Cuando la API responde que el token ya no sirve, se cierra la sesión y se explica por qué
  useEffect(() => {
    alPerderLaSesion((mensaje) => cerrarSesion(mensaje || 'Su sesión expiró. Ingrese de nuevo.'));
    return () => alPerderLaSesion(null);
  }, [cerrarSesion]);

  // Si había un token guardado (por ejemplo, tras recargar la página), se confirma con el servidor
  useEffect(() => {
    if (!tokenInicial) return undefined;
    let vigente = true;
    fijarToken(tokenInicial);
    api
      .get('/auth/me')
      .then(({ usuario }) => {
        if (vigente) setSesion({ token: tokenInicial, usuario });
      })
      .catch(() => {
        if (vigente) {
          fijarToken(null);
          guardarToken(null);
        }
      })
      .finally(() => {
        if (vigente) setVerificando(false);
      });
    return () => {
      vigente = false;
    };
  }, [tokenInicial]);

  const abrir = useCallback(({ token, usuario }) => {
    fijarToken(token);
    guardarToken(token);
    setSesion({ token, usuario });
    setMotivo('');
    return usuario;
  }, []);

  const iniciarSesion = useCallback(
    async (correo, contrasena) => abrir(await api.post('/auth/login', { correo, contrasena })),
    [abrir]
  );

  const registrar = useCallback(
    async (tipo, cuerpo) => abrir(await api.post(`/auth/registro/${tipo}`, cuerpo)),
    [abrir]
  );

  const valor = useMemo(
    () => ({ usuario: sesion ? sesion.usuario : null, motivo, iniciarSesion, registrar, cerrarSesion }),
    [sesion, motivo, iniciarSesion, registrar, cerrarSesion]
  );

  return (
    <ContextoSesion.Provider value={valor}>
      {verificando ? (
        <p className="cargando" role="status">
          Verificando su sesión…
        </p>
      ) : (
        children
      )}
    </ContextoSesion.Provider>
  );
}

export function useSesion() {
  const contexto = useContext(ContextoSesion);
  if (!contexto) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return contexto;
}
