import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { Aviso, Cargando, EstadoOferta, TituloPagina, Vacio } from '../componentes.jsx';
import { etiquetaModalidad, fecha } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

export default function EmpresaOfertas() {
  useTitulo('Mis ofertas');
  const ubicacion = useLocation();
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(ubicacion.state && ubicacion.state.aviso ? ubicacion.state.aviso : '');
  const [trabajando, setTrabajando] = useState(null);

  const cargar = useCallback(() => {
    api
      .get('/ofertas/mias')
      .then((respuesta) => setFilas(respuesta.datos))
      .catch((fallo) => setError(fallo.message));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(oferta, estado) {
    setError('');
    setExito('');
    setTrabajando(oferta.id_oferta);
    try {
      await api.patch(`/ofertas/${oferta.id_oferta}/estado`, { estado });
      setExito(estado === 'cerrada' ? 'La oferta se cerró y ya no recibe postulaciones.' : 'La oferta volvió a abrirse.');
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <>
      <TituloPagina titulo="Mis ofertas" descripcion="Ofertas publicadas por su empresa y el avance de sus postulaciones.">
        <Link className="boton" to="/empresa/publicar">
          Publicar oferta
        </Link>
      </TituloPagina>
      <Aviso tipo="exito">{exito}</Aviso>
      <Aviso tipo="error">{error}</Aviso>
      {!filas && !error ? <Cargando texto="Cargando sus ofertas…" /> : null}

      {filas && filas.length === 0 ? (
        <Vacio titulo="Aún no ha publicado ofertas">
          <p>Publique la primera para empezar a recibir postulaciones de estudiantes.</p>
          <Link className="boton" to="/empresa/publicar">
            Publicar oferta
          </Link>
        </Vacio>
      ) : null}

      {filas && filas.length > 0 ? (
        <div className="tabla-envoltorio">
          <table>
            <caption className="solo-lectores">Ofertas publicadas por la empresa</caption>
            <thead>
              <tr>
                <th scope="col">Oferta</th>
                <th scope="col">Estado</th>
                <th scope="col">Postulantes</th>
                <th scope="col">Aprobados / cupos</th>
                <th scope="col">Cierre</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((oferta) => (
                <tr key={oferta.id_oferta}>
                  <td>
                    <Link to={`/ofertas/${oferta.id_oferta}`}>{oferta.titulo}</Link>
                    <small>
                      {oferta.ciudad} · {etiquetaModalidad(oferta.modalidad)}
                    </small>
                  </td>
                  <td>
                    <EstadoOferta estado={oferta.estado} />
                  </td>
                  <td>{oferta.postulantes}</td>
                  <td>
                    {oferta.aprobadas} / {oferta.cupos}
                  </td>
                  <td>{oferta.fecha_cierre ? fecha(oferta.fecha_cierre) : 'Sin fecha'}</td>
                  <td>
                    <div className="acciones">
                      <Link className="boton boton--chico" to={`/empresa/ofertas/${oferta.id_oferta}/postulantes`}>
                        Ver postulantes
                      </Link>
                      {oferta.estado === 'abierta' ? (
                        <button
                          type="button"
                          className="boton boton--chico boton--secundario"
                          disabled={trabajando === oferta.id_oferta}
                          onClick={() => cambiarEstado(oferta, 'cerrada')}
                        >
                          Cerrar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="boton boton--chico boton--secundario"
                          disabled={trabajando === oferta.id_oferta}
                          onClick={() => cambiarEstado(oferta, 'abierta')}
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
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
