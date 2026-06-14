# X(dot)com — Gaps de Implementación vs. Documento de Diseño Técnico

**Fecha de auditoría:** 2026-06-13  
**Rama auditada:** `main`  
**Preparado por:** Claude Code (auditoría automática)  
**Presentación ante:** PhD. Jhesser Guzmán

---

## Resumen Ejecutivo

| Categoría | Total requerido | Implementado | Faltante |
|---|---|---|---|
| Endpoints REST | 19 | 16 | 3 |
| Topics Kafka / Eventos | 3 | 3 | 0 |
| Tablas de base de datos | 8 | 7 | 1 (parcial) |
| Stacks CDK (infraestructura) | 11 | 11 (en xcloud-api/infrastructure) | 0 |
| Servicios backend corriendo | 8 | 8 | 0 |
| WebSocket / Tiempo real | 1 | Parcial (publisher existe, server no activo) | — |
| Repo xcloud-infrastructure separado | — | Vacío | Crítico |

**Estado general:** El sistema corre y cubre los flujos core. Los gaps son puntuales y solucionables antes de la presentación.

---

## 1. ENDPOINTS FALTANTES

### 1.1 POST /v1/tweets/{tweetId}/retweet — RESUELTO ✅ (2026-06-13)

**Definido en:** Diseño §3.3  
**Archivo afectado:** [apps/services/tweet-service/src/routes/tweet.routes.ts](../apps/services/tweet-service/src/routes/tweet.routes.ts)

El endpoint de retweet / quote-tweet está completamente ausente. El diseño lo especifica así:

```
POST /v1/tweets/{tweetId}/retweet     // Auth requerida
body: { "comment": string }           // opcional → quote tweet si está presente
response 201: Tweet
errors:
  404 → tweet original no encontrado
  409 → ya retweeteó este tweet (sin comentario)
```

**Lo que falta implementar:**
- Ruta `router.post("/:tweetId/retweet", verifyToken, ctrl.retweetTweet)` en tweet.routes.ts
- Método `retweetTweet` en tweet.controller.ts
- Lógica en tweet.service.ts: insertar tweet con `reply_to_tweet_id` apuntando al original, publicar evento `tweet.created`
- Validación 409 si ya retweeteó (sin comentario)

---

### 1.2 GET /v1/search?type=users — INCOMPLETO ⚠️

**Definido en:** Diseño §3.4  
**Archivo afectado:** [apps/services/search-service/src/controllers/search.controller.ts](../apps/services/search-service/src/controllers/search.controller.ts)

El diseño define `type: "tweets" | "users"`. Actualmente `type=users` retorna `400 Bad Request` con el mensaje `"Unsupported search type. Use 'tweets'."` — esto está hardcodeado y visible.

```typescript
// Línea 26-28 — search.controller.ts
} else {
    // type=users search would go here in a future iteration
    res.status(400).json({ message: "Unsupported search type. Use 'tweets'." });
}
```

**Lo que falta implementar:**
- Indexar usuarios en Elasticsearch (en user-service, publicar evento al crear/actualizar perfil, o indexar directamente)
- Método `searchUsers(q, limit, cursor)` en search.service.ts
- Rama `type === "users"` en el controller

---

### 1.3 DELETE /v1/users/me — FALTANTE ❌

**Definido en:** Diseño §6.4 (Seguridad / GDPR-CCPA)  
**Archivo afectado:** [apps/services/user-service/src/routes/user.routes.ts](../apps/services/user-service/src/routes/user.routes.ts)

El documento menciona explícitamente:

> "Endpoint `DELETE /v1/users/me` implementa borrado completo (hard delete en UserDB, soft delete en TweetDB marcado para purga batch a 30 días)."

Actualmente user.routes.ts solo tiene `GET /:handle`, `GET /by-id/:userId`, `PUT /me`, `POST /:userId/follow`, `DELETE /:userId/follow`. El endpoint de baja de cuenta no existe.

**Lo que falta implementar:**
- Ruta `router.delete("/me", verifyToken, ctrl.deleteMe)` en user.routes.ts
- Método `deleteMe` en user.controller.ts
- Lógica en user.service.ts: hard delete en tabla `users` + `auth_users`, soft delete / TTL en Cassandra (campo `is_deleted`)

---

## 2. MODELO DE DATOS — GAPS

### 2.1 Campo `is_deleted` ausente en tabla `tweets` de Cassandra ⚠️

**Definido en:** Diseño §5.2 y §6.1  
**Archivo afectado:** [db/cassandra-init.cql](../db/cassandra-init.cql)

El diseño especifica soft-delete en Cassandra para soporte GDPR:

| Columna | Tipo | Restricciones |
|---|---|---|
| `is_deleted` | BOOLEAN | default false |

El CQL actual **no tiene este campo**. La tabla `tweets` tampoco tiene el campo en `tweets_by_author`.

**Impacto:** El endpoint `DELETE /v1/tweets/{tweetId}` realiza hard delete o simplemente no marca el registro. Para el flujo GDPR de `DELETE /v1/users/me` esto es necesario.

---

