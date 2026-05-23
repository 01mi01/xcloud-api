# xcloud-api — Twitter Clone API

Definición del modelo API de un clon de Twitter construido con **Smithy 2.0**. El proyecto genera un esquema **OpenAPI 3.1** a partir de los modelos Smithy mediante el plugin Gradle oficial de Amazon.

---

## Prerequisitos

Antes de comenzar, asegúrate de tener instalado lo siguiente:

### Software requerido

| Software | Versión mínima | Verificación |
|---|---|---|
| **Java JDK** | 17 o superior | `java -version` |
| **Git** | 2.x | `git --version` |


### Nota sobre Gradle
**No es necesario instalar Gradle manualmente.** El proyecto incluye el Gradle Wrapper (`gradlew` / `gradlew.bat`) que descarga automáticamente la versión correcta (8.11.1) la primera vez que se ejecuta.

---

## Tecnologías

| Herramienta | Versión |
|---|---|
| Smithy IDL | 2.0 |
| Smithy Core | 1.45.0 |
| Smithy Gradle Plugin | 1.4.0 (`smithy-base`) |
| Gradle (wrapper) | 8.11.1 |
| Java | 17+ |

---

## Estructura del proyecto

```
x-api/
├── build.gradle              # Configuración de Gradle y dependencias
├── settings.gradle           # Nombre del proyecto y repositorios de plugins
├── gradle.properties         # JAVA_HOME apuntando a Java 17
├── smithy-build.json         # Configuración de Smithy Build (proyecciones)
├── gradlew / gradlew.bat     # Wrapper de Gradle
└── model/
    ├── service.smithy        # Definición del servicio principal TwitterService
    ├── common.smithy         # Tipos compartidos: UUID, Handle, Timestamp, etc.
    ├── user.smithy           # Estructuras y operaciones de usuario
    ├── tweet.smithy          # Estructuras y operaciones de tweets
    ├── like.smithy           # Operaciones de likes
    ├── follow.smithy         # Operaciones de seguimiento
    └── feed.smithy           # Operación de feed
```

---

## Servicio

El servicio `TwitterService` (namespace `com.twitter`) expone **10 operaciones REST** protegidas con autenticación Bearer (`@httpBearerAuth`) y serialización JSON (`@restJson1`).

### Usuarios

| Operación | Método | URI | Descripción |
|---|---|---|---|
| `GetUser` | `GET` | `/v1/users/{handle}` | Obtiene el perfil de un usuario por su handle |
| `UpdateUser` | `PUT` | `/v1/users/me` | Actualiza el perfil del usuario autenticado |

### Tweets

| Operación | Método | URI | Descripción |
|---|---|---|---|
| `CreateTweet` | `POST` | `/v1/tweets` | Publica un nuevo tweet |
| `GetTweet` | `GET` | `/v1/tweets/{tweetId}` | Obtiene un tweet por su ID |
| `DeleteTweet` | `DELETE` | `/v1/tweets/{tweetId}` | Elimina un tweet propio |

### Likes

| Operación | Método | URI | Descripción |
|---|---|---|---|
| `LikeTweet` | `POST` | `/v1/tweets/{tweetId}/like` | Da like a un tweet |
| `UnlikeTweet` | `DELETE` | `/v1/tweets/{tweetId}/like` | Quita el like de un tweet |

### Seguimiento

| Operación | Método | URI | Descripción |
|---|---|---|---|
| `FollowUser` | `POST` | `/v1/users/{userId}/follow` | Sigue a un usuario |
| `UnfollowUser` | `DELETE` | `/v1/users/{userId}/follow` | Deja de seguir a un usuario |

### Feed

| Operación | Método | URI | Descripción |
|---|---|---|---|
| `GetFeed` | `GET` | `/v1/feed` | Obtiene el feed paginado del usuario autenticado |

---

## Tipos comunes (`common.smithy`)

| Tipo | Restricciones |
|---|---|
| `UUID` | Patrón UUID v4 (`^[0-9a-f]{8}-...$`) |
| `Handle` | Alfanumérico + guión bajo, 4–20 caracteres |
| `TweetContent` | Texto, 1–280 caracteres |
| `Timestamp` | String ISO 8601 |

---

## Errores globales

| Error | HTTP | Descripción |
|---|---|---|
| `UnauthorizedException` | 401 | Token ausente o inválido |
| `ValidationException` | 400 | Datos de entrada inválidos |
| `UserNotFoundException` | 404 | Usuario no encontrado |
| `TweetNotFoundException` | 404 | Tweet no encontrado |
| `ForbiddenException` | 403 | Sin permisos para la operación |
| `ConflictException` | 409 | Recurso ya existe (ej. like duplicado) |

---

## Ejecutar el build

Requiere **Java 17** instalado. El wrapper descarga Gradle 8.11.1 automáticamente.

```bash
./gradlew build
```

Los artefactos generados se depositan en:

```
build/smithyprojections/x-api/
├── source/     # Modelo Smithy validado
└── openapi/    # Esquema OpenAPI 3.1 generado
```

Para limpiar los artefactos:

```bash
./gradlew clean
```

---

## Proyecciones (`smithy-build.json`)

| Proyección | Plugin | Descripción |
|---|---|---|
| `source` | — | Validación del modelo fuente |
| `openapi` | `openapi` | Genera el contrato OpenAPI 3.1 para `com.twitter#TwitterService` |

---

## Autenticación

Todas las operaciones de escritura (y el feed) requieren un **Bearer Token** en la cabecera HTTP:

```
Authorization: Bearer <token>
```

Las operaciones de lectura públicas (`GetUser`, `GetTweet`) no requieren autenticación.
