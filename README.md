# X(dot)com — Twitter Clone Platform

Plataforma de red social en la nube inspirada en la arquitectura de X/Twitter. Implementada como un sistema de microservicios con comunicación asíncrona via Kafka, caché en Redis y búsqueda full-text con Elasticsearch.

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
| Auth Service | 3000 | Registro (valida handle), login, JWT | PostgreSQL (`auth_users`) |
| User Service | 3001 | Perfiles, follow/unfollow | PostgreSQL (`users`, `follows`) |
| Tweet Service | 3002 | CRUD tweets, likes, retweets, replies, estado por usuario | Cassandra (`tweets`, `likes`, `retweets`, `replies_by_tweet`) |
| Feed Service | 3003 | Timeline personalizado | Redis (cache) + Cassandra (fallback) |
| Fan-out Service | — | Distribuye tweets/retweets a feeds | Redis (escritura) + PostgreSQL (lectura) |
| Notification Service | 3004 | Notificaciones (likes/retweets/follows) + push **WebSocket** | PostgreSQL (`notifications`) |
| Search Service | 3005 | Búsqueda full-text de tweets **y usuarios** | Elasticsearch (`tweets`, `users`) |
| Media Service | 3006 | Subida de imágenes (disco local / S3) | disco local (dev) / S3 (prod) |

### Comunicación entre servicios

- **REST** para APIs públicas (cliente → servicio)
- **WebSocket** para notificaciones en tiempo real (notification-service → SPA)
- **Kafka** (local) / **SQS+SNS** (prod) para comunicación asíncrona entre servicios (eventos)
- **HTTP interno** para hidratación de datos (Feed → Tweet Service)

### Topics de Kafka

| Topic | Productor | Consumidores |
|---|---|---|
| `tweet.created` | Tweet Service | Fan-out Service, Search Service |
| `tweet.liked` | Tweet Service | Notification Service |
| `tweet.retweeted` | Tweet Service | Fan-out Service, Notification Service |
| `user.followed` | User Service | Notification Service |
| `user.created` | Auth Service | Search Service (índice de usuarios) |
| `user.updated` | User Service | Search Service (índice de usuarios) |

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
ELASTICSEARCH_URL=http://localhost:9200
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_KEYSPACE=xcloud
```

### 3. Levantar infraestructura

```bash
docker compose up -d
```

Esto levanta: PostgreSQL, Cassandra, Redis, Kafka (KRaft) y Elasticsearch.

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
./scripts/start-dev.sh
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

> Si usaste `./scripts/start-dev.sh` (opción A), el SPA ya está corriendo en `:5173` — no hace falta este paso.

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

> El `handle` se valida en el registro contra la misma regla del contrato Smithy (`^[a-zA-Z0-9_]{4,20}$` — letras, números y guion bajo). Así, un handle que se puede crear siempre se puede resolver vía `GET /v1/users/:handle` (servido por el SSDK, que aplica la misma restricción).

### User Service (puerto 3001)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/users/:handle` | No | Obtener perfil por handle |
| GET | `/v1/users/by-id/:userId` | No | Obtener perfil por userId (usado por hidratación de tweets) |
| GET | `/v1/users/:userId/following` | No | Listar a quién sigue el usuario |
| GET | `/v1/users/:userId/followers` | No | Listar quién sigue al usuario |
| POST | `/v1/users/following-status` | Bearer | ¿Cuáles de un lote de userIds sigue el viewer? (botones follow) |
| PUT | `/v1/users/me` | Bearer | Actualizar perfil propio |
| POST | `/v1/users/:userId/follow` | Bearer | Seguir a un usuario |
| DELETE | `/v1/users/:userId/follow` | Bearer | Dejar de seguir |

> Nota: al registrarse via Auth Service se crea automáticamente la fila correspondiente en la tabla `users` (transacción atómica con `auth_users`), por lo que el perfil queda disponible inmediatamente sin necesidad de un `PUT /v1/users/me` previo.

