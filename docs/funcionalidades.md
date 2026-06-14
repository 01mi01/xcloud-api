# X(dot)com — Informe de funcionalidades y arquitectura

**Proyecto:** Clon de Twitter/X como sistema de microservicios cloud-ready
**Materia:** Arquitectura en la Nube y Microservicios — Maestría Full Stack Development, UCB 2026
**Autor:** Sergio Machaca
**Fecha:** Junio 2026

---

## 1. Resumen ejecutivo

X(dot)com es un clon funcional de Twitter/X construido como un sistema de
**8 microservicios** en un monorepo TypeScript (npm workspaces), con un
frontend SPA en React 19. El sistema corre completo en local sobre Docker
(PostgreSQL, Cassandra, Redis, Kafka, Elasticsearch) y está preparado para
desplegarse en AWS mediante **infraestructura como código (AWS CDK)**:
ECS Fargate, RDS, ElastiCache, SQS/SNS, OpenSearch, S3 y CloudFront.

Las características diferenciadoras del proyecto son:

- **Contrato de API único (contract-first) con Smithy**: el mismo modelo
  genera la especificación OpenAPI, el SDK cliente TypeScript que consume el
  frontend y el SDK servidor (SSDK) que sirve rutas en el backend — frontend
  y backend comparten el contrato de datos generado, no copiado a mano.
- **Mensajería híbrida**: los servicios publican/consumen eventos a través de
  una capa de abstracción (`@xcloud/shared`) que usa **Kafka en local** y
  **SQS/SNS en producción**, sin cambiar código de negocio.
- **Persistencia políglota**: cada servicio usa el almacén adecuado a su
  patrón de acceso (relacional, wide-column, cache, índice invertido).
- **Optimización de costos documentada**: dos ADRs sustentan el reemplazo de
  MSK→SQS y EKS→ECS Fargate, con un entorno *beta* objetivo de ~$136/mes.

Estado actual: **13 workspaces compilan**, **55/55 tests unitarios pasan**
(8 suites de servicios + infraestructura) y el flujo end-to-end
(registro → tweet con imagen → fan-out → feed → like/retweet/reply →
notificación en tiempo real → búsqueda de tweets y usuarios) funciona en local.

---

## 2. Arquitectura general

### 2.1 Monorepo (npm workspaces)

```
xcloud-api/
├── apps/
│   ├── web/                  # SPA React 19 + Vite (ESM)
│   └── services/             # 8 microservicios (TypeScript, Express 5, CJS)
├── packages/
│   ├── shared/               # @xcloud/shared — mensajería, auth, logger, utils
│   ├── sdk-client/           # SDK cliente generado por Smithy (usado por web)
│   └── sdk-server/           # SDK servidor (SSDK) generado por Smithy
├── api-model/                # Modelo Smithy (fuente única del contrato)
├── infrastructure/           # AWS CDK (11 stacks, config por entorno)
├── docker-compose.yml        # Infraestructura local
├── db/                       # init.sql (PostgreSQL) + cassandra-init.cql
├── k8s/                      # Manifiestos de referencia (descartados por ADR-002)
└── docs/                     # ADRs, baseline de migración, este informe
```

### 2.2 Microservicios

Todos en TypeScript sobre Express 5, con arquitectura en capas
(`routes → controllers → services → repositories`), endpoint `GET /health`
para liveness probes, y configuración desde un único `.env` raíz.

| Servicio | Puerto | Almacén | Mensajería |
|---|---|---|---|
| **auth** | 3000 | PostgreSQL (`auth_users`) | — (JWT + bcrypt; Cognito preparado) |
| **user** | 3001 | PostgreSQL (`users`, `follows`) | publica `user.followed` |
| **tweet** | 3002 | Cassandra / Keyspaces | publica `tweet.created`, `tweet.liked`, `tweet.retweeted` |
| **feed** | 3003 | Redis + Cassandra | — (hidratación vía HTTP) |
| **notification** | 3004 | PostgreSQL (`notifications`) | consume `tweet.liked`, `tweet.retweeted`, `user.followed`; push **WebSocket** |
| **search** | 3005 | Elasticsearch / OpenSearch | consume `tweet.created`, `user.created`, `user.updated` |
| **media** | 3006 | disco local (dev) / S3 (prod) | — (subida de imágenes) |
| **fanout** | worker (health 3007) | Redis + PostgreSQL | consume `tweet.created`, `tweet.retweeted` |

