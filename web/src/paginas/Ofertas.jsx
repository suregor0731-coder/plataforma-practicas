import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Aviso, Campo, Cargando, Paginacion, TituloPagina, Vacio } from '../componentes.jsx';
import { etiquetaModalidad, fecha, textoCupos } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

/** Listado de ofertas con búsqueda, filtros y paginación (mockup G-1). Los filtros viven en la URL. */
export default function Ofertas() {
  useTitulo('Ofertas de práctica');
  const [params, fijarParams] = useSearchParams();
  const [programas, setProgramas] = useState([]);
  const [respuesta, setRespuesta] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  // El texto y la ciudad se escriben libremente: se guardan aquí y se pasan a la URL tras una breve pausa
  const [texto, setTexto] = useState(params.get('texto') || '');
  const [ciudad, setCiudad] = useState(params.get('ciudad') || '');
  const aplicado = useRef({ texto, ciudad });

  const consulta = params.toString();
  const hayFiltros = ['texto', 'id_programa', 'ciudad', 'modalidad'].some((clave) => params.get(clave));

  const cambiar = useCallback(
    (cambios, { reemplazar = true } = {}) => {
      fijarParams(
        (previos) => {
          const siguientes = new URLSearchParams(previos);
          Object.entries(cambios).forEach(([clave, valor]) => {
            if (valor) siguientes.set(clave, valor);
            else siguientes.delete(clave);
          });
          if (!('pagina' in cambios)) siguientes.delete('pagina'); // al filtrar se vuelve a la primera página
          return siguientes;
        },
        { replace: reemplazar }
      );
    },
    [fijarParams]
  );

  useEffect(() => {
    api
      .get('/programas')
      .then((resultado) => setProgramas(resultado.datos))
      .catch(() => {
        // sin la lista de programas el filtro queda vacío, pero el listado sigue funcionando
      });
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api
      .get(`/ofertas${consulta ? `?${consulta}` : ''}`)
      .then((datos) => {
        if (vigente) setRespuesta(datos);
      })
      .catch((fallo) => {
        if (vigente) setError(fallo.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [consulta, intento]);

  // Pausa de 350 ms después de escribir antes de consultar
  useEffect(() => {
    const limpio = { texto: texto.trim(), ciudad: ciudad.trim() };
    if ((params.get('texto') || '') === limpio.texto && (params.get('ciudad') || '') === limpio.ciudad) return undefined;
    const temporizador = setTimeout(() => {
      aplicado.current = limpio;
      cambiar(limpio);
    }, 350);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, ciudad]);

  // Si la URL cambia por otra vía (botón Atrás, "Limpiar"), los campos se ajustan a ella
  useEffect(() => {
    const enUrl = { texto: params.get('texto') || '', ciudad: params.get('ciudad') || '' };
    if (enUrl.texto !== aplicado.current.texto || enUrl.ciudad !== aplicado.current.ciudad) {
      aplicado.current = enUrl;
      setTexto(enUrl.texto);
      setCiudad(enUrl.ciudad);
    }
  }, [params]);

  const limpiar = () => fijarParams(new URLSearchParams(), { replace: true });

  return (
    <>
      <TituloPagina
        titulo="Ofertas de práctica disponibles"
        descripcion="Busque y compare las oportunidades abiertas; después podrá postularse desde el detalle de cada una."
      />

      <form className="filtros" role="search" aria-label="Filtros de ofertas" onSubmit={(e) => e.preventDefault()}>
        <Campo id="filtro-texto" etiqueta="Buscar">
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cargo, empresa o palabra clave"
            maxLength={80}
          />
        </Campo>
        <Campo id="filtro-programa" etiqueta="Programa">
          <select value={params.get('id_programa') || ''} onChange={(e) => cambiar({ id_programa: e.target.value })}>
            <option value="">Todos los programas</option>
            {programas.map((p) => (
              <option key={p.id_programa} value={p.id_programa}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="filtro-ciudad" etiqueta="Ciudad">
          <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} maxLength={80} />
        </Campo>
        <Campo id="filtro-modalidad" etiqueta="Modalidad">
          <select value={params.get('modalidad') || ''} onChange={(e) => cambiar({ modalidad: e.target.value })}>
            <option value="">Todas</option>
            <option value="presencial">Presencial</option>
            <option value="hibrida">Híbrida</option>
            <option value="remota">Remota</option>
          </select>
        </Campo>
        <button type="button" className="boton boton--secundario" onClick={limpiar} disabled={!hayFiltros}>
          Limpiar
        </button>
      </form>

      {error ? (
        <Aviso tipo="error">
          {error}{' '}
          <button type="button" className="boton boton--chico boton--secundario" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </Aviso>
      ) : null}

      {cargando && !respuesta ? <Cargando texto="Cargando ofertas…" /> : null}

      {respuesta && respuesta.datos.length === 0 ? (
        <Vacio titulo="No hay ofertas que coincidan">
          <p>Pruebe con otras palabras o quite algún filtro.</p>
          {hayFiltros ? (
            <button type="button" className="boton boton--secundario" onClick={limpiar}>
              Limpiar filtros
            </button>
          ) : null}
        </Vacio>
      ) : null}

      {respuesta && respuesta.datos.length > 0 ? (
        <div aria-busy={cargando}>
          <ul className="rejilla-tarjetas">
            {respuesta.datos.map((oferta) => (
              <li key={oferta.id_oferta}>
                <article className="tarjeta">
                  <h2>{oferta.titulo}</h2>
                  <p className="tarjeta__empresa">{oferta.empresa_nombre}</p>
                  <p className="tarjeta__meta">
                    {oferta.ciudad} · {etiquetaModalidad(oferta.modalidad)}
                    {oferta.programa_nombre ? ` · ${oferta.programa_nombre}` : ''}
                  </p>
                  <div className="tarjeta__pie">
                    <span>
                      <span className="insignia insignia--azul">{textoCupos(oferta.cupos_disponibles)}</span>
                      {oferta.fecha_cierre ? <small> Cierra el {fecha(oferta.fecha_cierre)}</small> : null}
                    </span>
                    <Link className="boton boton--chico" to={`/ofertas/${oferta.id_oferta}`}>
                      Ver detalle
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <Paginacion
            pagina={respuesta.paginacion.pagina}
            paginas={respuesta.paginacion.paginas}
            total={respuesta.paginacion.total}
            limite={respuesta.paginacion.limite}
            nombre="ofertas"
            onCambiar={(n) => cambiar({ pagina: String(n) }, { reemplazar: false })}
          />
        </div>
      ) : null}
    </>
  );
}
