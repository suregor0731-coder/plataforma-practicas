import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './estilos.css';
import App from './App.jsx';
import { ProveedorSesion } from './sesion.jsx';

/** Si una pantalla falla al dibujarse, se muestra un mensaje en lugar de dejar la página en blanco. */
class LimiteDeErrores extends Component {
  constructor(props) {
    super(props);
    this.state = { fallo: false };
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error) {
    console.error('Error de la interfaz:', error);
  }

  render() {
    if (this.state.fallo) {
      return (
        <div className="principal">
          <div className="aviso aviso--error" role="alert">
            Ocurrió un error inesperado en la aplicación. Vuelva al inicio e intente de nuevo.
          </div>
          <button type="button" className="boton" onClick={() => window.location.assign('/')}>
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <LimiteDeErrores>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </BrowserRouter>
    </LimiteDeErrores>
  </StrictMode>
);