### 2.3 Patrones de microservicios implementados

- **Database-per-service**: ningún servicio accede al almacén de otro;
  la composición se hace por eventos o por HTTP (p. ej. feed hidrata tweets
  llamando a tweet-service).
- **Fan-out on write**: al crear un tweet, fanout-service materializa el
  tweetId en la lista Redis del feed de cada follower (y del propio autor),
  de modo que leer el feed es O(1) sobre cache. Las **respuestas se excluyen
  del home timeline** (comportamiento tipo X: viven en el hilo del tweet padre);
  además el feed deduplica por tweetId.
- **Cache-aside con rebuild**: si el feed no está en Redis (expiró o usuario
  nuevo), feed-service lo reconstruye desde Cassandra a partir de los
  followings en PostgreSQL y lo vuelve a cachear.
- **Event-driven**: likes y follows generan notificaciones de forma
  asíncrona; la indexación de búsqueda es un consumidor independiente del
  mismo evento `tweet.created` que el fan-out (pub/sub 1→N).
- **Paginación por cursor** en feed y listados.

---

## 3. Contrato de datos con Smithy (frontend + backend)

El modelo Smithy en `api-model/` (`com.twitter#TwitterService`, protocolo
`restJson1`, `httpBearerAuth`) es la **fuente única de verdad** del contrato.
De un solo `smithy build` se generan **tres artefactos**:

| Proyección | Artefacto | Consumidor |
|---|---|---|
| `openapi` | Especificación OpenAPI 3 | Documentación / referencia |
| `typescript-client` | `@xcloud/sdk-client` (ESM) | `apps/web` (tweets, users, feed) |
| `typescript-server` | `@xcloud/sdk-server` (SSDK, CJS) | Servicios backend |

### 3.1 Operaciones modeladas (12)

- **Usuarios**: `GetUser`, `UpdateUser` — con tipos restringidos en el modelo
  (`Handle`: 4–20 caracteres alfanuméricos; `UUID` con patrón; `TweetContent`
  1–280 caracteres).
- **Tweets**: `CreateTweet`, `GetTweet`, `DeleteTweet`.
- **Likes**: `LikeTweet`, `UnlikeTweet` (idempotente).
- **Retweets**: `RetweetTweet`, `UnretweetTweet` (idempotente).
- **Follows**: `FollowUser`, `UnfollowUser` (modelados con `@http(code: 204)`).
- **Feed**: `GetFeed` (cursor + limit).
- **Errores modelados**: `UnauthorizedException` (401), `ValidationException`
  (400), `UserNotFoundException`/`TweetNotFoundException` (404),
  `ConflictException` (409), `ForbiddenException` (403).

Auth, notificaciones y búsqueda quedan fuera del modelo (rutas hechas a mano).

### 3.2 SDK cliente en el frontend

`apps/web` consume las operaciones modeladas a través del cliente generado
(`TwitterServiceClient` + `*Command`), apuntando al proxy de Vite
(`/api/v1/...` → microservicio correspondiente) y con el JWT inyectado por el
esquema `@httpBearerAuth` del modelo. Si el modelo cambia, el frontend deja
de compilar — la deriva de contrato se detecta en build, no en runtime.

### 3.3 SDK servidor (SSDK) en el backend

El hallazgo clave: el SSDK genera **handlers por operación**
(`getGetUserHandler(...)`), por lo que un modelo agregado convive
perfectamente con microservicios — cada servicio importa solo los handlers
de las operaciones que le pertenecen. Hay dos niveles de adopción:

