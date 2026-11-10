'use strict';

/**
 * Limitador de intentos fallidos en memoria. Sirve para frenar los intentos repetidos de adivinar
 * una contraseña: tras "max" fallos dentro de la ventana, la clave queda bloqueada hasta que
 * la ventana termine. Con varias instancias del servidor habría que moverlo a un almacén compartido.
 */
function crearLimitador({ max = 5, ventanaMs = 15 * 60 * 1000, ahora = () => Date.now() } = {}) {
  const registros = new Map(); // clave -> { fallos, desde }

  function vigente(clave) {
    const registro = registros.get(clave);
    if (!registro) return null;
    if (ahora() - registro.desde >= ventanaMs) {
      registros.delete(clave);
      return null;
    }
    return registro;
  }

  function purgar() {
    for (const clave of registros.keys()) vigente(clave);
  }

  return {
    bloqueado(clave) {
      const registro = vigente(clave);
      return Boolean(registro && registro.fallos >= max);
    },
    minutosRestantes(clave) {
      const registro = vigente(clave);
      if (!registro) return 0;
      return Math.max(1, Math.ceil((registro.desde + ventanaMs - ahora()) / 60000));
    },
    registrarFallo(clave) {
      const registro = vigente(clave);
      if (registro) {
        registro.fallos += 1;
        return;
      }
      if (registros.size >= 5000) purgar(); // evita que el mapa crezca sin límite
      registros.set(clave, { fallos: 1, desde: ahora() });
    },
    limpiar(clave) {
      registros.delete(clave);
    },
  };
}

module.exports = { crearLimitador };
