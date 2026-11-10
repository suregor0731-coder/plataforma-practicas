import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Aviso, Cargando, InsigniaConvenio, TituloPagina, Vacio } from '../componentes.jsx';
import { fecha, textoDiasConvenio } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

/** La empresa consulta el estado de su convenio (solo lectura: lo administra Coordinación). */
export default function ConvenioEmpresa() {
  useTitulo('Convenio');
  const [convenios, setConvenios] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    api
      .get('/convenios')
      .then((respuesta) => {
        if (vigente) setConvenios(respuesta.datos);
      })
      .catch((fallo) => {
        if (vigente) setError(fallo.message);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const hayVigente = convenios ? convenios.some((c) => c.evaluacion.vigente) : false;

  return (
    <>
      <TituloPagina
        titulo="Convenio con la institución"
        descripcion="Coordinación valida este convenio antes de aprobar a los estudiantes que su empresa preseleccione."
      />
      <Aviso tipo="error">{error}</Aviso>
      {!convenios && !error ? <Cargando texto="Cargando su convenio…" /> : null}

      {convenios && convenios.length === 0 ? (
        <Vacio titulo="Su empresa aún no tiene un convenio registrado">
          <p>Las postulaciones a sus ofertas no podrán aprobarse hasta que Coordinación registre el convenio.</p>
        </Vacio>
      ) : null}

      {convenios && convenios.length > 0 ? (
        <>
          {hayVigente ? (
            <Aviso tipo="exito">Su empresa tiene un convenio vigente: las postulaciones preseleccionadas pueden aprobarse.</Aviso>
          ) : (
            <Aviso tipo="alerta">
              Su empresa no tiene un convenio vigente. Comuníquese con Coordinación para renovarlo; mientras tanto, las
              postulaciones no podrán aprobarse.
            </Aviso>
          )}
          <div className="tabla-envoltorio">
            <table>
              <caption className="solo-lectores">Convenios de la empresa</caption>
              <thead>
                <tr>
                  <th scope="col">Inicio</th>
                  <th scope="col">Fin</th>
                  <th scope="col">Vigencia hoy</th>
                </tr>
              </thead>
              <tbody>
                {convenios.map((convenio) => (
                  <tr key={convenio.id_convenio}>
                    <td>{fecha(convenio.fecha_inicio)}</td>
                    <td>{fecha(convenio.fecha_fin)}</td>
                    <td>
                      <InsigniaConvenio convenio={convenio.evaluacion} />
                      <small>{textoDiasConvenio(convenio.evaluacion)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
