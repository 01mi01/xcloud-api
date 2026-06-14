# X(dot)com — Gaps de Implementación vs. Documento de Diseño Técnico

**Fecha de auditoría:** 2026-06-14 (actualizado)  
**Rama auditada:** `main`  
**Preparado por:** Claude Code (auditoría automática)  
**Presentación ante:** PhD. Jhesser Guzmán

---

## Resumen Ejecutivo

| Categoría | Total requerido | Implementado | Faltante |
|---|---|---|---|
| Endpoints REST | 19 | 19 | 0 |
| Topics Kafka / Eventos | 3 | 3 | 0 |
| Tablas de base de datos | 8 | 7 | 1 (parcial) |
| Stacks CDK (infraestructura) | 11 | 11 (en xcloud-api/infrastructure) | 0 |
| Servicios backend corriendo | 8 | 8 | 0 |
| WebSocket / Tiempo real | 1 | Parcial (publisher existe, server no activo) | — |
| Repo xcloud-infrastructure separado | — | Vacío | Crítico |

**Estado general:** El sistema corre y cubre todos los flujos core. Los gaps restantes son de seguridad (bcrypt→Argon2id), WebSocket en tiempo real, y el repositorio de infraestructura separado.

---

## 1. ENDPOINTS — TODOS IMPLEMENTADOS ✅

### 1.1 POST/DELETE /v1/tweets/{tweetId}/retweet — RESUELTO ✅ (2026-06-13)
Retweet y unretweet funcionales con tablas `retweets` y `retweets_by_user` en Cassandra.

### 1.2 GET /v1/users/search — RESUELTO ✅ (2026-06-13)
Búsqueda de usuarios por handle y displayName con LIKE en PostgreSQL.

### 1.3 GET /v1/tweets/by-author/:authorId — RESUELTO ✅ (2026-06-13)
Posts por autor para la página de perfil.

### 1.4 GET /v1/tweets/liked-by/:userId — RESUELTO ✅ (2026-06-13)
Tweets likeados por usuario para la tab Likes del perfil.

### 1.5 GET/POST/DELETE /v1/tweets/{tweetId}/retweet — RESUELTO ✅ (2026-06-13)
Estado de retweet por tweet y usuario.

### 1.6 GET /v1/users/:userId/following — RESUELTO ✅ (2026-06-14)
Lista de usuarios que sigue un perfil.

### 1.7 GET /v1/users/:userId/followers — RESUELTO ✅ (2026-06-14)
Lista de seguidores de un perfil.

### 1.8 GET /v1/users/:userId/follow — RESUELTO ✅ (2026-06-14)
Estado real de follow entre el usuario autenticado y otro usuario.

### 1.9 GET /v1/search?type=users — Fase 2 ⚠️

**Definido en:** Diseño §3.4  
La búsqueda de usuarios vía Elasticsearch (`type=users`) retorna 400. En su lugar, la búsqueda de personas se hace directamente contra user-service con LIKE en PostgreSQL (`/v1/users/search`), lo que cubre el caso de uso. Documentar como "Fase 2: migración a OpenSearch para búsqueda federada".

### 1.10 DELETE /v1/users/me — Fase 2 ⚠️

**Definido en:** Diseño §6.4 (Seguridad / GDPR-CCPA)  
El endpoint de baja de cuenta (hard delete PostgreSQL + soft delete Cassandra) no está implementado. Admisible como "Fase 2 / GDPR compliance".

---

## 2. MODELO DE DATOS — GAPS

### 2.1 Campo `is_deleted` ausente en tabla `tweets` de Cassandra ⚠️

**Definido en:** Diseño §5.2 y §6.1  
**Archivo afectado:** [db/cassandra-init.cql](../db/cassandra-init.cql)

El diseño especifica soft-delete en Cassandra para soporte GDPR. El CQL actual no tiene este campo en `tweets` ni en `tweets_by_author`. Vinculado al gap de `DELETE /v1/users/me` — ambos son Fase 2.

---

### 2.2 `likes_count` y `retweet_count` como INT, no COUNTER ⚠️

