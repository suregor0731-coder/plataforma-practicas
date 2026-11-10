import { TituloPagina, Vacio } from '../componentes.jsx';
import { useTitulo } from '../useTitulo.js';

/** Marcador del módulo de informes (parcial y final), que queda para la siguiente iteración. */
export default function Informes() {
  useTitulo('Informes');
  return (
    <>
      <TituloPagina titulo="Informes de práctica" />
      <Vacio titulo="Este módulo se construye en la siguiente iteración">
        <p>
          El registro y la evaluación de los informes parcial y final dependen de que haya estudiantes con práctica
          aprobada. En esta entrega se implementaron las cuentas por rol, las ofertas con sus postulaciones y la
          aprobación con validación de convenio.
        </p>
      </Vacio>
    </>
  );
}