### 2.2 `likes_count` y `retweet_count` como INT, no COUNTER ⚠️

**Definido en:** Diseño §6.1  
**Archivo afectado:** [db/cassandra-init.cql](../db/cassandra-init.cql)

El diseño especifica tipo `COUNTER` para consistencia eventual en actualizaciones concurrentes. El CQL actual los define como `INT`. Los `COUNTER` en Cassandra tienen semántica especial (no mezclan con columnas regulares) — requeriría una tabla separada o cambiar el modelo.

**Impacto:** A baja escala (dev/demo) no es visible, pero es una inconsistencia con el diseño técnico que el docente puede señalar.

---

### 2.3 TTL de datos en Cassandra (7 años tweets, 2 años likes) — No configurado ⚠️

**Definido en:** Diseño §6.9 (Retención de datos)

| Almacén | TTL diseño |
|---|---|
| Keyspaces — tweets | 7 años |
| Keyspaces — likes | 2 años |

En el CQL de inicialización no hay `DEFAULT TTL` definido en ninguna tabla. En el ambiente local esto no impacta funcionalmente, pero el diseño lo menciona como parte de la estrategia de retención.

---

## 3. SEGURIDAD — GAPS

### 3.1 bcrypt en lugar de Argon2id ⚠️

**Definido en:** Diseño §6.4 — "Passwords hasheados con **Argon2id** (nunca bcrypt en nuevas implementaciones)."  
**Archivo afectado:** [apps/services/auth-service/src/services/auth.service.ts](../apps/services/auth-service/src/services/auth.service.ts) línea 2 y 27

```typescript
import bcrypt from "bcrypt";           // línea 2
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);  // línea 27
```

El diseño es explícito: Argon2id, no bcrypt. Esta es una decisión de seguridad documentada.

**Lo que falta:** Reemplazar `bcrypt` por `argon2` (package `argon2` en npm). El cambio afecta solo `auth.service.ts`.

---

### 3.2 Rate limiting en POST /v1/auth/login — No visible ⚠️

**Definido en:** Diseño §3.1 — "429 → rate limit excedido (máx 10 intentos/min por IP)"  
**Archivo afectado:** [apps/services/auth-service/src/routes/auth.routes.ts](../apps/services/auth-service/src/routes/auth.routes.ts)

El route de login no tiene middleware de rate limiting. El error 429 nunca se devuelve.

**Lo que falta:** Agregar `express-rate-limit` en la ruta de login:
```typescript
import rateLimit from "express-rate-limit";
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10 });
router.post("/login", loginLimiter, login);
```

---

### 3.3 Validación de formato de `handle` en registro ⚠️

**Definido en:** Diseño §3.1 — "handle: solo `[a-zA-Z0-9_]`, 4-20 chars"  
**Archivo afectado:** [apps/services/auth-service/src/controllers/auth.controller.ts](../apps/services/auth-service/src/controllers/auth.controller.ts)

El controller solo valida que `handle` no esté vacío, no valida formato ni longitud. Un handle como `"ab"` o `"handle con espacios"` se aceptaría actualmente.

**Lo que falta:** Agregar validación regex antes de llamar a `registerUser`:
```typescript
const handleRegex = /^[a-zA-Z0-9_]{4,20}$/;
if (!handleRegex.test(handle)) {
    res.status(400).json({ message: "handle must be 4-20 chars, only letters, numbers and _" });
    return;
}
```

---

## 4. WEBSOCKETS — INCOMPLETO ⚠️

**Definido en:** Diseño §4.3 (Flujo de Notificaciones en Tiempo Real) y §5.3  
**Archivos relevantes:**
- [apps/services/notification-service/src/websocket/ws.publisher.ts](../apps/services/notification-service/src/websocket/ws.publisher.ts) — existe y está bien implementado
- [apps/services/notification-service/src/index.ts](../apps/services/notification-service/src/index.ts) — **no inicia servidor WebSocket**

El publisher (`ws.publisher.ts`) tiene implementado `registerConnection`, `removeConnection` y `pushToUser`. Sin embargo, el `index.ts` del servicio **solo inicia el servidor HTTP** — nunca arranca un servidor WebSocket (`ws.Server` o similar) que acepte conexiones entrantes.

**Consecuencia:** Las funciones `pushToUser` nunca son invocadas porque no hay conexiones registradas. Las notificaciones se guardan en DB correctamente pero no se entregan en tiempo real.

**Lo que falta:**
- Importar `ws` o `socket.io` en `index.ts`
- Crear `wss = new WebSocket.Server({ server: httpServer })`
- En el `connection` event: autenticar el JWT del cliente, llamar `registerConnection(userId, ws)`
- En el `close` event: llamar `removeConnection(userId, ws)`

---

## 5. gRPC — PARCIALMENTE IMPLEMENTADO ⚠️

**Definido en:** Diseño §3.5

| RPC | Estado |
|---|---|
| `GetTweetsByIds` (Feed → Tweet) | ✅ Implementado (`feed-service/src/grpc/tweet.client.ts`) |
| `GetUserNotificationPrefs` (Notification → User) | ❌ No implementado |
| `ValidateMediaIds` (Media → Tweet) | ❌ No implementado (Media Service es stub) |

