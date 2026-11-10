import { Link } from 'react-router-dom';
import { Vacio } from '../componentes.jsx';
import { useTitulo } from '../useTitulo.js';

export default function NoEncontrada() {
  useTitulo('Página no encontrada');
  return (
    <Vacio titulo="No encontramos esa página">
      <p>La dirección no existe o fue movida.</p>
      <Link className="boton" to="/">
        Ir al inicio
      </Link>
    </Vacio>
  );
}