1. **Piloto SSDK completo — user-service**: las 4 operaciones modeladas
   (`GetUser`, `UpdateUser`, `FollowUser`, `UnfollowUser`) se sirven con
   handlers generados que se encargan del matching de URL, deserialización,
   **validación de restricciones del modelo en runtime** (p. ej. un handle
   inválido devuelve 400 antes de tocar la base de datos) y serialización de
   respuestas y errores. Un adaptador (`src/smithy/express-adapter.ts`)
   puentea Express ↔ `HttpRequest`/`HttpResponse` del SSDK y propaga el
   payload del JWT en el `Context` del handler. El código de negocio queda
   reducido a implementaciones de operación que delegan en la capa de
   servicios existente y relanzan errores de dominio como excepciones
   modeladas.
2. **Tipos de contrato — tweet-service y feed-service**: los controladores
   tipan sus payloads contra los `*ServerInput` generados (`import type`),
   de modo que un cambio del modelo rompe la compilación del backend.

Ambos SDKs son **generados bajo demanda** (`npm run generate`, requiere
Smithy CLI) y su código no se versiona en git. Detalles y decisiones de
versión en `docs/sdk-generation.md`.

---

## 4. Mensajería híbrida: Kafka local, SQS/SNS en producción

Los productores y consumidores no usan Kafka ni SQS directamente: pasan por
`@xcloud/shared` (`createPublisher` / `createConsumer`), que selecciona el
transporte según `NODE_ENV`:

- **Local → Kafka** (kafkajs, KRaft sin ZooKeeper): topics `tweet.created`,
  `tweet.liked`, `user.followed`, creados automáticamente por el contenedor
  `kafka-init`.
- **Producción → SQS/SNS**: `tweet.created` tiene **dos consumidores**
  (fanout y search), por lo que se publica a un **topic SNS con fan-out a 2
  colas SQS**; `tweet.liked` y `user.followed` son colas SQS 1:1.

Este diseño replica en AWS la semántica pub/sub de Kafka (un evento, N
consumidores con grupos independientes) sin pagar un clúster MSK, y permite
que el código de los servicios sea idéntico en ambos entornos.

---

## 5. Persistencia políglota

| Almacén | Local | AWS | Uso |
|---|---|---|---|
| PostgreSQL 17 | Docker | RDS PostgreSQL | usuarios, follows, credenciales, notificaciones |
| Cassandra 4.1 | Docker | Amazon Keyspaces | tweets y likes (escritura intensiva, particionado por autor) |
| Redis 7 | Docker | ElastiCache Redis | feeds materializados (listas por usuario) |
| Elasticsearch 8.13 | Docker | OpenSearch | índice de búsqueda full-text de tweets |
| disco local | carpeta `uploads/` | S3 + CloudFront | imágenes de tweets (media-service) |

Los esquemas se inicializan automáticamente al levantar Docker
(`db/init.sql`, `db/cassandra-init.cql`).

---

## 6. Frontend — SPA React 19

`apps/web`: React 19 + Vite, TypeScript ESM, con rutas protegidas por JWT:

- **Auth**: `/login`, `/register` (hook `useAuth`, gestión de token); el
  registro valida el handle (regla del contrato) en cliente y servidor.
- **Feed**: `/home` — timeline con tweets de los seguidos + propios,
  composer de tweets, like/unlike, retweet/unretweet con **estado por usuario**
  (el corazón/retweet aparece activo si *tú* ya interactuaste), imágenes,
  paginación por cursor.
- **Detalle de tweet**: `/tweet/:tweetId` — imágenes, **respuestas
  persistentes**, y barra de acciones funcional (like/retweet/responder).
- **Perfiles**: `/profile` y `/profile/:handle` — edición de perfil,
  follow/unfollow, contadores, y pestañas tipo X: **Posts** (sin respuestas),
  **Replies**, **Media** (tweets con imágenes) y **Likes** (tweets que dio like).
