-- 001_esquema_inicial.sql
-- Las nueve tablas del modelo entidad-relación diseñado en la Unidad 2.
-- Cada tabla tiene su llave primaria (PK) y las llaves foráneas (FK) del modelo.

CREATE TABLE programa_academico (
  id_programa INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL UNIQUE,
  facultad    VARCHAR(120) NOT NULL
);

CREATE TABLE usuario (
  id_usuario           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  correo_institucional VARCHAR(160) NOT NULL UNIQUE,
  hash_contrasena      VARCHAR(255) NOT NULL,
  rol                  VARCHAR(20)  NOT NULL
    CONSTRAINT ck_usuario_rol CHECK (rol IN ('estudiante', 'empresa', 'docente', 'coordinacion')),
  estado               VARCHAR(10)  NOT NULL DEFAULT 'activo'
    CONSTRAINT ck_usuario_estado CHECK (estado IN ('activo', 'inactivo'))
);

CREATE TABLE estudiante (
  id_estudiante INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario    INTEGER      NOT NULL UNIQUE REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  id_programa   INTEGER      NOT NULL REFERENCES programa_academico (id_programa),
  nombre        VARCHAR(120) NOT NULL,
  documento     VARCHAR(15)  NOT NULL UNIQUE,
  semestre      SMALLINT     NOT NULL
    CONSTRAINT ck_estudiante_semestre CHECK (semestre BETWEEN 1 AND 12)
);

CREATE TABLE docente (
  id_docente  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario  INTEGER      NOT NULL UNIQUE REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  id_programa INTEGER      NOT NULL REFERENCES programa_academico (id_programa),
  nombre      VARCHAR(120) NOT NULL,
  correo      VARCHAR(160) NOT NULL
);

CREATE TABLE empresa (
  id_empresa      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario      INTEGER      NOT NULL UNIQUE REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  nombre          VARCHAR(160) NOT NULL,
  nit             VARCHAR(20)  NOT NULL UNIQUE,
  sector          VARCHAR(80)  NOT NULL,
  correo_contacto VARCHAR(160) NOT NULL
);

CREATE TABLE convenio (
  id_convenio  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_empresa   INTEGER     NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
  fecha_inicio DATE        NOT NULL,
  fecha_fin    DATE        NOT NULL,
  estado       VARCHAR(12) NOT NULL DEFAULT 'vigente'
    CONSTRAINT ck_convenio_estado CHECK (estado IN ('vigente', 'suspendido', 'terminado')),
  CONSTRAINT ck_convenio_fechas CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE oferta_practica (
  id_oferta         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_empresa        INTEGER      NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
  titulo            VARCHAR(160) NOT NULL,
  descripcion       TEXT         NOT NULL,
  cupos             SMALLINT     NOT NULL
    CONSTRAINT ck_oferta_cupos CHECK (cupos > 0),
  fecha_publicacion DATE         NOT NULL DEFAULT CURRENT_DATE,
  estado            VARCHAR(10)  NOT NULL DEFAULT 'abierta'
    CONSTRAINT ck_oferta_estado CHECK (estado IN ('abierta', 'cerrada'))
);

CREATE TABLE postulacion (
  id_postulacion     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_estudiante      INTEGER     NOT NULL REFERENCES estudiante (id_estudiante) ON DELETE CASCADE,
  id_oferta          INTEGER     NOT NULL REFERENCES oferta_practica (id_oferta) ON DELETE CASCADE,
  fecha_postulacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado_postulacion VARCHAR(15) NOT NULL DEFAULT 'enviada'
    CONSTRAINT ck_postulacion_estado CHECK (
      estado_postulacion IN ('enviada', 'preseleccionada', 'descartada', 'aprobada', 'rechazada', 'devuelta')
    ),
  CONSTRAINT uq_postulacion_estudiante_oferta UNIQUE (id_estudiante, id_oferta)
);

CREATE TABLE informe_practica (
  id_informe     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_postulacion INTEGER     NOT NULL REFERENCES postulacion (id_postulacion) ON DELETE CASCADE,
  id_docente     INTEGER     REFERENCES docente (id_docente),
  tipo_informe   VARCHAR(10) NOT NULL
    CONSTRAINT ck_informe_tipo CHECK (tipo_informe IN ('parcial', 'final')),
  fecha_entrega  DATE        NOT NULL DEFAULT CURRENT_DATE,
  evaluacion     NUMERIC(2, 1)
    CONSTRAINT ck_informe_evaluacion CHECK (evaluacion BETWEEN 0 AND 5)
);

-- Índices sobre las llaves foráneas que más se consultan
CREATE INDEX ix_convenio_empresa      ON convenio (id_empresa);
CREATE INDEX ix_oferta_empresa        ON oferta_practica (id_empresa);
CREATE INDEX ix_postulacion_oferta    ON postulacion (id_oferta);
CREATE INDEX ix_postulacion_estado    ON postulacion (estado_postulacion);
CREATE INDEX ix_informe_postulacion   ON informe_practica (id_postulacion);
