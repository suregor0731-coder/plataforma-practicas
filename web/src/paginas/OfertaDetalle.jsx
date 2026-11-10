import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, leerComoBase64 } from '../api.js';
import {
  Aviso,
  Campo,
  Cargando,
  EstadoOferta,
  EstadoPostulacion,
  InsigniaConvenio,
  SelectorArchivo,
} from '../componentes.jsx';
import { etiquetaModalidad, fecha, lineas, parrafos, textoCuposDisponibles } from '../formato.js';
import { useSesion } from '../sesion.jsx';
import { useTitulo } from '../useTitulo.js';

const MAX_BYTES = 2 * 1024 * 1024; // mismo límite que aplica el servidor

/** Detalle de una oferta y, para estudiantes, el formulario de postulación (mockup G-2). */
export default function OfertaDetalle() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const [oferta, setOferta] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [creada, setCreada] = useState(null);

  useTitulo(oferta ? oferta.titulo : 'Detalle de la oferta');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api
      .get(`/ofertas/${id}`)
      .then((datos) => {
        if (vigente) setOferta(datos);
      })
      .catch((fallo) => {
        if (vigente) setError(fallo.estado === 404 ? 'La oferta que busca no existe o fue retirada.' : fallo.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [id, intento]);

  if (cargando && !oferta) return <Cargando texto="Cargando la oferta…" />;
  if (error && !oferta) {
    return (
      <>
        <Link className="volver" to="/ofertas">
          ‹ Volver a ofertas
        </Link>
        <Aviso tipo="error">{error}</Aviso>
      </>
    );
  }
  if (!oferta) return null;

  const requisitos = lineas(oferta.requisitos);
  const esDuena = usuario.rol === 'empresa' && usuario.id_empresa === oferta.id_empresa;

  return (
    <>
      <Link className="volver" to={esDuena ? '/empresa/ofertas' : '/ofertas'}>
        ‹ Volver a {esDuena ? 'mis ofertas' : 'ofertas'}
      </Link>
      <div className="detalle">
        <article className="detalle__cuerpo">
          <h1>{oferta.titulo}</h1>
          <p className="detalle__meta">
            {oferta.empresa_nombre} · {oferta.ciudad} ({etiquetaModalidad(oferta.modalidad)}) ·{' '}
            {textoCuposDisponibles(oferta.cupos_disponibles)}
          </p>
          <p>
            <InsigniaConvenio convenio={oferta.convenio} completa />
          </p>

          <h2>Descripción</h2>
          {parrafos(oferta.descripcion).map((parrafo, i) => (
            <p key={i}>{parrafo}</p>
          ))}

          {requisitos.length > 0 ? (
            <>
              <h2>Requisitos</h2>
              <ul>
                {requisitos.map((requisito, i) => (
                  <li key={i}>{requisito}</li>
                ))}
              </ul>
            </>
          ) : null}

          <h2>Información de la oferta</h2>
          <ul>
            <li>Dirigida a: {oferta.programa_nombre || 'cualquier programa'}</li>
            <li>Sector de la empresa: {oferta.empresa_sector}</li>
            <li>Publicada el {fecha(oferta.fecha_publicacion)}</li>
            <li>{oferta.fecha_cierre ? `Cierra el ${fecha(oferta.fecha_cierre)}` : 'Sin fecha de cierre'}</li>
          </ul>
        </article>

        <aside className="panel-lateral" aria-label="Postulación">
          {usuario.rol === 'estudiante' ? (
            <PanelEstudiante
              oferta={oferta}
              creada={creada}
              onPostulado={(resultado) => {
                setCreada(resultado);
                setIntento((n) => n + 1);
              }}
              onRecargar={() => setIntento((n) => n + 1)}
            />
          ) : esDuena ? (
            <>
              <h2>Gestión de la oferta</h2>
              <p style={{ marginBottom: 12 }}>
                Estado: <EstadoOferta estado={oferta.estado} />
              </p>
              <p style={{ marginBottom: 14 }}>
                {oferta.aprobadas} de {oferta.cupos} cupos aprobados.
              </p>
              <div className="acciones">
                <Link className="boton" to={`/empresa/ofertas/${oferta.id_oferta}/postulantes`}>
                  Ver postulantes
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>Postulación</h2>
              <p>Solo las cuentas de estudiante pueden postularse a una oferta.</p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function PanelEstudiante({ oferta, creada, onPostulado, onRecargar }) {
  const navegar = useNavigate();
  const [archivo, setArchivo] = useState(null);
  const [carta, setCarta] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (creada) {
    return (
      <>
        <h2>Postulación enviada</h2>
        <Aviso tipo="exito">
          Su postulación quedó registrada y la empresa recibió el aviso. Puede seguir su estado en “Mis postulaciones”.
        </Aviso>
        <div className="acciones">
          <Link className="boton" to="/mis-postulaciones">
            Ver mis postulaciones
          </Link>
        </div>
      </>
    );
  }

  if (oferta.mi_postulacion) {
    return (
      <>
        <h2>Ya se postuló a esta oferta</h2>
        <p style={{ marginBottom: 14 }}>
          Estado actual: <EstadoPostulacion estado={oferta.mi_postulacion.estado_postulacion} />
        </p>
        <div className="acciones">
          <Link className="boton" to="/mis-postulaciones">
            Ver mis postulaciones
          </Link>
        </div>
      </>
    );
  }

  if (!oferta.disponibilidad.disponible) {
    return (
      <>
        <h2>Postulación no disponible</h2>
        <Aviso tipo="alerta">{oferta.disponibilidad.mensaje}</Aviso>
        <div className="acciones">
          <Link className="boton boton--secundario" to="/ofertas">
            Buscar otras ofertas
          </Link>
        </div>
      </>
    );
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    const nuevos = {};
    if (!archivo) nuevos.hoja_vida = 'Adjunte su hoja de vida en formato PDF.';
    else if (!/\.pdf$/i.test(archivo.name)) nuevos.hoja_vida = 'El archivo debe tener extensión .pdf.';
    else if (archivo.size > MAX_BYTES) nuevos.hoja_vida = 'La hoja de vida no puede superar 2 MB.';
    if (!acepta) nuevos.acepta_datos = 'Debe autorizar el tratamiento de sus datos personales.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setEnviando(true);
    try {
      const contenido = await leerComoBase64(archivo);
      const resultado = await api.post(`/ofertas/${oferta.id_oferta}/postulaciones`, {
        carta_presentacion: carta,
        acepta_datos: true,
        hoja_vida: { nombre: archivo.name, contenido_base64: contenido },
      });
      onPostulado(resultado);
    } catch (fallo) {
      if (fallo.estado === 422) setErrores(fallo.detalles);
      else {
        setError(fallo.message);
        // Si cambió el estado de la oferta (duplicada, cerrada, sin cupos) se refresca el panel
        if (fallo.estado === 409) onRecargar();
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <h2>Postularme a esta oferta</h2>
      <Aviso tipo="error">{error}</Aviso>
      <Campo id="post-hoja" etiqueta="Hoja de vida (PDF, máximo 2 MB)" error={errores.hoja_vida}>
        <SelectorArchivo archivo={archivo} onElegir={setArchivo} accept="application/pdf,.pdf" />
      </Campo>
      <Campo id="post-carta" etiqueta="Carta de presentación (opcional)" error={errores.carta_presentacion}>
        <textarea
          value={carta}
          onChange={(e) => setCarta(e.target.value)}
          maxLength={1500}
          placeholder="Escriba un mensaje breve para la empresa…"
        />
      </Campo>
      <span className="contador-caracteres" style={{ display: 'block', marginTop: -10, marginBottom: 14, textAlign: 'right' }}>
        {carta.length} / 1500
      </span>
      <label className={`casilla${errores.acepta_datos ? ' casilla--error' : ''}`}>
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          aria-invalid={errores.acepta_datos ? 'true' : undefined}
        />
        <span>Autorizo el tratamiento de mis datos personales (Ley 1581 de 2012).</span>
      </label>
      {errores.acepta_datos ? (
        <p className="campo__error" style={{ marginTop: -8, marginBottom: 14 }}>
          {errores.acepta_datos}
        </p>
      ) : null}
      <div className="acciones">
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar postulación'}
        </button>
        <button type="button" className="boton boton--secundario" onClick={() => navegar('/ofertas')}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