- **Búsqueda**: `/search` — full-text sobre Elasticsearch, en dos pestañas:
  **tweets** (por keyword/hashtag, hidratados con conteos/imágenes reales) y
  **usuarios** (por handle, nombre o bio).
- **Notificaciones**: `/notifications` — likes, retweets y follows recibidos,
  **en tiempo real vía WebSocket** (badge de no leídas con pulso + contador en
  el título de la pestaña). Cada notificación muestra el **contenido del tweet**
  y es **clicable** (navega al tweet o al perfil del actor).
- **Multimedia**: el composer permite adjuntar **imágenes** (subidas a
  media-service); se renderizan en tarjetas, detalle y búsqueda.
- **Bookmarks** y **Following**: listados adicionales.

El acceso a tweets, usuarios y feed pasa por el **SDK generado por Smithy**;
auth, notificaciones, búsqueda y media usan un cliente HTTP propio. Las
notificaciones en tiempo real usan un **WebSocket** a notification-service
(`/api/v1/notifications/ws`, autenticado con el JWT). En desarrollo, el proxy
de Vite enruta `/api/v1/<servicio>/*` (y el WS) al microservicio correspondiente
(sin CORS).

---

## 7. Autenticación y seguridad

- **Local**: registro y login propios — bcrypt (10 salt rounds) para hashes,
  JWT firmado (HS256, expiración 8h) con payload compatible con Cognito
  (`sub`, `email`, `username`, `cognito:groups`). El registro crea
  `auth_users` + `users` en una **transacción atómica** y **valida el handle**
  contra la misma regla del contrato Smithy (`^[a-zA-Z0-9_]{4,20}$`), de modo
  que un handle que se puede crear siempre se puede resolver por el SSDK.
- **Middleware compartido**: `verifyToken` vive en `@xcloud/shared` y lo
  importan todos los servicios protegidos (se consolidaron las 5 copias
  locales que existían antes).
- **Nube (preparado)**: `auth-stack.ts` provisiona Cognito User Pool +
  client; el payload del JWT local imita al de Cognito para que la migración
  no rompa a los consumidores. La federación **SAML** (Cognito Hosted UI →
  IdP externo) está documentada como siguiente paso en `docs/tech-document.md`.
- En el piloto SSDK, la **validación de entrada la garantiza el contrato**
  (restricciones `@length`/`@pattern` del modelo ejecutadas en runtime).

---

## 8. Preparación para AWS (infraestructura como código)

`infrastructure/` define **11 stacks CDK** (TypeScript, `aws-cdk-lib` 2.150.0)
con configuración por entorno:

| Stack | Provisiona |
|---|---|
| Networking | VPC, subnets públicas/privadas, NAT (1 en beta, 2 en prod) |
| Auth | Cognito User Pool + app client |
| Database | RDS PostgreSQL (t3.micro beta → t3.medium prod) |
| Cache | ElastiCache Redis (t3.micro beta → t3.medium prod) |
| Messaging | Colas SQS (tweet-created FIFO, like, follow, index) + topic SNS |
| Search | Dominio OpenSearch (deshabilitado en beta) |
| Storage | Bucket S3 para media |
| Gateway | Application Load Balancer (internet-facing) |
| ECS | Clúster ECS Fargate, 1 servicio por microservicio, ruteo del ALB, roles IAM por tarea |
| CDN | CloudFront + origen S3 |
| Monitoring | Dashboard CloudWatch (Container Insights: CPU/memoria por servicio) + alarmas |

**Entornos** (`lib/config/environments.ts`):

| | beta | gamma | prod |
|---|---|---|---|
| NAT Gateways | 1 | 1 | 2 |
| Tareas por servicio | 1 | 1 | 2 |
| RDS / Redis | t3.micro | t3.small | t3.medium |
| OpenSearch | **deshabilitado** | t3.medium.search | m5.large.search |
| Deletion protection | no | sí | sí |

