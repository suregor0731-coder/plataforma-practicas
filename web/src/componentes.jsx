import { cloneElement, useEffect, useRef } from 'react';
import { textoDiasConvenio } from './formato.js';

/* ---------- Insignias de estado ---------- */

const ESTADOS_POSTULACION = {
  enviada: ['Enviada', 'azul'],
  preseleccionada: ['Preseleccionada', 'azul-fuerte'],
  descartada: ['Descartada', 'gris'],
  aprobada: ['Aprobada', 'verde'],
  rechazada: ['Rechazada', 'rojo'],
  devuelta: ['Devuelta', 'ambar'],
};

export const ESTADOS_PANEL = Object.keys(ESTADOS_POSTULACION);

export function EstadoPostulacion({ estado }) {
  const [etiqueta, tono] = ESTADOS_POSTULACION[estado] || [estado, 'gris'];
  return <span className={`insignia insignia--${tono}`}>{etiqueta}</span>;
}

const TONOS_CONVENIO = {
  vigente: 'verde',
  por_vencer: 'ambar',
  vencido: 'rojo',
  suspendido: 'rojo',
  terminado: 'rojo',
  no_iniciado: 'gris',
  sin_convenio: 'rojo',
};

/** Insignia del convenio de una empresa; "completa" antepone la palabra "Convenio" (p. ej. "Convenio vigente"). */
export function InsigniaConvenio({ convenio, completa = false }) {
  if (!convenio) return null;
  const tono = TONOS_CONVENIO[convenio.estado] || 'gris';
  const texto =
    completa && convenio.estado !== 'sin_convenio' ? `Convenio ${convenio.etiqueta.toLowerCase()}` : convenio.etiqueta;
  return (
    <span className={`insignia insignia--${tono}`} title={textoDiasConvenio(convenio) || undefined}>
      {texto}
    </span>
  );
}

export function EstadoOferta({ estado }) {
  return estado === 'abierta' ? (
    <span className="insignia insignia--verde">Abierta</span>
  ) : (
    <span className="insignia insignia--gris">Cerrada</span>
  );
}

/* ---------- Mensajes y estados de carga ---------- */

export function Aviso({ tipo = 'info', children }) {
  if (!children) return null;
  // Los errores se anuncian de inmediato a los lectores de pantalla; el resto, cuando haya una pausa
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <p className="cargando" role="status" aria-busy="true">
      {texto}
    </p>
  );
}

export function Vacio({ titulo, children }) {
  return (
    <div className="estado-vacio">
      <h2>{titulo}</h2>
      {children}
    </div>
  );
}

export function TituloPagina({ titulo, descripcion, children }) {
  return (
    <div className="cabecera-pagina">
      <div>
        <h1>{titulo}</h1>
        {descripcion ? <p>{descripcion}</p> : null}
      </div>
      {children}
    </div>
  );
}

/* ---------- Formularios ---------- */

/** Etiqueta + control + mensaje de ayuda o error, con los atributos de accesibilidad ya conectados. */
export function Campo({ id, etiqueta, error, ayuda, className = '', children }) {
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
  const control = cloneElement(children, {
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': descripcion,
  });
  return (
    <div className={`campo${error ? ' campo--error' : ''} ${className}`.trim()}>
      <label htmlFor={id}>{etiqueta}</label>
      {control}
      {ayuda && !error ? (
        <p className="campo__ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p className="campo__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Selector de archivo con texto propio. Recibe "id", "aria-invalid" y "aria-describedby" desde <Campo>
 * y los pasa al <input type="file"> real, que queda transparente sobre el botón visible.
 */
export function SelectorArchivo({ archivo, onElegir, accept, ...atributos }) {
  return (
    <div className={`archivo${archivo ? ' archivo--elegido' : ''}`}>
      <input type="file" accept={accept} onChange={(e) => onElegir(e.target.files[0] || null)} {...atributos} />
      <span className="boton boton--secundario boton--chico" aria-hidden="true">
        Seleccionar archivo
      </span>
      <span className="archivo__nombre">{archivo ? archivo.name : 'Ningún archivo'}</span>
    </div>
  );
}

/* ---------- Paginación ---------- */

function paginasVisibles(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const conjunto = new Set([1, total, actual - 1, actual, actual + 1]);
  const orden = [...conjunto].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultado = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1] > 1) resultado.push('…');
    resultado.push(n);
  });
  return resultado;
}

export function Paginacion({ pagina, paginas, total, limite, nombre = 'resultados', onCambiar }) {
  if (!total) return null;
  const desde = (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, total);
  return (
    <nav className="paginacion" aria-label="Paginación">
      <p>
        Mostrando {desde}–{hasta} de {total} {nombre}
      </p>
      {paginas > 1 ? (
        <ul>
          <li>
            <button type="button" onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1}>
              ‹ Anterior
            </button>
          </li>
          {paginasVisibles(pagina, paginas).map((n, i) =>
            n === '…' ? (
              <li key={`salto-${i}`} aria-hidden="true">
                …
              </li>
            ) : (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => onCambiar(n)}
                  aria-current={n === pagina ? 'page' : undefined}
                  aria-label={`Página ${n}`}
                >
                  {n}
                </button>
              </li>
            )
          )}
          <li>
            <button type="button" onClick={() => onCambiar(pagina + 1)} disabled={pagina >= paginas}>
              Siguiente ›
            </button>
          </li>
        </ul>
      ) : null}
    </nav>
  );
}

/* ---------- Diálogo modal ---------- */

/** Ventana modal basada en el elemento <dialog>: el navegador se encarga del foco, de Esc y del fondo. */
export function Dialogo({ abierto, titulo, onCerrar, children }) {
  const referencia = useRef(null);

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={referencia}
      className="dialogo"
      aria-labelledby="dialogo-titulo"
      onClose={onCerrar}
      onClick={(evento) => {
        // Un clic sobre el fondo (el propio <dialog>) cierra la ventana
        if (evento.target === referencia.current) onCerrar();
      }}
    >
      {abierto ? (
        <div className="dialogo__cuerpo">
          <h2 id="dialogo-titulo">{titulo}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
