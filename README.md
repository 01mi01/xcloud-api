# X(dot)com — Twitter Clone Platform

Plataforma de red social en la nube inspirada en la arquitectura de X/Twitter. Implementada como un sistema de microservicios con comunicación asíncrona via Kafka, caché en Redis y búsqueda full-text con OpenSearch.

## Materia
Arquitectura en la Nube y Microservicios - Maestría Full Stack Development - UCB 2026

## Equipo

| Rol | Nombre |
|---|---|
| Infraestructura | Flores Velasquez Maritza Karen |
| AuthN/AuthZ — Cognito | De los Rios Aliaga Mijaelha |
| Arquitectura técnica | Machaca Lamas Sergio Alejandro |
| Desarrollo | Mamani Poma Alexander Manuel |

## Docente

Phd. Jhesser Guzman

## Arquitectura

El sistema está compuesto por **8 microservicios** independientes, cada uno con su propia responsabilidad:

| Servicio | Puerto | Descripción | Base de datos |
|---|---|---|---|
| Auth Service | 3000 | Registro, login, JWT | PostgreSQL (`auth_users`) |
| User Service | 3001 | Perfiles, follow/unfollow, búsqueda | PostgreSQL (`users`, `follows`) |
| Tweet Service | 3002 | CRUD tweets, likes, retweets | Cassandra (`tweets`, `likes`, `retweets`) |
| Feed Service | 3003 | Timeline personalizado con cursor pagination | Redis (cache) + Cassandra (fallback) |
| Fan-out Service | worker + /health 3007 | Distribuye tweets al feed de seguidores | Redis (escritura) + PostgreSQL (lectura) |
| Notification Service | 3004 | Notificaciones de likes y follows | PostgreSQL (`notifications`) |
| Search Service | 3005 | Búsqueda full-text de tweets | OpenSearch (`tweets` index) |
| Media Service | 3006 | Gestión de archivos multimedia (stub) | S3 (producción) |

### Comunicación entre servicios

- **REST** para APIs públicas (cliente → servicio)
- **Kafka** (local) / **SQS+SNS** (producción) para eventos asíncronos — conmutación automática en `@xcloud/shared`
- **gRPC** para hidratación de tweets (Feed Service → Tweet Service, `GetTweetsByIds`)

### Topics de Kafka / Colas SQS

| Topic / Cola | Productor | Consumidores |
|---|---|---|
| `tweet.created` | Tweet Service | Fan-out Service, Search Service |
| `tweet.liked` | Tweet Service | Notification Service |
| `user.followed` | User Service | Notification Service |

## Prerequisitos

