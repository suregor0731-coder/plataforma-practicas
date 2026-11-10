import { Route, Routes } from 'react-router-dom';
import Diseno, { Inicio, RutaProtegida } from './Diseno.jsx';
import Ingreso from './paginas/Ingreso.jsx';
import Registro from './paginas/Registro.jsx';
import Ofertas from './paginas/Ofertas.jsx';
import OfertaDetalle from './paginas/OfertaDetalle.jsx';
import MisPostulaciones from './paginas/MisPostulaciones.jsx';
import EmpresaOfertas from './paginas/EmpresaOfertas.jsx';
import EmpresaPublicar from './paginas/EmpresaPublicar.jsx';
import EmpresaPostulantes from './paginas/EmpresaPostulantes.jsx';
import ConvenioEmpresa from './paginas/ConvenioEmpresa.jsx';
import CoordinacionPanel from './paginas/CoordinacionPanel.jsx';
import ConveniosCoordinacion from './paginas/ConveniosCoordinacion.jsx';
import Informes from './paginas/Informes.jsx';
import NoEncontrada from './paginas/NoEncontrada.jsx';

const TODOS = ['estudiante', 'empresa', 'coordinacion', 'docente'];

export default function App() {
  return (
    <Routes>
      <Route element={<Diseno />}>
        <Route index element={<Inicio />} />
        <Route path="ingreso" element={<Ingreso />} />
        <Route path="registro" element={<Registro />} />

        <Route element={<RutaProtegida roles={TODOS} />}>
          <Route path="ofertas" element={<Ofertas />} />
          <Route path="ofertas/:id" element={<OfertaDetalle />} />
        </Route>

        <Route element={<RutaProtegida roles={['estudiante']} />}>
          <Route path="mis-postulaciones" element={<MisPostulaciones />} />
        </Route>

        <Route element={<RutaProtegida roles={['empresa']} />}>
          <Route path="empresa/ofertas" element={<EmpresaOfertas />} />
          <Route path="empresa/ofertas/:id/postulantes" element={<EmpresaPostulantes />} />
          <Route path="empresa/publicar" element={<EmpresaPublicar />} />
          <Route path="empresa/convenio" element={<ConvenioEmpresa />} />
        </Route>

        <Route element={<RutaProtegida roles={['coordinacion']} />}>
          <Route path="coordinacion/postulaciones" element={<CoordinacionPanel />} />
          <Route path="coordinacion/convenios" element={<ConveniosCoordinacion />} />
        </Route>

        <Route element={<RutaProtegida roles={['docente']} />}>
          <Route path="informes" element={<Informes />} />
        </Route>

        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  );
}
