'use strict';

/**
 * Integración de correo. En el prototipo no se conecta a un servidor SMTP: el notificador
 * escribe el mensaje en consola (o lo guarda en memoria, para las pruebas). La interfaz
 * es la misma que tendría la versión real: enviar({ para, asunto, texto }).
 */

function crearNotificadorConsola(escribir = console.log) {
  return {
    async enviar({ para, asunto, texto }) {
      escribir(`[correo simulado] Para: ${para.join(', ')} | Asunto: ${asunto} | ${texto}`);
    },
  };
}

function crearNotificadorEnMemoria() {
  const bandeja = [];
  return {
    bandeja,
    async enviar({ para, asunto, texto }) {
      bandeja.push({ para, asunto, texto });
    },
  };
}

module.exports = { crearNotificadorConsola, crearNotificadorEnMemoria };
