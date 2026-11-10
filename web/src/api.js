// Cliente de la API REST. Todas las llamadas pasan por aquí para tratar los errores de forma uniforme.
const BASE = '/api/v1';

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles; // { campo: mensaje } cuando la API responde 422
  }
}

// Si el token vence o deja de servir, la sesión avisa para cerrarse y llevar al ingreso
const CODIGOS_SESION_INVALIDA = ['NO_AUTENTICADO', 'TOKEN_INVALIDO', 'TOKEN_EXPIRADO', 'CUENTA_NO_DISPONIBLE'];

let token = null;
let alPerderSesion = null;

export function fijarToken(nuevo) {
  token = nuevo;
}

export function alPerderLaSesion(funcion) {
  alPerderSesion = funcion;
}

async function pedir(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.');
  }
  return respuesta;
}

async function comoJson(respuesta) {
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // respuesta sin cuerpo JSON
  }
  if (respuesta.ok) return datos;
  const error = datos && datos.error ? datos.error : {};
  if (respuesta.status === 401 && token && CODIGOS_SESION_INVALIDA.includes(error.codigo) && alPerderSesion) {
    alPerderSesion(error.mensaje);
  }
  throw new ErrorApi(
    respuesta.status,
    error.codigo || 'ERROR',
    error.mensaje || 'No se pudo completar la operación. Intente de nuevo.',
    error.detalles || {}
  );
}

export const api = {
  get: async (ruta) => comoJson(await pedir('GET', ruta)),
  post: async (ruta, cuerpo = {}) => comoJson(await pedir('POST', ruta, cuerpo)),
  patch: async (ruta, cuerpo = {}) => comoJson(await pedir('PATCH', ruta, cuerpo)),
};

/** Descarga la hoja de vida (PDF) de una postulación. Se pide con el token y se entrega como archivo. */
export async function descargarHojaDeVida(idPostulacion, nombreSugerido = 'hoja-de-vida.pdf') {
  const respuesta = await pedir('GET', `/postulaciones/${idPostulacion}/hoja-vida`);
  if (!respuesta.ok) await comoJson(respuesta);
  const archivo = await respuesta.blob();
  const direccion = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = direccion;
  enlace.download = nombreSugerido;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(direccion), 10000);
}

/** Convierte un File en texto base64 (sin el prefijo "data:...;base64,"). */
export function leerComoBase64(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).split(',')[1] || '');
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}
