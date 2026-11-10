import { useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLES, rutaInicio, useSesion } from './sesion.jsx';

const MENUS = {
  estudiante: [
    ['/ofertas', 'Ofertas'],
    ['/mis-postulaciones', 'Mis postulaciones'],
  ],
  empresa: [
    ['/empresa/ofertas', 'Mis ofertas'],
    ['/empresa/publicar', 'Publicar oferta'],
    ['/empresa/convenio', 'Convenio'],
  ],
  coordinacion: [
    ['/coordinacion/postulaciones', 'Postulaciones'],
    ['/coordinacion/convenios', 'Convenios'],
  ],
  docente: [['/informes', 'Informes']],
};

/** Estructura común: barra superior con el menú del rol, contenido y pie. */
export default function Diseno() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  // Al cambiar de pantalla se vuelve al inicio de la página
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const salir = () => {
    cerrarSesion();
    navegar('/ingreso');
  };

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="encabezado">
        <div className="encabezado__interior">
          <Link className="marca" to="/">
            Portal de Prácticas Profesionales
          </Link>
          {usuario ? (
            <>
              <nav className="menu" aria-label="Principal">
                {(MENUS[usuario.rol] || []).map(([ruta, texto]) => (
                  <NavLink key={ruta} to={ruta}>
                    {texto}
                  </NavLink>
                ))}
              </nav>
              <div className="sesion">
                <span className="sesion__nombre">
                  {usuario.nombre || usuario.correo}
                  <span className="sesion__rol">{ROLES[usuario.rol]}</span>
                </span>
                <button type="button" className="boton boton--claro" onClick={salir}>
                  Salir
                </button>
              </div>
            </>
          ) : (
            <nav className="menu" aria-label="Principal">
              <NavLink to="/ingreso">Ingresar</NavLink>
              <NavLink to="/registro">Crear cuenta</NavLink>
            </nav>
          )}
        </div>
      </header>
      <main className="principal" id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="pie">
        Prototipo académico del taller integrador (Unidad 3). Los datos de demostración son ficticios.
      </footer>
    </>
  );
}

/** Protege un grupo de rutas: exige sesión y que el rol esté entre los permitidos. */
export function RutaProtegida({ roles }) {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  if (!usuario) {
    return <Navigate to="/ingreso" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  }
  if (!roles.includes(usuario.rol)) {
    return (
      <div className="estado-vacio">
        <h2>No tiene acceso a esta sección</h2>
        <p>Su rol ({ROLES[usuario.rol]}) no incluye esta pantalla.</p>
        <Link className="boton" to={rutaInicio(usuario.rol)}>
          Ir a mi página principal
        </Link>
      </div>
    );
  }
  return <Outlet />;
}

/** Ruta raíz: lleva a cada persona a su pantalla de inicio. */
export function Inicio() {
  const { usuario } = useSesion();
  return <Navigate to={usuario ? rutaInicio(usuario.rol) : '/ingreso'} replace />;
}