> Nota: salvo `/by-id/:userId`, estas rutas se sirven con los **handlers Smithy SSDK generados** desde el modelo (ver [SDK de servidor generado](#sdk-de-servidor-generado-xcloudsdk-server)) — el ruteo, la validación y la serialización salen del contrato.

### Tweet Service (puerto 3002)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/v1/tweets` | Bearer | Publicar tweet |
| GET | `/v1/tweets/author/:authorId` | No | Listar tweets de un usuario (perfil) |
| GET | `/v1/tweets/liked/:userId` | No | Listar tweets que un usuario dio like (pestaña Likes) |
| GET | `/v1/tweets/:tweetId/replies` | No | Listar respuestas de un tweet |
| GET | `/v1/tweets/:tweetId` | No | Obtener tweet por ID |
| DELETE | `/v1/tweets/:tweetId` | Bearer | Eliminar tweet propio |
| POST | `/v1/tweets/:tweetId/like` | Bearer | Dar like |
| DELETE | `/v1/tweets/:tweetId/like` | Bearer | Quitar like |
| POST | `/v1/tweets/:tweetId/retweet` | Bearer | Retuitear |
| DELETE | `/v1/tweets/:tweetId/retweet` | Bearer | Quitar retweet |
| POST | `/v1/tweets/interactions` | Bearer | Estado like/retweet del usuario para un lote de tweetIds |

### Feed Service (puerto 3003)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/feed?cursor=X&limit=20` | Bearer | Feed del usuario autenticado |

### Notification Service (puerto 3004)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/notifications` | Bearer | Listar notificaciones |
| PUT | `/v1/notifications/:id/read` | Bearer | Marcar como leída |
| WS | `/v1/notifications/ws?token=<jwt>` | JWT (query) | Notificaciones en tiempo real (push) |

> El WebSocket entrega likes/retweets/follows en tiempo real; el JWT se valida en el handshake (`?token=`). El SPA muestra un badge de no leídas y actualiza la lista al vuelo.

### Media Service (puerto 3006)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/v1/media` | Bearer | Subir imagen (multipart, campo `file`); devuelve `{ url }` |
| GET | `/v1/media/files/:name` | No | Servir imagen (solo dev; en prod es S3/CloudFront) |

> Almacenamiento híbrido: disco local en dev (`uploads/`), S3 en producción (`NODE_ENV`). Acepta PNG/JPEG/GIF/WebP hasta 5 MB. El composer del SPA sube la imagen y guarda la URL en `mediaUrls` del tweet.

### Search Service (puerto 3005)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/v1/search?q=...&type=tweets` | No | Buscar tweets por keyword/hashtag |
| GET | `/v1/search?q=...&type=users` | No | Buscar usuarios por handle/nombre/bio |

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
| xcloud-elasticsearch | elasticsearch:8.13.0 | 9200 | Amazon OpenSearch |

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

La carpeta `infrastructure/` contiene el IaC (AWS CDK) para desplegar en ECS Fargate. Para sintetizar las plantillas de **beta** (sin desplegar):

```bash
cd infrastructure
npx cdk synth --context env=beta
```

Beta usa `enableSearch=true` (OpenSearch `t3.small.search`, ~$25/mes extra), 1 NAT, 1 task por servicio. Ver `docs/adr/` para las decisiones (SQS sobre MSK, ECS sobre EKS).

### Deploy y teardown de beta (scripts)

Para levantar y bajar el entorno beta con una sola orden cada uno (desde la raíz).
**Se pasa el perfil AWS como argumento** (obligatorio) — así eliges la cuenta
correcta y no hay forma de desplegar en la equivocada:

```bash
./scripts/deploy-beta.sh personal     # build+push imágenes a ECR + cdk deploy --all (env=beta)
./scripts/bootstrap-beta.sh personal  # crea el schema de Amazon Keyspaces (Postgres se crea solo al arrancar)
./scripts/deploy-web.sh personal      # build del SPA + s3 sync + invalidación de CloudFront
./scripts/status-beta.sh personal     # READ-ONLY: ¿queda algo corriendo? ¿me están cobrando?
./scripts/destroy-beta.sh personal    # cdk destroy --all (env=beta) — borra TODO
```

✅ **Desplegado y funcionando end-to-end** (us-east-2): auth, tweets, perfiles,
follows, feed, media y el **SPA React en CloudFront**. El flujo completo y, sobre
todo, las **incompatibilidades reales de Amazon Keyspaces** que se encontraron y
corrigieron (batches `LOGGED`, consistencia `LOCAL_ONE`, `SELECT COUNT(*)`), más
el SSL de RDS y el guard FIFO de SNS, están en
[docs/runbooks/aws-deploy.md](docs/runbooks/aws-deploy.md). Resumen del schema:
**Postgres (RDS)** lo crean los servicios al arrancar (`ensurePostgresSchema`,
porque RDS está en subredes privadas); **Cassandra (Keyspaces)** se crea con
`./scripts/bootstrap-beta.sh` desde tu máquina (endpoint público, TLS + SigV4).

**Frontend en AWS:** el stack `cdn` (S3 privado + CloudFront) sirve el SPA en `/`
y enruta `/api/*` al ALB como segundo origen (una CloudFront Function quita el
prefijo `/api`) — así las llamadas del SPA son same-origin (sin CORS ni
mixed-content). Los archivos se suben por CLI con `./scripts/deploy-web.sh` (no con
`BucketDeployment`).

**Búsqueda en AWS:** beta tiene `enableSearch:true`, así que la búsqueda full-text
sí funciona. search-service usa el cliente `@opensearch-project/opensearch` con
firma **SigV4** (rol de la task IAM) en producción — se cambió desde
`@elastic/elasticsearch` porque su cliente v8 rechaza un dominio OpenSearch. Solo
indexa eventos posteriores a su despliegue (no hay backfill). Detalle en
[docs/runbooks/aws-deploy.md](docs/runbooks/aws-deploy.md).

`scripts/status-beta.sh` no cambia nada: lista los stacks beta y cuenta los recursos
"always-on" facturables (NAT Gateway, tasks Fargate, RDS, ALB, ElastiCache) y
dice `✅ CLEAN` o `⚠️ RESOURCES LIVE`. Úsalo después de `scripts/destroy-beta.sh` para
confirmar que no quedó nada drenando créditos.

Configura un perfil con nombre por cuenta una sola vez (evita usar `default`
para cuentas importantes):

```bash
aws configure --profile personal     # cuenta con créditos
aws configure --profile work
aws configure --profile colleagues
```

Ambos scripts **imprimen el perfil + cuenta + región AWS y piden confirmación
(`yes`) antes de tocar nada**. Requieren AWS CLI configurado y Docker corriendo
(CDK construye las imágenes de los servicios).

> ⚠️ **Costo:** beta corre recursos NO incluidos en el free tier (NAT Gateway +
> Fargate + ALB, ~$0.10/hora). Esos cargos consumen tus **créditos AWS** (no
> salen de tu bolsillo si tienes los ~$200 de crédito, pero sí los gastan, ~$11–15
> por 3 días). RDS y ElastiCache t3.micro sí entran en el free tier de 12 meses.
> **Ejecuta `./scripts/destroy-beta.sh` apenas termines la demo** para frenar el consumo.

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
│   ├── web/                      # Frontend React (Vite)
│   └── services/
│       ├── auth-service/         # 3000   user-service/ 3001   tweet-service/ 3002
│       ├── feed-service/         # 3003   notification-service/ 3004   search-service/ 3005
│       ├── media-service/        # 3006 (subida de imágenes: disco local / S3)
│       └── fanout-service/       # worker + /health 3007
├── packages/
│   ├── shared/                   # @xcloud/shared (auth, mensajería Kafka/SQS, utils)
│   ├── sdk-client/               # Cliente TS generado desde Smithy (usado por apps/web)
│   └── sdk-server/               # Server SDK (SSDK) generado desde Smithy (usado por los services)
├── infrastructure/               # AWS CDK (ECS, RDS, ElastiCache, SQS/SNS, ...)
├── k8s/                          # manifiestos Kubernetes (solo referencia, ver ADR-002)
└── docs/                         # ADRs, runbooks, baseline de migración
```
