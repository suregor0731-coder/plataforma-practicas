import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Aviso, Campo, Cargando, InsigniaConvenio, TituloPagina, Vacio } from '../componentes.jsx';
import { fecha, textoDiasConvenio } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

const ESTADOS = { vigente: 'Vigente', suspendido: 'Suspendido', terminado: 'Terminado' };

// Cambios de estado que se pueden hacer desde cada estado registrado
const CAMBIOS = {
  vigente: [
    ['suspendido', 'Suspender', 'boton--secundario'],
    ['terminado', 'Terminar', 'boton--peligro'],
  ],
  suspendido: [
    ['vigente', 'Reactivar', ''],
    ['terminado', 'Terminar', 'boton--peligro'],
  ],
  terminado: [],
};

const VACIO = { id_empresa: '', fecha_inicio: '', fecha_fin: '' };

/** Coordinación registra convenios y cambia su estado; la vigencia se calcula con las fechas. */
export default function ConveniosCoordinacion() {
  useTitulo('Convenios');
  const [convenios, setConvenios] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [trabajando, setTrabajando] = useState(null);

  const cargar = useCallback(() => {
    api
      .get('/convenios')
      .then((respuesta) => setConvenios(respuesta.datos))
      .catch((fallo) => setError(fallo.message));
  }, []);

  useEffect(() => {
    cargar();
    api
      .get('/empresas')
      .then((respuesta) => setEmpresas(respuesta.datos))
      .catch((fallo) => setError(fallo.message));
  }, [cargar]);

  const poner = (campo) => (evento) => setDatos((previo) => ({ ...previo, [campo]: evento.target.value }));

  async function registrar(evento) {
    evento.preventDefault();
    setError('');
    setExito('');
    setErrores({});
    setEnviando(true);
    try {
      const creado = await api.post('/convenios', { ...datos, id_empresa: datos.id_empresa ? Number(datos.id_empresa) : null });
      setExito(`Se registró el convenio de ${creado.empresa_nombre} (${fecha(creado.fecha_inicio)} al ${fecha(creado.fecha_fin)}).`);
      setDatos(VACIO);
      cargar();
    } catch (fallo) {
      if (fallo.estado === 422) setErrores(fallo.detalles);
      else setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarEstado(convenio, estado) {
    setError('');
    setExito('');
    setTrabajando(convenio.id_convenio);
    try {
      await api.patch(`/convenios/${convenio.id_convenio}/estado`, { estado });
      setExito(`El convenio de ${convenio.empresa_nombre} quedó ${ESTADOS[estado].toLowerCase()}.`);
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <>
      <TituloPagina
        titulo="Convenios con empresas"
        descripcion="Una postulación solo puede aprobarse si el convenio de la empresa está vigente en la fecha de la decisión."
      />
      <Aviso tipo="exito">{exito}</Aviso>
      <Aviso tipo="error">{error}</Aviso>

      <form className="formulario-tarjeta" onSubmit={registrar} noValidate style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 14 }}>Registrar un convenio</h2>
        <div className="rejilla-campos" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <Campo id="conv-empresa" etiqueta="Empresa" error={errores.id_empresa}>
            <select value={datos.id_empresa} onChange={poner('id_empresa')} required>
              <option value="">Seleccione…</option>
              {empresas.map((e) => (
                <option key={e.id_empresa} value={e.id_empresa}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="conv-inicio" etiqueta="Fecha de inicio" error={errores.fecha_inicio}>
            <input type="date" value={datos.fecha_inicio} onChange={poner('fecha_inicio')} required />
          </Campo>
          <Campo id="conv-fin" etiqueta="Fecha de fin" error={errores.fecha_fin}>
            <input type="date" value={datos.fecha_fin} onChange={poner('fecha_fin')} required />
          </Campo>
        </div>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar convenio'}
        </button>
      </form>

      {!convenios && !error ? <Cargando texto="Cargando convenios…" /> : null}

      {convenios && convenios.length === 0 ? (
        <Vacio titulo="Todavía no hay convenios registrados">
          <p>Registre el primero con el formulario de arriba.</p>
        </Vacio>
      ) : null}

      {convenios && convenios.length > 0 ? (
        <div className="tabla-envoltorio">
          <table>
            <caption className="solo-lectores">Convenios registrados</caption>
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Inicio</th>
                <th scope="col">Fin</th>
                <th scope="col">Estado registrado</th>
                <th scope="col">Vigencia hoy</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {convenios.map((convenio) => (
                <tr key={convenio.id_convenio}>
                  <td>{convenio.empresa_nombre}</td>
                  <td>{fecha(convenio.fecha_inicio)}</td>
                  <td>{fecha(convenio.fecha_fin)}</td>
                  <td>{ESTADOS[convenio.estado] || convenio.estado}</td>
                  <td>
                    <InsigniaConvenio convenio={convenio.evaluacion} />
                    <small>{textoDiasConvenio(convenio.evaluacion)}</small>
                  </td>
                  <td>
                    {CAMBIOS[convenio.estado] && CAMBIOS[convenio.estado].length > 0 ? (
                      <div className="acciones">
                        {CAMBIOS[convenio.estado].map(([estado, rotulo, clase]) => (
                          <button
                            key={estado}
                            type="button"
                            className={`boton boton--chico ${clase}`.trim()}
                            disabled={trabajando === convenio.id_convenio}
                            onClick={() => cambiarEstado(convenio, estado)}
                          >
                            {rotulo}
                          </button>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
