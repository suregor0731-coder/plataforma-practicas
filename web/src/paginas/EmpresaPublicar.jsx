import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Aviso, Campo, TituloPagina } from '../componentes.jsx';
import { hoyISO } from '../formato.js';
import { useTitulo } from '../useTitulo.js';

const VACIO = {
  titulo: '',
  descripcion: '',
  requisitos: '',
  cupos: '1',
  ciudad: '',
  modalidad: 'presencial',
  id_programa: '',
  fecha_cierre: '',
};

export default function EmpresaPublicar() {
  useTitulo('Publicar oferta');
  const navegar = useNavigate();
  const [datos, setDatos] = useState(VACIO);
  const [programas, setProgramas] = useState([]);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .get('/programas')
      .then((respuesta) => setProgramas(respuesta.datos))
      .catch(() => setError('No se pudo cargar la lista de programas. Puede publicar la oferta sin elegir uno.'));
  }, []);

  const poner = (campo) => (evento) => setDatos((previo) => ({ ...previo, [campo]: evento.target.value }));

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setErrores({});
    setEnviando(true);
    try {
      await api.post('/ofertas', {
        ...datos,
        cupos: datos.cupos ? Number(datos.cupos) : null,
        id_programa: datos.id_programa ? Number(datos.id_programa) : null,
        fecha_cierre: datos.fecha_cierre || null,
      });
      navegar('/empresa/ofertas', { state: { aviso: 'La oferta se publicó y ya aparece en el listado de estudiantes.' } });
    } catch (fallo) {
      if (fallo.estado === 422) setErrores(fallo.detalles);
      else setError(fallo.message);
      setEnviando(false);
    }
  }

  return (
    <>
      <Link className="volver" to="/empresa/ofertas">
        ‹ Volver a mis ofertas
      </Link>
      <TituloPagina titulo="Publicar una oferta" descripcion="Describa la práctica con el detalle suficiente para que los estudiantes puedan decidir." />
      <form className="formulario-tarjeta" onSubmit={enviar} noValidate>
        <Aviso tipo="error">{error}</Aviso>
        <div className="rejilla-campos">
          <Campo id="of-titulo" etiqueta="Título del cargo" error={errores.titulo} className="ancho-completo">
            <input type="text" value={datos.titulo} onChange={poner('titulo')} maxLength={160} required />
          </Campo>
          <Campo
            id="of-descripcion"
            etiqueta="Descripción de la práctica"
            error={errores.descripcion}
            ayuda="Funciones, proyecto y acompañamiento. Separe los párrafos con una línea en blanco."
            className="ancho-completo"
          >
            <textarea value={datos.descripcion} onChange={poner('descripcion')} maxLength={4000} rows={5} required />
          </Campo>
          <Campo
            id="of-requisitos"
            etiqueta="Requisitos"
            error={errores.requisitos}
            ayuda="Escriba un requisito por línea."
            className="ancho-completo"
          >
            <textarea value={datos.requisitos} onChange={poner('requisitos')} maxLength={2000} rows={4} />
          </Campo>
          <Campo id="of-cupos" etiqueta="Cupos" error={errores.cupos}>
            <input type="number" min="1" max="50" value={datos.cupos} onChange={poner('cupos')} required />
          </Campo>
          <Campo id="of-modalidad" etiqueta="Modalidad" error={errores.modalidad}>
            <select value={datos.modalidad} onChange={poner('modalidad')}>
              <option value="presencial">Presencial</option>
              <option value="hibrida">Híbrida</option>
              <option value="remota">Remota</option>
            </select>
          </Campo>
          <Campo id="of-ciudad" etiqueta="Ciudad" error={errores.ciudad}>
            <input type="text" value={datos.ciudad} onChange={poner('ciudad')} maxLength={80} required />
          </Campo>
          <Campo id="of-programa" etiqueta="Programa al que se dirige" error={errores.id_programa}>
            <select value={datos.id_programa} onChange={poner('id_programa')}>
              <option value="">Cualquier programa</option>
              {programas.map((p) => (
                <option key={p.id_programa} value={p.id_programa}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            id="of-cierre"
            etiqueta="Fecha de cierre (opcional)"
            error={errores.fecha_cierre}
            ayuda="Después de esta fecha la oferta deja de recibir postulaciones."
          >
            <input type="date" min={hoyISO()} value={datos.fecha_cierre} onChange={poner('fecha_cierre')} />
          </Campo>
        </div>
        <div className="acciones">
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? 'Publicando…' : 'Publicar oferta'}
          </button>
          <Link className="boton boton--secundario" to="/empresa/ofertas">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
