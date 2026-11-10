import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Aviso, Cargando, EstadoPostulacion, TituloPagina, Vacio } from '../componentes.jsx';
import { etiquetaModalidad, fecha } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

export default function MisPostulaciones() {
  useTitulo('Mis postulaciones');
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    api
      .get('/postulaciones/mias')
      .then((respuesta) => {
        if (vigente) setFilas(respuesta.datos);
      })
      .catch((fallo) => {
        if (vigente) setError(fallo.message);
      });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <>
      <TituloPagina
        titulo="Mis postulaciones"
        descripcion="Aquí puede seguir en qué estado va cada una de sus solicitudes."
      />
      <Aviso tipo="error">{error}</Aviso>
      {!filas && !error ? <Cargando texto="Cargando sus postulaciones…" /> : null}

      {filas && filas.length === 0 ? (
        <Vacio titulo="Todavía no se ha postulado a ninguna oferta">
          <p>Cuando se postule, la solicitud aparecerá aquí con su estado.</p>
          <Link className="boton" to="/ofertas">
            Ver ofertas
          </Link>
        </Vacio>
      ) : null}

      {filas && filas.length > 0 ? (
        <div className="tabla-envoltorio">
          <table>
            <caption className="solo-lectores">Postulaciones del estudiante</caption>
            <thead>
              <tr>
                <th scope="col">Oferta</th>
                <th scope="col">Ciudad y modalidad</th>
                <th scope="col">Fecha de postulación</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id_postulacion}>
                  <td>
                    <Link to={`/ofertas/${fila.id_oferta}`}>{fila.oferta_titulo}</Link>
                    <small>{fila.empresa_nombre}</small>
                  </td>
                  <td>
                    {fila.ciudad} · {etiquetaModalidad(fila.modalidad)}
                  </td>
                  <td>{fecha(fila.fecha_postulacion)}</td>
                  <td>
                    <EstadoPostulacion estado={fila.estado_postulacion} />
                    {fila.observacion_decision ? <small>{fila.observacion_decision}</small> : null}
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
