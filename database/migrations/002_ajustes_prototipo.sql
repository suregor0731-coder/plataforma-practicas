-- 002_ajustes_prototipo.sql
-- Columnas que el modelo de la Unidad 2 no traía y que el prototipo necesita para
-- cumplir los requisitos (consentimiento de datos, filtros de ofertas, hoja de vida y decisión).

-- RNF1: consentimiento expreso para tratar datos personales (Ley 1581 de 2012)
ALTER TABLE usuario
  ADD COLUMN consentimiento_datos BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN fecha_consentimiento TIMESTAMPTZ,
  ADD COLUMN fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now();

-- RF2 y RF3: datos de la oferta que sirven para filtrar (programa, ciudad, modalidad) y para cerrar por fecha
ALTER TABLE oferta_practica
  ADD COLUMN id_programa INTEGER REFERENCES programa_academico (id_programa),
  ADD COLUMN ciudad      VARCHAR(80) NOT NULL DEFAULT 'Medellín',
  ADD COLUMN modalidad   VARCHAR(10) NOT NULL DEFAULT 'presencial'
    CONSTRAINT ck_oferta_modalidad CHECK (modalidad IN ('presencial', 'hibrida', 'remota')),
  ADD COLUMN requisitos  TEXT NOT NULL DEFAULT '',
  ADD COLUMN fecha_cierre DATE;

-- RF4 y RF6: hoja de vida adjunta, carta de presentación y registro de la decisión de Coordinación
ALTER TABLE postulacion
  ADD COLUMN carta_presentacion  TEXT NOT NULL DEFAULT '',
  ADD COLUMN hoja_vida           BYTEA,
  ADD COLUMN hoja_vida_nombre    VARCHAR(160),
  ADD COLUMN fecha_decision      TIMESTAMPTZ,
  ADD COLUMN observacion_decision TEXT,
  ADD COLUMN id_usuario_decision INTEGER REFERENCES usuario (id_usuario);

CREATE INDEX ix_oferta_programa ON oferta_practica (id_programa);