Beta es **HTTP-only** (ALB :80, sin ACM) y omite OpenSearch + search-service,
con un costo objetivo de **~$136/mes**. `npx cdk synth --context env=beta`
genera las plantillas sin desplegar.

### Decisiones de arquitectura (ADRs)

- **ADR-001 — SQS en lugar de Amazon MSK**: un clúster MSK mínimo cuesta
  ~$300–450/mes; SQS/SNS entra en free tier y cuesta $0.40/M de mensajes
  después. Tradeoffs aceptados: sin consumer groups nativos ni log
  compaction, FIFO limitado a 3k msg/s — suficiente para el caso de uso.
- **ADR-002 — ECS Fargate en lugar de EKS**: EKS impone ~$130–160/mes solo
  de plano de control; Fargate cuesta ~$9/mes por tarea (~$72/mes para los 8
  servicios) sin administrar nodos. Los manifiestos K8s se conservan en
  `k8s/` como referencia.

`docs/migration-baseline.md` captura el comportamiento esperado de cada
servicio antes de la migración, como oráculo de regresión.

---

## 9. Entorno de desarrollo local

`docker compose up -d` levanta toda la infraestructura con healthchecks y
contenedores de inicialización (topics de Kafka, keyspace de Cassandra,
esquema de PostgreSQL):

postgres:17 · cassandra:4.1 (+init) · redis:7-alpine · apache/kafka:3.7.0
en modo KRaft (+init de topics) · elasticsearch:8.13.0.

Flujo de desarrollo:

```bash
npm install                              # todas las workspaces
npm run build -w packages/shared         # shared primero (los servicios lo resuelven compilado)
docker compose up -d                     # infraestructura local
npm run dev                              # por servicio (ts-node-dev hot reload)
cd apps/web && npm run dev               # SPA en :5173
npm run generate                         # regenera sdk-client + sdk-server desde Smithy
```

---

## 10. Calidad

- **Tests unitarios**: 55 tests en 8 suites Jest — auth (5), fanout (3),
  feed (7), notification (3), search (3), tweet (16), user (9) e
  infraestructura/CDK (9: asserts sobre los stacks sintetizados). Mocking de
  repositorios y clientes externos; `npm test --workspaces --if-present`
  ejecuta todo con **exit code 0**.
- **Builds**: los 13 workspaces compilan con `tsc`
  (`npm run build --workspaces --if-present`).
- **Verificación del contrato en runtime**: el piloto SSDK se validó
  end-to-end contra el servicio corriendo — 200/204 en happy paths, 400 de
  validación del modelo, 404/409 de excepciones modeladas, 401 sin token.
- **Documentación**: README operativo (setup, endpoints, troubleshooting),
  `CLAUDE.md` (convenciones del repo), ADRs, `docs/sdk-generation.md` y
  baseline de migración.

---

## 11. Estado actual y próximos pasos

**Completado**: 8 microservicios funcionales en local, SPA completa,
contrato Smithy generando cliente + servidor + OpenAPI, mensajería híbrida,
11 stacks CDK que sintetizan correctamente, suite de tests en verde.
**Fase 1** cerrada (incl. retweets y búsqueda de usuarios). De **Fase 2**:
notificaciones en tiempo real (WebSocket) y subida de imágenes (media-service)
implementadas; el feed con ML, analytics, DMs, multi-región y GraphQL quedan
fuera de alcance / pendientes.

**Próximos pasos**:

1. Despliegue del entorno **beta** en AWS (`cdk deploy`) y smoke tests
   contra el ALB.
2. Activar **Cognito** en auth-service (la rama local ya imita su payload) y
   evaluar federación SAML vía Hosted UI.
3. Extender el SSDK al resto de servicios modelados (tweet, feed) — hoy usan
   solo los tipos de contrato.