Los dos RPCs faltantes están bloqueados por la falta de implementación de Media Service. Para la presentación pueden documentarse como "Fase 2 / dependientes de Media Service".

---

## 6. REPOSITORIO xcloud-infrastructure — VACÍO ❌

**Ruta:** `C:\Users\Hp\Desktop\MAESTRIA\ESPECIALIDAD\JHESSER GUZMAN\xcloud-infrastructure\xcloud-infrastructure`

Este repositorio contiene solo el stack de ejemplo generado por `cdk init` con todo comentado:

```typescript
// lib/xcloud-infrastructure-stack.ts
export class XcloudInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // The code that defines your stack goes here
    // example resource
    // const queue = new sqs.Queue(this, 'XcloudInfrastructureQueue', { ... });
  }
}
```

La infraestructura real (11 stacks CDK completos) está en `xcloud-api/infrastructure/`. Si el docente revisa el repo separado, verá un proyecto vacío.

**Opciones:**
1. Copiar/mover el contenido de `xcloud-api/infrastructure/` a `xcloud-infrastructure/`
2. Referenciar en la presentación que la infraestructura está co-located en el monorepo `xcloud-api/infrastructure/`

---

## 7. RESPUESTA DEL REGISTER — Incompleta vs. Diseño ⚠️

**Definido en:** Diseño §3.1 — `response 201: { "userId": string, "token": JWT }`  
**Archivo afectado:** [apps/services/auth-service/src/controllers/auth.controller.ts](../apps/services/auth-service/src/controllers/auth.controller.ts) línea 16

```typescript
// Implementado actualmente:
res.status(201).json({ userId, message: "User registered successfully" });

// Diseño espera:
res.status(201).json({ userId: string, token: JWT });
```

El registro no retorna un JWT — el cliente debe hacer login por separado. El diseño dice que el registro devuelve el token directamente.

---

## TABLA DE PRIORIDADES

| # | Gap | Impacto en presentación | Esfuerzo estimado |
|---|---|---|---|
| 1 | **Repo xcloud-infrastructure vacío** | Alto — el docente puede revisarlo | Bajo (copiar archivos) |
| 2 | ~~**POST /retweet faltante**~~ ✅ RESUELTO | Alto — endpoint core del diseño | Medio (2-3 horas) |
| 3 | **bcrypt en lugar de Argon2id** | Alto — el diseño lo prohíbe explícitamente | Bajo (30 min) |
| 4 | **Response de /register sin token** | Medio — inconsistencia de contrato | Bajo (15 min) |
| 5 | **Rate limiting en /login** | Medio — el diseño especifica 429 | Bajo (30 min) |
| 6 | **Validación de handle en registro** | Medio — el diseño especifica regex | Bajo (20 min) |
| 7 | **WebSocket server no iniciado** | Medio — el diseño tiene diagrama dedicado | Medio (2 horas) |
| 8 | **is_deleted en Cassandra** | Bajo — mencionado en diseño §6.1 | Bajo (5 min en CQL) |
| 9 | **GET /search?type=users** | Bajo — admisible como "Fase 2" | Alto (requiere indexado de users) |
| 10 | **DELETE /v1/users/me (GDPR)** | Bajo — admisible como "Fase 2" | Medio (1-2 horas) |
| 11 | **TTL en Cassandra** | Bajo — solo en producción (Keyspaces) | Bajo (solo en CQL) |
| 12 | **gRPC GetUserNotificationPrefs / ValidateMediaIds** | Bajo — dependen de Media Service stub | Alto |

---

## LO QUE SÍ ESTÁ BIEN ✅

Para contexto completo, esto es lo que **sí cumple** con el diseño:

- **8 microservicios** corriendo en sus puertos correctos (3000–3007)
- **Mensajería híbrida** Kafka local / SQS+SNS producción implementada en `@xcloud/shared`
- **3 topics** (`tweet.created`, `tweet.liked`, `user.followed`) con productores y consumidores correctos
- **Fan-out on write** implementado en fanout-service (Redis feed cache por userId)
- **Feed con cursor pagination** y cache Redis + fallback Cassandra
- **gRPC GetTweetsByIds** entre feed-service y tweet-service funcionando
- **11 stacks CDK** cubriendo toda la infraestructura AWS del diseño
- **Ambientes** beta / gamma / prod definidos en CDK
- **MonitoringStack** con alarmas CloudWatch alineadas al diseño §6.3
- **Cognito** configurado en AuthStack (User Pool + grupos admin/moderator/user)
- **Modelo de datos PostgreSQL** (users, follows, notifications) coincide con el diseño §6.1
- **Modelo de datos Cassandra** (tweets, tweets_by_author, likes, likes_by_user) con partition key correcto
- **Frontend React** con todas las páginas del flujo core (home, login, register, profile, search, notifications)
- **Vite proxy** configurado correctamente para rutear `/api/v1/<servicio>/*` a cada puerto

---

*Documento generado automáticamente mediante auditoría de código. Verificar con `git log` cualquier cambio posterior a 2026-06-13.*