- [Node.js v20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Java JDK 17+](https://adoptium.net/) (solo para Smithy build)

## Setup rápido

### 1. Clonar el repositorio

```bash
git clone https://github.com/01mi01/xcloud-api.git
cd xcloud-api
```

### 2. Configurar variables de entorno

Copiar el archivo de ejemplo (un único `.env` en la raíz; todos los servicios lo leen):

```bash
cp .env.example .env
```

Contenido del `.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xcloud
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=xcloud-local-dev-secret
REDIS_HOST=localhost
REDIS_PORT=6379
KAFKA_BROKERS=localhost:9094
OPENSEARCH_URL=http://localhost:9200
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_KEYSPACE=xcloud
```

### 3. Levantar infraestructura

```bash
docker compose up -d
```

Esto levanta: PostgreSQL, Cassandra, Redis, Kafka (KRaft) y OpenSearch.

Esperar ~60 segundos a que todos los servicios estén healthy:

```bash
docker compose ps
```

> Los topics de Kafka (`tweet.created`, `tweet.liked`, `user.followed`) y el keyspace de Cassandra se crean automáticamente al levantar la infraestructura (contenedores `kafka-init` y `cassandra-init`). No es necesario crearlos manualmente.

### 4. Instalar dependencias y arrancar servicios

Este es un monorepo con **npm workspaces**. Instalar todo una sola vez desde la raíz, y compilar el paquete compartido antes de arrancar los servicios:

```bash
npm install                          # instala todos los workspaces
npm run build -w packages/shared     # @xcloud/shared (lo consumen los servicios)
```

#### Opción A — Script todo-en-uno (recomendado)

Arranca los 8 microservicios **y** el SPA desde **una sola terminal**:

```bash
./start-dev.sh
```

Cada proceso corre en segundo plano; los logs van a `logs/<servicio>.log`.
Para ver la salida de un servicio en tiempo real:

```bash
tail -f logs/tweet-service.log
```

Presiona `Ctrl+C` para detener todos los procesos a la vez.

#### Opción B — Una terminal por servicio

```bash
# Terminal 1 — Auth Service          (puerto 3000)
cd apps/services/auth-service && npm run dev

# Terminal 2 — User Service          (3001)
cd apps/services/user-service && npm run dev

# Terminal 3 — Tweet Service         (3002)
cd apps/services/tweet-service && npm run dev

# Terminal 4 — Feed Service          (3003)
cd apps/services/feed-service && npm run dev

# Terminal 5 — Fan-out Service       (worker + /health 3007)
cd apps/services/fanout-service && npm run dev

# Terminal 6 — Notification Service  (3004)
cd apps/services/notification-service && npm run dev

# Terminal 7 — Search Service        (3005)
cd apps/services/search-service && npm run dev
```

> En local, la mensajería usa **Kafka** (vía `docker compose`). En AWS (`NODE_ENV=production`) los mismos servicios usan **SQS/SNS** — la conmutación es automática en `@xcloud/shared`.

### 5. Arrancar el cliente web (opcional)

El SPA en `apps/web/` consume todos los servicios via un proxy de Vite (`/api/v1/<service>/*` → `http://localhost:<port>/v1/<service>/*`).

> Si usaste `./start-dev.sh` (opción A), el SPA ya está corriendo en `:5173` — no hace falta este paso.

```bash
cd apps/web && npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173). El proxy y la `VITE_API_BASE_URL=/api` están configurados en `apps/web/vite.config.ts` y `apps/web/.env`. Ver [apps/web/README.md](apps/web/README.md) para detalles.

## Nota importante — PostgreSQL local

Si tienes PostgreSQL instalado localmente en tu máquina, puede generar conflicto con el contenedor Docker en el puerto 5432. Solución: detener el servicio local antes de ejecutar el proyecto:

```powershell
# Windows (PowerShell como administrador)
Stop-Service postgresql-x64-17
```

## API Endpoints

### Auth Service (puerto 3000)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/v1/auth/register` | No | Registrar usuario |
| POST | `/v1/auth/login` | No | Login, obtener JWT |
| GET | `/v1/auth/me` | Bearer | Datos del usuario actual |

### User Service (puerto 3001)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/users/:handle` | No | Obtener perfil por handle |
| GET | `/v1/users/by-id/:userId` | No | Obtener perfil por userId |
| GET | `/v1/users/search?q=...` | No | Buscar usuarios por handle o nombre |
| PUT | `/v1/users/me` | Bearer | Actualizar perfil propio |
| POST | `/v1/users/:userId/follow` | Bearer | Seguir a un usuario |
| DELETE | `/v1/users/:userId/follow` | Bearer | Dejar de seguir |
| GET | `/v1/users/:userId/follow` | Bearer | Estado de follow (¿ya lo sigo?) |
| GET | `/v1/users/:userId/following` | No | Lista de usuarios que sigue |
| GET | `/v1/users/:userId/followers` | No | Lista de seguidores |

> Al registrarse via Auth Service se crea automáticamente la fila en `users` (transacción atómica con `auth_users`).

> Las rutas `/:handle`, `PUT /me`, `POST/DELETE /:userId/follow` se sirven con los **handlers Smithy SSDK generados** — ruteo, validación y serialización salen del contrato (ver [SDK de servidor generado](#sdk-de-servidor-generado-xcloudsdk-server)).

### Tweet Service (puerto 3002)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/v1/tweets` | Bearer | Publicar tweet o reply |
| GET | `/v1/tweets/:tweetId` | No | Obtener tweet por ID |
| DELETE | `/v1/tweets/:tweetId` | Bearer | Eliminar tweet propio |
| GET | `/v1/tweets/:tweetId/replies` | No | Replies de un tweet |
| POST | `/v1/tweets/:tweetId/like` | Bearer | Dar like |
| DELETE | `/v1/tweets/:tweetId/like` | Bearer | Quitar like |
| GET | `/v1/tweets/:tweetId/like` | Bearer | Estado de like |
| POST | `/v1/tweets/:tweetId/retweet` | Bearer | Retweet |
| DELETE | `/v1/tweets/:tweetId/retweet` | Bearer | Quitar retweet |
| GET | `/v1/tweets/:tweetId/retweet` | Bearer | Estado de retweet |
| GET | `/v1/tweets/by-author/:authorId` | No | Tweets de un autor (perfil) |
| GET | `/v1/tweets/liked-by/:userId` | No | Tweets likeados por un usuario |

### Feed Service (puerto 3003)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/feed?cursor=X&limit=20` | Bearer | Feed del usuario autenticado |

### Notification Service (puerto 3004)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/notifications` | Bearer | Listar notificaciones |
| PUT | `/v1/notifications/:id/read` | Bearer | Marcar como leída |

### Search Service (puerto 3005)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/search?q=...&type=tweets` | No | Buscar tweets por keyword |

## Prueba end-to-end

### 1. Registrar usuarios (Auth Service)

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/v1/auth/register -ContentType "application/json" -Body '{"handle":"alice","email":"alice@test.com","password":"secret123"}'
Invoke-RestMethod -Method POST -Uri http://localhost:3000/v1/auth/register -ContentType "application/json" -Body '{"handle":"bob","email":"bob@test.com","password":"secret123"}'
```

### 2. Login (Auth Service)

```powershell
$alice = (Invoke-RestMethod -Method POST -Uri http://localhost:3000/v1/auth/login -ContentType "application/json" -Body '{"email":"alice@test.com","password":"secret123"}').token
$bob = (Invoke-RestMethod -Method POST -Uri http://localhost:3000/v1/auth/login -ContentType "application/json" -Body '{"email":"bob@test.com","password":"secret123"}').token
```

### 3. Crear perfiles (User Service)

```powershell
Invoke-RestMethod -Method PUT -Uri http://localhost:3001/v1/users/me -ContentType "application/json" -Headers @{Authorization="Bearer $alice"} -Body '{"displayName":"Alice"}'
Invoke-RestMethod -Method PUT -Uri http://localhost:3001/v1/users/me -ContentType "application/json" -Headers @{Authorization="Bearer $bob"} -Body '{"displayName":"Bob"}'
```

### 4. Alice sigue a Bob (User Service)

```powershell
# Reemplazar <bob-userId> con el userId real de Bob
Invoke-RestMethod -Method POST -Uri http://localhost:3001/v1/users/<bob-userId>/follow -Headers @{Authorization="Bearer $alice"}
```

### 5. Bob publica un tweet (Tweet Service)

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3002/v1/tweets -ContentType "application/json" -Headers @{Authorization="Bearer $bob"} -Body '{"content":"Hello world! #firsttweet"}'
```

En las terminales se debería ver:
- **Tweet Service**: `Published tweet.created`
- **Fan-out Service**: `Fan-out tweet ... to 1 followers`
- **Search Service**: `Indexing tweet ...`

### 6. Alice consulta su feed (Feed Service)

```powershell
Invoke-RestMethod -Method GET -Uri http://localhost:3003/v1/feed -Headers @{Authorization="Bearer $alice"}
```

### 7. Buscar tweets (Search Service)

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3005/v1/search?q=firsttweet&type=tweets"
```

### 8. Alice da like (Tweet Service → Notification Service)

```powershell
# Reemplazar <tweetId> con el ID real del tweet
Invoke-RestMethod -Method POST -Uri http://localhost:3002/v1/tweets/<tweetId>/like -Headers @{Authorization="Bearer $alice"}
```

### 9. Bob consulta notificaciones (Notification Service)

```powershell
Invoke-RestMethod -Method GET -Uri http://localhost:3004/v1/notifications -Headers @{Authorization="Bearer $bob"}
```

## Tests unitarios

Cada servicio tiene tests con Jest y mocks (también la infraestructura CDK,
con assertions sobre los templates sintetizados). Ejecutar todos desde la raíz:

```bash
npm test --workspaces --if-present
```

O uno individual:

```bash
cd apps/services/feed-service && npm test
```

Notas:
- **fanout-service y feed-service usan `jest --forceExit`**: sus suites importan
  (vía el automock de Jest) módulos que abren una conexión real a Redis al
  cargarse, lo que dejaría el proceso colgado al terminar. No quitar el flag.
- **auth-service** transpila `uuid` con ts-jest (`transformIgnorePatterns` +
  `allowJs` en su bloque `jest`): `uuid@14` es ESM-only y Jest en CJS no puede
  parsearlo de otra forma.

## Infraestructura Docker

| Contenedor | Imagen | Puerto | Equivalente AWS |
|---|---|---|---|
| xcloud-postgres | postgres:17 | 5432 | Amazon RDS PostgreSQL |
| xcloud-cassandra | cassandra:4.1 | 9042 | Amazon Keyspaces |
| xcloud-redis | redis:7-alpine | 6379 | Amazon ElastiCache |
| xcloud-kafka | apache/kafka:3.7.0 | 9092 | Amazon MSK |
| xcloud-opensearch | opensearchproject/opensearch:2.13.0 | 9200 | Amazon OpenSearch |

## Smithy API Model

Los modelos Smithy en `api-model/model/` definen el contrato formal de la API. Para generar el OpenAPI spec:

```bash
cd api-model
smithy build
```

El OpenAPI generado queda en `api-model/build/smithy/openapi/openapi/TwitterService.openapi.json`.

Requiere el [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html) (`brew install smithy-cli`). Las dependencias de plugins (openapi, aws-traits, codegen TS) se declaran en `api-model/smithy-build.json` (bloque `maven`) y el CLI las descarga solo — ya no se necesita Gradle ni un JDK aparte.

### Cliente TypeScript generado (`@xcloud/sdk-client`)

El SPA consume un **cliente tipado generado desde el modelo Smithy** para las
operaciones modeladas (**tweets, users, feed** — incl. like/follow). Auth,
notificaciones y búsqueda no están en el modelo y siguen escritas a mano.

```bash
# Requiere el Smithy CLI. Genera packages/sdk-client y packages/sdk-server
# (src/ y dist/ de ambos están gitignored).
npm run generate
```

`apps/web/src/api/{tweets,users,feed}.ts` usan los `*Command` generados via
`apps/web/src/api/twitter-client.ts` (endpoint `<origin>/api` → proxy de Vite,
JWT por el esquema `@httpBearerAuth`). Detalles y notas de versión en
[docs/sdk-generation.md](docs/sdk-generation.md).

### SDK de servidor generado (`@xcloud/sdk-server`)

El mismo modelo también genera el **server SDK (SSDK)**, consumido por el
backend (`npm run generate` genera ambos paquetes):

- **user-service (piloto SSDK completo):** `GetUser`, `UpdateUser`,
  `FollowUser` y `UnfollowUser` se sirven con los handlers generados — el
  ruteo, la (de)serialización, la validación de constraints del modelo y los
  códigos de error salen del contrato, no de código a mano (ver
  `apps/services/user-service/src/smithy/`).
- **tweet-service / feed-service (solo tipos):** los controllers tipan sus
  requests contra los `*ServerInput` generados; si el modelo cambia, el build
  falla.

Así, frontend y backend comparten **un solo contrato** definido en
`api-model/model/*.smithy`.

## Infraestructura AWS (CDK)

La infraestructura como código está en dos repositorios:

- **`xcloud-api/infrastructure/`** — co-located en el monorepo (fuente de verdad durante desarrollo)
- **`xcloud-infrastructure/`** — repositorio separado de IaC (reflejo sincronizado, para revisión independiente por el equipo de cloud)

Contiene **11 stacks CDK** para desplegar en ECS Fargate:

| Stack | Responsabilidad |
|---|---|
| `NetworkingStack` | VPC, subnets, NAT Gateway |
| `DatabaseStack` | RDS PostgreSQL, Keyspaces |
| `CacheStack` | ElastiCache Redis |
| `MessagingStack` | SQS + SNS (fan-out tweet.created → 2 colas) |
| `SearchStack` | OpenSearch (beta: deshabilitado) |
| `StorageStack` | S3 bucket para media |
| `AuthStack` | Cognito User Pool + grupos |
| `EcsStack` | ECS Fargate — 8 servicios + ALB |
| `GatewayStack` | API Gateway (producción) |
| `CdnStack` | CloudFront + S3 SPA |
| `MonitoringStack` | CloudWatch alarmas + dashboards |

Para sintetizar las plantillas de **beta** (sin desplegar):

```bash
cd infrastructure
npx cdk synth --context env=beta
```

Beta usa `enableSearch=false`, 1 NAT Gateway, 1 task por servicio (~$136/mes). Ver `docs/adr/` para las decisiones de arquitectura (SQS sobre MSK, ECS sobre EKS).

## Estructura del proyecto

```
xcloud-api/
├── package.json                  # raíz de npm workspaces
├── tsconfig.base.json
├── docker-compose.yml            # infra local (Postgres, Cassandra, Redis, Kafka, ES)
├── .env.example
├── db/                           # init.sql (PostgreSQL) + cassandra-init.cql
├── api-model/                    # Smithy CLI (genera OpenAPI)
├── apps/
│   ├── web/                      # Frontend React 19 + Vite (SPA)
│   └── services/
│       ├── auth-service/         # :3000 — registro, login, JWT
│       ├── user-service/         # :3001 — perfiles, follow, búsqueda (SSDK piloto)
│       ├── tweet-service/        # :3002 — tweets, likes, retweets, replies
│       ├── feed-service/         # :3003 — timeline, cursor pagination, gRPC
│       ├── notification-service/ # :3004 — notificaciones, WebSocket publisher
│       ├── search-service/       # :3005 — full-text OpenSearch
│       ├── media-service/        # :3006 — stub (S3 en producción)
│       └── fanout-service/       # worker + /health :3007 — fan-out on write
├── packages/
│   ├── shared/                   # @xcloud/shared (auth, mensajería Kafka/SQS, utils)
│   ├── sdk-client/               # Cliente TS generado desde Smithy (usado por apps/web)
│   └── sdk-server/               # Server SDK (SSDK) generado desde Smithy (usado por los services)
├── infrastructure/               # AWS CDK (ECS, RDS, ElastiCache, SQS/SNS, ...)
├── k8s/                          # manifiestos Kubernetes (solo referencia, ver ADR-002)
└── docs/                         # ADRs, runbooks, baseline de migración
```
