import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { Aviso, Campo } from '../componentes.jsx';
import { rutaInicio, useSesion } from '../sesion.jsx';
import { useTitulo } from '../useTitulo.js';

const VACIO_ESTUDIANTE = { nombre: '', documento: '', correo: '', contrasena: '', id_programa: '', semestre: '' };
const VACIO_EMPRESA = { nombre: '', nit: '', sector: '', correo: '', contrasena: '' };

export default function Registro() {
  useTitulo('Crear cuenta');
  const { usuario, registrar } = useSesion();
  const [tipo, setTipo] = useState('estudiante');
  const [datos, setDatos] = useState(VACIO_ESTUDIANTE);
  const [acepta, setAcepta] = useState(false);
  const [programas, setProgramas] = useState([]);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .get('/programas')
      .then((respuesta) => setProgramas(respuesta.datos))
      .catch(() => setError('No se pudo cargar la lista de programas. Recargue la página.'));
  }, []);

  if (usuario) return <Navigate to={rutaInicio(usuario.rol)} replace />;

  const cambiarTipo = (nuevo) => {
    setTipo(nuevo);
    setDatos(nuevo === 'estudiante' ? VACIO_ESTUDIANTE : VACIO_EMPRESA);
    setErrores({});
    setError('');
  };

  const poner = (campo) => (evento) => setDatos((previo) => ({ ...previo, [campo]: evento.target.value }));

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setErrores({});
    setEnviando(true);
    const cuerpo =
      tipo === 'estudiante'
        ? {
            ...datos,
            id_programa: datos.id_programa ? Number(datos.id_programa) : null,
            semestre: datos.semestre ? Number(datos.semestre) : null,
            acepta_datos: acepta,
          }
        : { ...datos, acepta_datos: acepta };
    try {
      await registrar(tipo, cuerpo);
    } catch (fallo) {
      if (fallo.estado === 422) setErrores(fallo.detalles);
      else setError(fallo.message);
      setEnviando(false);
    }
  }

  return (
    <div className="centrado centrado--ancho">
      <form className="formulario-tarjeta" onSubmit={enviar} noValidate>
        <h1>Crear una cuenta</h1>
        <p>Elija el tipo de cuenta. Las cuentas de Coordinación y de docentes las crea la institución.</p>

        <div className="selector-tipo" role="group" aria-label="Tipo de cuenta">
          <button type="button" aria-pressed={tipo === 'estudiante'} onClick={() => cambiarTipo('estudiante')}>
            Soy estudiante
          </button>
          <button type="button" aria-pressed={tipo === 'empresa'} onClick={() => cambiarTipo('empresa')}>
            Soy una empresa
          </button>
        </div>

        <Aviso tipo="error">{error}</Aviso>

        {tipo === 'estudiante' ? (
          <div className="rejilla-campos">
            <Campo id="reg-nombre" etiqueta="Nombre completo" error={errores.nombre} className="ancho-completo">
              <input type="text" autoComplete="name" value={datos.nombre} onChange={poner('nombre')} required />
            </Campo>
            <Campo id="reg-documento" etiqueta="Documento de identidad" error={errores.documento} ayuda="Solo números.">
              <input type="text" inputMode="numeric" value={datos.documento} onChange={poner('documento')} required />
            </Campo>
            <Campo id="reg-semestre" etiqueta="Semestre actual" error={errores.semestre}>
              <select value={datos.semestre} onChange={poner('semestre')} required>
                <option value="">Seleccione…</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="reg-programa" etiqueta="Programa académico" error={errores.id_programa} className="ancho-completo">
              <select value={datos.id_programa} onChange={poner('id_programa')} required>
                <option value="">Seleccione…</option>
                {programas.map((p) => (
                  <option key={p.id_programa} value={p.id_programa}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        ) : (
          <div className="rejilla-campos">
            <Campo id="reg-razon" etiqueta="Razón social" error={errores.nombre} className="ancho-completo">
              <input type="text" autoComplete="organization" value={datos.nombre} onChange={poner('nombre')} required />
            </Campo>
            <Campo id="reg-nit" etiqueta="NIT" error={errores.nit} ayuda="Ejemplo: 900123456-7">
              <input type="text" value={datos.nit} onChange={poner('nit')} required />
            </Campo>
            <Campo id="reg-sector" etiqueta="Sector" error={errores.sector}>
              <input type="text" value={datos.sector} onChange={poner('sector')} required />
            </Campo>
          </div>
        )}

        <div className="rejilla-campos">
          <Campo
            id="reg-correo"
            etiqueta={tipo === 'estudiante' ? 'Correo institucional' : 'Correo de contacto'}
            error={errores.correo}
          >
            <input type="email" autoComplete="email" value={datos.correo} onChange={poner('correo')} required />
          </Campo>
          <Campo
            id="reg-contrasena"
            etiqueta="Contraseña"
            error={errores.contrasena}
            ayuda="Mínimo 8 caracteres, con letras y números."
          >
            <input type="password" autoComplete="new-password" value={datos.contrasena} onChange={poner('contrasena')} required />
          </Campo>
        </div>

        <label className={`casilla${errores.acepta_datos ? ' casilla--error' : ''}`}>
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            aria-invalid={errores.acepta_datos ? 'true' : undefined}
            aria-describedby={errores.acepta_datos ? 'reg-acepta-error' : undefined}
          />
          <span>Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.</span>
        </label>
        {errores.acepta_datos ? (
          <p className="campo__error" id="reg-acepta-error" style={{ marginTop: -8, marginBottom: 14 }}>
            {errores.acepta_datos}
          </p>
        ) : null}

        <button type="submit" className="boton boton--ancho" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="alterno">
          ¿Ya tiene cuenta? <Link to="/ingreso">Ingrese aquí</Link>
        </p>
      </form>
    </div>
  );
}
