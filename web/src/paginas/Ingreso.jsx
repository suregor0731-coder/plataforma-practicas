import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Aviso, Campo } from '../componentes.jsx';
import { rutaInicio, useSesion } from '../sesion.jsx';
import { useTitulo } from '../useTitulo.js';

const MOSTRAR_DEMO = typeof __MOSTRAR_DEMO__ !== 'undefined' && __MOSTRAR_DEMO__;
const CLAVE_DEMO = 'Demo2026*';
const CUENTAS_DEMO = [
  ['Estudiante', 'camila.restrepo@practicas.demo'],
  ['Empresa', 'rrhh@nododigital.demo'],
  ['Coordinación', 'coordinacion@practicas.demo'],
  ['Docente', 'docente@practicas.demo'],
];

export default function Ingreso() {
  useTitulo('Ingresar');
  const { usuario, motivo, iniciarSesion } = useSesion();
  const ubicacion = useLocation();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) {
    const destino = ubicacion.state && ubicacion.state.desde ? ubicacion.state.desde : rutaInicio(usuario.rol);
    return <Navigate to={destino} replace />;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setErrores({});
    setEnviando(true);
    try {
      await iniciarSesion(correo.trim(), contrasena);
    } catch (fallo) {
      if (fallo.estado === 422) setErrores(fallo.detalles);
      else setError(fallo.message);
      setEnviando(false);
    }
  }

  return (
    <div className="centrado">
      <form className="formulario-tarjeta" onSubmit={enviar} noValidate>
        <h1>Ingresar al portal</h1>
        <p>Use la cuenta con la que se registró.</p>
        <Aviso tipo="alerta">{motivo}</Aviso>
        <Aviso tipo="error">{error}</Aviso>
        <Campo id="ingreso-correo" etiqueta="Correo electrónico" error={errores.correo}>
          <input
            type="email"
            name="correo"
            autoComplete="username"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
        </Campo>
        <Campo id="ingreso-contrasena" etiqueta="Contraseña" error={errores.contrasena}>
          <input
            type="password"
            name="contrasena"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            required
          />
        </Campo>
        <button type="submit" className="boton boton--ancho" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="alterno">
          ¿Aún no tiene cuenta? <Link to="/registro">Cree una aquí</Link>
        </p>
      </form>

      {MOSTRAR_DEMO ? (
        <details className="demo">
          <summary>Cuentas de demostración</summary>
          <ul>
            {CUENTAS_DEMO.map(([rol, correoDemo]) => (
              <li key={correoDemo}>
                <span>
                  <strong>{rol}:</strong> {correoDemo}
                </span>
                <button
                  type="button"
                  className="boton boton--secundario boton--chico"
                  onClick={() => {
                    setCorreo(correoDemo);
                    setContrasena(CLAVE_DEMO);
                  }}
                >
                  Usar
                </button>
              </li>
            ))}
          </ul>
          <small>Contraseña de todas: {CLAVE_DEMO}. Son datos ficticios del entorno de desarrollo.</small>
        </details>
      ) : null}
    </div>
  );
}