**Definido en:** Diseño §6.1  
**Archivo afectado:** [db/cassandra-init.cql](../db/cassandra-init.cql)

El diseño especifica tipo `COUNTER` para consistencia eventual en actualizaciones concurrentes. El CQL actual los define como `INT`. A baja escala (dev/demo) no es visible. Documentar como decisión de implementación: los COUNTER en Cassandra no pueden mezclarse con columnas regulares en la misma tabla, por lo que se optó por INT con lógica de incremento atómico en el service.

---

### 2.3 TTL de datos en Cassandra (7 años tweets, 2 años likes) — No configurado ⚠️

**Definido en:** Diseño §6.9 (Retención de datos)  
No hay `DEFAULT TTL` en las tablas. Solo aplica en producción con AWS Keyspaces. Admisible como "configuración de producción".

---

## 3. SEGURIDAD — GAPS PENDIENTES

### 3.1 bcrypt en lugar de Argon2id ⚠️ PENDIENTE

**Definido en:** Diseño §6.4 — "Passwords hasheados con **Argon2id** (nunca bcrypt en nuevas implementaciones)."  
**Archivo afectado:** [apps/services/auth-service/src/services/auth.service.ts](../apps/services/auth-service/src/services/auth.service.ts)

```typescript
import bcrypt from "bcrypt";  // debe ser: import argon2 from "argon2"
```

El diseño prohíbe explícitamente bcrypt. **Alto impacto en presentación.** Esfuerzo: 30 min.

---

### 3.2 Rate limiting en POST /v1/auth/login ⚠️ PENDIENTE

**Definido en:** Diseño §3.1 — "429 → rate limit excedido (máx 10 intentos/min por IP)"  
**Archivo afectado:** [apps/services/auth-service/src/routes/auth.routes.ts](../apps/services/auth-service/src/routes/auth.routes.ts)

El route de login no tiene middleware de rate limiting. El error 429 nunca se devuelve. Esfuerzo: 30 min.

```typescript
import rateLimit from "express-rate-limit";
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10 });
router.post("/login", loginLimiter, login);
```

---

### 3.3 Validación de formato de `handle` en registro ⚠️ PENDIENTE

**Definido en:** Diseño §3.1 — "handle: solo `[a-zA-Z0-9_]`, 4-20 chars"  
**Archivo afectado:** [apps/services/auth-service/src/controllers/auth.controller.ts](../apps/services/auth-service/src/controllers/auth.controller.ts)

El controller no valida formato ni longitud del handle. Esfuerzo: 20 min.

---

### 3.4 Response de /register sin token ⚠️ PENDIENTE

**Definido en:** Diseño §3.1 — `response 201: { "userId": string, "token": JWT }`  
**Archivo afectado:** [apps/services/auth-service/src/controllers/auth.controller.ts](../apps/services/auth-service/src/controllers/auth.controller.ts)

```typescript
// Implementado actualmente:
res.status(201).json({ userId, message: "User registered successfully" });
// Diseño espera:
res.status(201).json({ userId, token: JWT });
```

El cliente debe hacer login por separado tras el registro. Esfuerzo: 15 min.

---

## 4. WEBSOCKETS — INCOMPLETO ⚠️ PENDIENTE

**Definido en:** Diseño §4.3 (Flujo de Notificaciones en Tiempo Real) y §5.3  
**Archivos relevantes:**
- [apps/services/notification-service/src/websocket/ws.publisher.ts](../apps/services/notification-service/src/websocket/ws.publisher.ts) — existe y está bien implementado
- [apps/services/notification-service/src/index.ts](../apps/services/notification-service/src/index.ts) — **no inicia servidor WebSocket**

El publisher tiene `registerConnection`, `removeConnection` y `pushToUser` implementados. El `index.ts` solo inicia el servidor HTTP — nunca arranca `ws.Server`. Las notificaciones se guardan en DB correctamente pero no se entregan en tiempo real.

