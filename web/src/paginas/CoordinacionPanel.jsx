import { useEffect, useState } from 'react';
import { api, descargarHojaDeVida } from '../api.js';
import {
  Aviso,
  Campo,
  Cargando,
  Dialogo,
  ESTADOS_PANEL,
  EstadoPostulacion,
  InsigniaConvenio,
  Paginacion,
  TituloPagina,
  Vacio,
} from '../componentes.jsx';
import { textoDiasConvenio } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

const VISTAS = [
  { clave: 'pendientes', texto: 'Pendientes', estados: 'preseleccionada,devuelta' },
  { clave: 'aprobadas', texto: 'Aprobadas', estados: 'aprobada' },
  { clave: 'rechazadas', texto: 'Rechazadas', estados: 'rechazada' },
  { clave: 'todas', texto: 'Todas', estados: ESTADOS_PANEL.join(',') },
];

const ACCIONES = {
  aprobar: { rotulo: 'Aprobar', titulo: 'Aprobar postulación', confirmar: 'Confirmar aprobación', obligatoria: false, clase: '' },
  rechazar: { rotulo: 'Rechazar', titulo: 'Rechazar postulación', confirmar: 'Confirmar rechazo', obligatoria: true, clase: ' boton--peligro' },
  devolver: { rotulo: 'Devolver', titulo: 'Devolver postulación', confirmar: 'Confirmar devolución', obligatoria: true, clase: ' boton--secundario' },
};

const PENDIENTES = ['preseleccionada', 'devuelta'];

/** Motivo por el que no se puede aprobar, según el estado del convenio de la empresa. */
function motivoSinConvenio(convenio) {
  if (convenio.estado === 'sin_convenio') return 'la empresa no tiene un convenio registrado.';
  if (convenio.estado === 'no_iniciado') return 'el convenio de la empresa aún no inicia.';
  return `el convenio de la empresa está ${convenio.etiqueta.toLowerCase()}.`;
}

function mensajeDeExito(accion, fila, resultado) {
  const aviso = 'Se generó la notificación para el estudiante y la empresa.';
  if (accion === 'aprobar') {
    const cierre = resultado.oferta_cerrada ? ' La oferta se cerró porque ya completó sus cupos.' : '';
    return `La postulación de ${fila.estudiante_nombre} quedó aprobada.${cierre} ${aviso}`;
  }
  if (accion === 'rechazar') return `La postulación de ${fila.estudiante_nombre} fue rechazada. ${aviso}`;
  return `La postulación de ${fila.estudiante_nombre} quedó devuelta mientras se regulariza el convenio de la empresa. ${aviso}`;
}

