import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, descargarHojaDeVida } from '../api.js';
import { Aviso, Cargando, EstadoOferta, EstadoPostulacion, TituloPagina, Vacio } from '../componentes.jsx';
import { fecha } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

const ROTULOS = { preseleccionar: 'Preseleccionar', descartar: 'Descartar' };

export default function EmpresaPostulantes() {
  const { id } = useParams();
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [trabajando, setTrabajando] = useState(null);

  useTitulo(resultado ? `Postulantes: ${resultado.oferta.titulo}` : 'Postulantes');

  const cargar = useCallback(() => {
    api
      .get(`/ofertas/${id}/postulaciones`)
      .then(setResultado)
      .catch((fallo) => setError(fallo.message));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function decidir(postulacion, accion) {
    setError('');
    setExito('');
    setTrabajando(postulacion.id_postulacion);
    try {
      await api.post(`/postulaciones/${postulacion.id_postulacion}/${accion}`);
      setExito(
        accion === 'preseleccionar'
          ? `${postulacion.estudiante_nombre} quedó preseleccionado(a). Coordinación recibió el aviso para validar el convenio.`
          : `La postulación de ${postulacion.estudiante_nombre} fue descartada.`
      );
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setTrabajando(null);
    }
  }

  async function bajarHojaDeVida(postulacion) {
    setError('');
    try {
      await descargarHojaDeVida(postulacion.id_postulacion, postulacion.hoja_vida_nombre || 'hoja-de-vida.pdf');
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  if (!resultado && !error) return <Cargando texto="Cargando postulantes…" />;
  if (!resultado) {
    return (
      <>
        <Link className="volver" to="/empresa/ofertas">
          ‹ Volver a mis ofertas
        </Link>
        <Aviso tipo="error">{error}</Aviso>
      </>
    );
  }

  const { oferta, datos } = resultado;

  return (
    <>
      <Link className="volver" to="/empresa/ofertas">
        ‹ Volver a mis ofertas
      </Link>
      <TituloPagina
        titulo={`Postulantes: ${oferta.titulo}`}
        descripcion={`${oferta.aprobadas} de ${oferta.cupos} cupos aprobados por Coordinación.`}
      >
        <EstadoOferta estado={oferta.estado} />
      </TituloPagina>
      <Aviso tipo="exito">{exito}</Aviso>
      <Aviso tipo="error">{error}</Aviso>

      {datos.length === 0 ? (
        <Vacio titulo="Esta oferta aún no tiene postulantes">
          <p>Cuando un estudiante se postule, aparecerá aquí con su hoja de vida.</p>
        </Vacio>
      ) : (
        <div className="tabla-envoltorio">
          <table>
            <caption className="solo-lectores">Postulantes de la oferta</caption>
            <thead>
              <tr>
                <th scope="col">Estudiante</th>
                <th scope="col">Postulación</th>
                <th scope="col">Hoja de vida</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((fila) => (
                <tr key={fila.id_postulacion}>
                  <td>
                    {fila.estudiante_nombre}
                    <small>
                      {fila.estudiante_programa} · semestre {fila.estudiante_semestre}
                    </small>
                    <small>{fila.estudiante_correo}</small>
                  </td>
                  <td>
                    {fecha(fila.fecha_postulacion)}
                    {fila.carta_presentacion ? (
                      <details className="carta">
                        <summary>Ver carta</summary>
                        <p>{fila.carta_presentacion}</p>
                      </details>
                    ) : (
                      <small>Sin carta</small>
                    )}
                  </td>
                  <td>
                    {fila.hoja_vida_nombre ? (
                      <button type="button" className="boton boton--chico boton--secundario" onClick={() => bajarHojaDeVida(fila)}>
                        Descargar PDF
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <EstadoPostulacion estado={fila.estado_postulacion} />
                  </td>
                  <td>
                    {fila.acciones.length === 0 ? (
                      '—'
                    ) : (
                      <div className="acciones">
                        {fila.acciones.map((accion) => (
                          <button
                            key={accion}
                            type="button"
                            className={`boton boton--chico${accion === 'descartar' ? ' boton--peligro' : ''}`}
                            disabled={trabajando === fila.id_postulacion}
                            onClick={() => decidir(fila, accion)}
                          >
                            {ROTULOS[accion] || accion}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
