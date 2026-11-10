# Plataforma de gestión de prácticas profesionales

Prototipo funcional del taller integrador de Prácticas Profesionales (Unidad 3). Digitaliza el recorrido que hoy se hace por correo y hojas de cálculo: las empresas publican ofertas, los estudiantes se postulan con su hoja de vida y Coordinación aprueba las prácticas solo cuando el convenio de la empresa está vigente.

**Autores:** Sergio Urrego Rendón, Anyi Tatiana Hurtado Escobar y Andrés Carvajal.

## Qué incluye

El prototipo implementa tres módulos del alcance definido en la Unidad 2 (RF1 a RF6):

| Módulo | Requisitos | Qué permite |
|---|---|---|
| 1. Cuentas por rol | RF1 | Registro de estudiantes y empresas con autorización de datos (Ley 1581 de 2012), ingreso con JWT y control de acceso por rol (estudiante, empresa, coordinación y docente). |
| 2. Ofertas y postulación | RF2, RF3, RF4 y RF5 | Publicación y cierre de ofertas, listado con filtros y paginación, postulación con hoja de vida en PDF y preselección o descarte por parte de la empresa. |
| 3. Aprobación con validación de convenio | RF6 | Panel de Coordinación que aprueba, rechaza o devuelve postulaciones; la aprobación exige un convenio vigente y la oferta se cierra sola cuando se llenan sus cupos. |