/** Panel de Coordinación: contadores, convenios por empresa y decisiones sobre las postulaciones (mockup G-3). */
export default function CoordinacionPanel() {
  useTitulo('Postulaciones');
  const [vista, setVista] = useState(VISTAS[0]);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [intento, setIntento] = useState(0);

  // Ventana de decisión
  const [decision, setDecision] = useState(null); // { fila, accion }
  const [observacion, setObservacion] = useState('');
  const [erroresDialogo, setErroresDialogo] = useState({});
  const [errorDialogo, setErrorDialogo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    api
      .get(`/coordinacion/panel?estado=${encodeURIComponent(vista.estados)}&pagina=${pagina}`)
      .then((respuesta) => {
        if (vigente) {
          setDatos(respuesta);
          setError('');
        }
      })
      .catch((fallo) => {
        if (vigente) setError(fallo.message);
      });
    return () => {
      vigente = false;
    };
  }, [vista, pagina, intento]);

  const abrirDecision = (fila, accion) => {
    setDecision({ fila, accion });
    setObservacion('');
    setErroresDialogo({});
    setErrorDialogo('');
  };

  const cerrarDecision = () => {
    setDecision(null);
    setEnviando(false);
  };

  async function confirmar(evento) {
    evento.preventDefault();
    setErrorDialogo('');
    setErroresDialogo({});
    setEnviando(true);
    try {
      const resultado = await api.post(`/postulaciones/${decision.fila.id_postulacion}/${decision.accion}`, {
        observacion,
      });
      setExito(mensajeDeExito(decision.accion, decision.fila, resultado));
      cerrarDecision();
      setIntento((n) => n + 1);
    } catch (fallo) {
      if (fallo.estado === 422) setErroresDialogo(fallo.detalles);
      else {
        setErrorDialogo(fallo.message);
        // Si el estado cambió mientras tanto (otra persona decidió, venció el convenio), se actualiza la tabla
        if (fallo.estado === 409) setIntento((n) => n + 1);
      }
      setEnviando(false);
    }
  }

  async function bajarHojaDeVida(fila) {
    setError('');
    try {
      await descargarHojaDeVida(fila.id_postulacion, fila.hoja_vida_nombre || 'hoja-de-vida.pdf');
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  const cambiarVista = (nueva) => {
    setVista(nueva);
    setPagina(1);
    setExito('');
  };

  const resumen = datos ? datos.resumen : null;
  const configuracion = decision ? ACCIONES[decision.accion] : null;

  return (
    <>
      <TituloPagina
        titulo="Postulaciones por aprobar"
        descripcion="Revise las postulaciones preseleccionadas por las empresas y valide su convenio antes de aprobarlas."
      />

      {resumen ? (
        <div className="contadores" role="list" aria-label="Resumen">
          <div className="contador" role="listitem">
            <strong>{resumen.pendientes}</strong>
            <span>Pendientes de aprobación</span>
          </div>
          <div className="contador" role="listitem">
            <strong>{resumen.aprobadas}</strong>
            <span>Prácticas aprobadas</span>
          </div>
          <div className="contador" role="listitem">
            <strong>{resumen.convenios.por_vencer}</strong>
            <span>Convenios por vencer</span>
          </div>
          <div className="contador" role="listitem">
            <strong>{resumen.convenios.sin_vigencia}</strong>
            <span>Empresas sin convenio vigente</span>
          </div>
        </div>
      ) : null}

      <Aviso tipo="exito">{exito}</Aviso>
      <Aviso tipo="error">{error}</Aviso>

      <div className="pestanas" role="group" aria-label="Filtrar por estado">
        {VISTAS.map((v) => (
          <button key={v.clave} type="button" className="pestana" aria-pressed={vista.clave === v.clave} onClick={() => cambiarVista(v)}>
            {v.texto}
          </button>
        ))}
      </div>

      {!datos && !error ? <Cargando texto="Cargando postulaciones…" /> : null}

      {datos && datos.datos.length === 0 ? (
        <Vacio titulo="No hay postulaciones en esta vista">
          <p>Cuando haya movimiento, las postulaciones aparecerán aquí.</p>
        </Vacio>
      ) : null}

      {datos && datos.datos.length > 0 ? (
        <>
          <div className="tabla-envoltorio">
            <table>
              <caption className="solo-lectores">Postulaciones</caption>
              <thead>
                <tr>
                  <th scope="col">Estudiante</th>
                  <th scope="col">Empresa</th>
                  <th scope="col">Oferta</th>
                  <th scope="col">Convenio</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((fila) => {
                  const bloqueada = PENDIENTES.includes(fila.estado_postulacion) && !fila.acciones.includes('aprobar');
                  return (
                    <tr key={fila.id_postulacion}>
                      <td>
                        {fila.estudiante_nombre}
                        <small>
                          {fila.estudiante_programa} · semestre {fila.estudiante_semestre}
                        </small>
                      </td>
                      <td>{fila.empresa_nombre}</td>
                      <td>{fila.oferta_titulo}</td>
                      <td>
                        <InsigniaConvenio convenio={fila.convenio} />
                        <small>{textoDiasConvenio(fila.convenio)}</small>
                      </td>
                      <td>
                        <EstadoPostulacion estado={fila.estado_postulacion} />
                        {fila.observacion_decision ? <small>{fila.observacion_decision}</small> : null}
                      </td>
                      <td>
                        <div className="acciones">
                          {fila.acciones.map((accion) => (
                            <button
                              key={accion}
                              type="button"
                              className={`boton boton--chico${ACCIONES[accion].clase}`}
                              onClick={() => abrirDecision(fila, accion)}
                            >
                              {ACCIONES[accion].rotulo}
                            </button>
                          ))}
                          {fila.hoja_vida_nombre ? (
                            <button type="button" className="boton boton--chico boton--secundario" onClick={() => bajarHojaDeVida(fila)}>
                              Hoja de vida
                            </button>
                          ) : null}
                        </div>
                        {bloqueada ? (
                          <small>Aprobar no está disponible: {motivoSinConvenio(fila.convenio)}</small>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion
            pagina={datos.paginacion.pagina}
            paginas={datos.paginacion.paginas}
            total={datos.paginacion.total}
            limite={datos.paginacion.limite}
            nombre="postulaciones"
            onCambiar={setPagina}
          />
        </>
      ) : null}

      <Dialogo abierto={Boolean(decision)} titulo={configuracion ? configuracion.titulo : ''} onCerrar={cerrarDecision}>
        {decision ? (
          <>
            <p>
              {decision.fila.estudiante_nombre} · {decision.fila.oferta_titulo} ({decision.fila.empresa_nombre})
            </p>
            <form onSubmit={confirmar} noValidate>
              <Aviso tipo="error">{errorDialogo}</Aviso>
              <Campo
                id="decision-observacion"
                etiqueta={configuracion.obligatoria ? 'Motivo (obligatorio)' : 'Observación (opcional)'}
                error={erroresDialogo.observacion}
              >
                <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={500} />
              </Campo>
              <div className="acciones">
                <button type="button" className="boton boton--secundario" onClick={cerrarDecision}>
                  Cancelar
                </button>
                <button type="submit" className={`boton${configuracion.clase}`} disabled={enviando}>
                  {enviando ? 'Guardando…' : configuracion.confirmar}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </Dialogo>
    </>
  );
}