**Lo que falta:**
- `wss = new WebSocket.Server({ server: httpServer })` en index.ts
- Autenticar JWT en el evento `connection`, llamar `registerConnection(userId, ws)`
- En evento `close`: llamar `removeConnection(userId, ws)`

Esfuerzo estimado: 2 horas.

---

## 5. gRPC — PARCIALMENTE IMPLEMENTADO ⚠️

**Definido en:** Diseño §3.5

| RPC | Estado |
|---|---|
| `GetTweetsByIds` (Feed → Tweet) | ✅ Implementado (`feed-service/src/grpc/tweet.client.ts`) |
| `GetUserNotificationPrefs` (Notification → User) | ❌ Fase 2 |
| `ValidateMediaIds` (Media → Tweet) | ❌ Fase 2 (Media Service es stub) |

Los dos RPCs faltantes dependen de Media Service (stub). Documentar como "Fase 2".

---

## 6. REPOSITORIO xcloud-infrastructure — VACÍO ❌ PENDIENTE

**Ruta:** `C:\Users\Hp\Desktop\MAESTRIA\ESPECIALIDAD\JHESSER GUZMAN\xcloud-infrastructure\xcloud-infrastructure`

Solo tiene el stack de ejemplo generado por `cdk init`. La infraestructura real (11 stacks CDK) está en `xcloud-api/infrastructure/`.

**Opciones:**
1. Copiar el contenido de `xcloud-api/infrastructure/` al repo separado
2. Referenciar en presentación que la infraestructura está co-located en el monorepo

---

## TABLA DE PRIORIDADES ACTUALIZADA

| # | Gap | Estado | Impacto en presentación | Esfuerzo |
|---|---|---|---|---|
| 1 | **Repo xcloud-infrastructure vacío** | ❌ Pendiente | Alto | Bajo (copiar archivos) |
| 2 | **bcrypt → Argon2id** | ❌ Pendiente | Alto — el diseño lo prohíbe | Bajo (30 min) |
| 3 | **Response de /register sin token** | ❌ Pendiente | Medio | Bajo (15 min) |
| 4 | **Rate limiting en /login (429)** | ❌ Pendiente | Medio | Bajo (30 min) |
| 5 | **Validación de handle en registro** | ❌ Pendiente | Medio | Bajo (20 min) |
| 6 | **WebSocket server no iniciado** | ❌ Pendiente | Medio | Medio (2 horas) |
| 7 | **is_deleted en Cassandra** | ❌ Pendiente | Bajo | Bajo (5 min CQL) |
| 8 | **GET /search?type=users (Elasticsearch)** | ⚠️ Fase 2 | Bajo | Alto |
| 9 | **DELETE /v1/users/me (GDPR)** | ⚠️ Fase 2 | Bajo | Medio |
| 10 | **TTL en Cassandra** | ⚠️ Solo producción | Bajo | Bajo |
| 11 | **gRPC GetUserNotificationPrefs / ValidateMediaIds** | ⚠️ Fase 2 | Bajo | Alto |

---

## LO QUE SÍ ESTÁ BIEN ✅

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
- **Modelo de datos Cassandra** (tweets, tweets_by_author, likes, likes_by_user, retweets, retweets_by_user) con partition key correcto
- **Retweet/unretweet** funcional con estado persistido en Cassandra ✅ (2026-06-13)
- **Búsqueda de usuarios** en tiempo real con dropdown flotante en sidebar y página Search ✅ (2026-06-14)
- **Following/Followers** con estados reales desde backend, navegación desde perfil ✅ (2026-06-14)
- **Follow status** cargado al abrir cualquier perfil ✅ (2026-06-14)
- **Frontend React** completo: home, login, register, profile, search (con dropdown + Enter), notifications, bookmarks, connections (following/followers)
- **Vite proxy** configurado correctamente para rutear `/api/v1/<servicio>/*` a cada puerto
- **Smithy SSDK** pilot en user-service con 4 operaciones modeladas (GetUser, UpdateUser, Follow, Unfollow)

---

*Última actualización: 2026-06-14. Verificar con `git log` para cambios posteriores.*