Los requisitos se numeran como en el documento de la Unidad 2. Los avisos por correo (RF7) se generan en los cambios de estado principales, pero se escriben en consola. Los informes de práctica (RF8) y los indicadores (RF9) no forman parte de este prototipo (ver [Limitaciones](#limitaciones-conocidas)).

## Tecnologías

- **Frontend:** React 19 y React Router 6, compilados con esbuild.
- **Backend:** Node.js 22.9 o superior y Express 5 (API REST en `/api/v1`).
- **Base de datos:** PostgreSQL 16.
- **Pruebas:** `node:test` (unitarias e integración) y Playwright (E2E).
- **Control de versiones e integración continua:** Git, GitHub y GitHub Actions.

## Puesta en marcha

Requisitos: Node.js 22.9 o superior y PostgreSQL 16 (o Docker para levantarlo).

```bash
git clone <URL-del-repositorio>
cd plataforma-practicas
npm install
cp .env.example .env            # en Windows: copy .env.example .env
docker compose up -d db         # PostgreSQL con las bases "practicas" y "practicas_test"
npm run db:reiniciar            # crea las tablas y carga los datos de demostración
npm run build:web               # compila la interfaz en web/dist
npm start                       # http://localhost:3000
```

Si ya tiene PostgreSQL instalado, omita Docker, cree las dos bases (`practicas` y `practicas_test`) y ajuste `DATABASE_URL` y `DATABASE_URL_TEST` en `.env`.

Para desarrollar, use dos terminales: `npm run dev` reinicia el servidor al guardar cambios y `npm run dev:web` recompila la interfaz.

### Cuentas de demostración

Todas usan la contraseña `Demo2026*`. Los datos de demostración son ficticios.

| Rol | Correo | Convenio de la empresa |
|---|---|---|
| Coordinación | `coordinacion@practicas.demo` | — |
| Docente | `docente@practicas.demo` | — |
| Estudiante | `camila.restrepo@practicas.demo` (también `julian.ospina`, `valentina.cardona`, `mateo.herrera`, `laura.perez` y `sebastian.giraldo`, con el mismo dominio) | — |
| Empresa | `rrhh@nododigital.demo` | Vigente |
| Empresa | `talento@logisticaandina.demo` | Por vencer (menos de 30 días) |
| Empresa | `gestion@estudiovalle.demo` | Vencido |
| Empresa | `personal@clinicahorizonte.demo` | Sin convenio |

La pantalla de ingreso ofrece un acceso rápido a una cuenta de cada rol, pero solo cuando la interfaz se compila fuera de producción (`NODE_ENV` distinto de `production`).

## Pruebas

Las pruebas de integración y el recorrido E2E usan una base de datos exclusiva (`DATABASE_URL_TEST`) que **se borra y se recrea en cada corrida**; por seguridad el nombre de la base debe contener "test".

```bash
npm test                  # unitarias + integración (95 casos)
npm run test:unitarias    # solo unitarias, no necesitan base de datos
npm run test:integracion  # API completa sobre PostgreSQL real
npm run test:cobertura    # todo lo anterior con informe de cobertura
npm run test:e2e          # navegador real: registro → postulación → preselección → aprobación
```

El recorrido E2E acepta opciones: `npm run test:e2e -- --escala=2` guarda capturas en alta resolución y `npm run test:e2e -- --demo` lo ejecuta con pausas, subtítulos y grabación de video. Las capturas quedan en `e2e/salida/` (la primera vez hay que instalar el navegador con `npx playwright install chromium`).

Las evidencias de la última corrida (capturas y resultados) están en [`docs/evidencias`](docs/evidencias).

## Estructura

```
server/
  routes/ controllers/      HTTP: rutas y controladores delgados
  services/                 reglas de negocio (se inyectan repositorios, reloj y notificador)
  repositories/             consultas SQL parametrizadas
  middlewares/              autenticación, cabeceras de seguridad, errores, registro de peticiones
  utils/                    máquina de estados, vigencia de convenios, validadores, JWT, hash
  db/                       conexión, migraciones y datos de demostración
  integrations/             notificador de correo (simulado por consola)
web/src/                    interfaz React (páginas, componentes y cliente de la API)
database/migrations/        esquema SQL versionado
test/unit  test/integration pruebas automáticas
e2e/                        recorrido de punta a punta con Playwright
docs/evidencias/            capturas y resultados de las pruebas
```

## API REST

Todas las rutas cuelgan de `/api/v1`. Los errores devuelven `{ "error": { "codigo", "mensaje", "detalles" } }`.

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /salud` | Público | Estado del servidor y de la base de datos |
| `GET /programas` | Público | Catálogo de programas académicos |
| `POST /auth/registro/estudiante`, `POST /auth/registro/empresa` | Público | Crea la cuenta y abre sesión |
| `POST /auth/login`, `GET /auth/me` | Público / sesión | Ingreso y datos de la sesión |
| `GET /ofertas`, `GET /ofertas/:id` | Sesión | Listado con filtros (`texto`, `id_programa`, `ciudad`, `modalidad`, `pagina`) y detalle |
| `GET /ofertas/mias`, `POST /ofertas`, `PATCH /ofertas/:id/estado` | Empresa | Gestión de las ofertas propias |
| `GET /ofertas/:id/postulaciones` | Empresa dueña | Postulantes de una oferta |
| `POST /ofertas/:id/postulaciones` | Estudiante | Postulación con hoja de vida en PDF (base64, máximo 2 MB) |
| `GET /postulaciones/mias` | Estudiante | Postulaciones propias |
| `GET /postulaciones/:id/hoja-vida` | Dueño, empresa de la oferta o Coordinación | Descarga el PDF |
| `POST /postulaciones/:id/preseleccionar` y `/descartar` | Empresa dueña | Decisión de la empresa |
| `POST /postulaciones/:id/aprobar`, `/rechazar` y `/devolver` | Coordinación | Decisión final; aprobar exige convenio vigente |
| `GET /coordinacion/panel` | Coordinación | Contadores, postulaciones por estado y acciones posibles |
| `GET /empresas`, `POST /convenios`, `PATCH /convenios/:id/estado` | Coordinación | Empresas, y registro o cambio de estado de sus convenios |
| `GET /convenios` | Coordinación y empresa | Coordinación ve todos los convenios; cada empresa, solo los suyos |

## Reglas de negocio

- Una postulación recorre los estados `enviada → preseleccionada → aprobada`, con las salidas `descartada`, `rechazada` y `devuelta`. La empresa decide hasta la preselección; Coordinación decide desde ahí.
- Aprobar exige que la empresa tenga un convenio **vigente** (estado vigente y dentro de sus fechas). Con menos de 30 días para vencer el convenio se muestra como "por vencer" y todavía permite aprobar. Si no está vigente, Coordinación puede rechazar o **devolver** la postulación, y en ambos casos debe escribir un motivo.
- Un estudiante solo puede postularse una vez a cada oferta, incluso si envía dos solicitudes al mismo tiempo (restricción `UNIQUE` en la base de datos).
- Nunca hay más aprobaciones que cupos: la aprobación bloquea la postulación y la oferta dentro de una transacción, y la oferta se cierra sola al ocupar su último cupo.
- Las notificaciones por correo son de mejor esfuerzo: si el envío falla, la operación ya registrada no se revierte.

## Seguridad

Contraseñas con scrypt y sal aleatoria; tokens JWT HS256 firmados con `JWT_SECRET` (obligatorio y de 16 caracteres o más en producción); verificación de la cuenta activa en cada petición; control de acceso por rol; consultas parametrizadas y escape de comodines en las búsquedas; cabeceras CSP, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`; bloqueo temporal (ventana de 15 minutos) tras 5 intentos de ingreso fallidos; validación de entradas en el servidor (el archivo debe ser un PDF real); registro de peticiones sin cuerpos ni parámetros.

## Integración continua

El flujo `.github/workflows/ci.yml` se ejecuta en cada `push` y `pull request` hacia `main`: instala las dependencias, corre las pruebas unitarias y de integración contra un servicio PostgreSQL 16 y comprueba que la interfaz compile. El recorrido E2E se ejecuta a mano (`npm run test:e2e`).

## Flujo de trabajo con Git

- `main` es la rama de integración. La versión entregada lleva la etiqueta `v1.0-unidad3` y pasa las 95 pruebas automáticas.
- Cada módulo se desarrolló en su propia rama (`feature/cuentas-por-rol`, `feature/ofertas-y-postulacion`, `feature/aprobacion-con-convenio`) y las pruebas en `feature/pruebas-automaticas`. Todas se integraron con `merge --no-ff` para que el historial muestre cada módulo.
- Los mensajes de commit siguen la convención `tipo(ámbito): descripción` (`feat`, `fix`, `test`, `docs`, `chore`, `ci`).
- Después del primer `npm install`, conviene agregar `package-lock.json` al repositorio para que las instalaciones sean reproducibles.

## Limitaciones conocidas

- **Informes e indicadores (RF8 y RF9):** la pantalla del docente es solo un marcador; no se implementaron el registro y la calificación de informes, ni los indicadores y reportes exportables (el panel de Coordinación muestra cuatro contadores).
- **Edición de ofertas (parte de RF2):** la empresa puede publicar, cerrar y reabrir una oferta, pero no modificar sus datos una vez publicada.
- **Integraciones simuladas:** el correo se escribe en consola (no hay SMTP), y no hay inicio de sesión institucional (SSO) ni conexión con el sistema académico; las cuentas son propias de la plataforma.
- **Regla pendiente:** todavía no se impide que un mismo estudiante tenga más de una práctica aprobada.
- **Almacenamiento:** las hojas de vida se guardan en PostgreSQL (máximo 2 MB). En producción conviene un almacenamiento de objetos.
- **Escalabilidad:** el limitador de intentos de ingreso vive en memoria, por lo que asume una sola instancia del servidor. La meta de 100 usuarios simultáneos (RNF2) no se ha medido con pruebas de carga.
- **Despliegue:** se entrega un entorno local documentado; no hay despliegue en la nube.
- **Validación con usuarios:** el prototipo todavía no se ha probado con estudiantes, empresas ni coordinación.
