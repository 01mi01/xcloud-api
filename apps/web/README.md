# xcloud Web Client

SPA en React 18 + TypeScript + Vite que consume los 7 microservicios de `x-api/`.

## Stack

- React 18, React Router 6
- Vite 5 (dev server con proxy)
- TypeScript estricto
- Sin librería de estado externa: `AuthContext` + hooks locales

## Setup

```bash
npm install
npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173).

### Variables de entorno

`apps/web/.env`:

```
VITE_API_BASE_URL=/api
```

El cliente nunca llama directamente a `http://localhost:300X`. Todas las peticiones pasan por el proxy de Vite, que reescribe `/api/v1/<service>/*` → `http://localhost:<port>/v1/<service>/*`.

## Proxy de Vite

Configurado en `vite.config.ts`. Mapeo:

| Path frontend | Backend |
|---|---|
| `/api/v1/auth/*` | `http://localhost:3000/v1/auth/*` |
| `/api/v1/users/*` | `http://localhost:3001/v1/users/*` |
| `/api/v1/tweets/*` | `http://localhost:3002/v1/tweets/*` |
| `/api/v1/feed/*` | `http://localhost:3003/v1/feed/*` |
| `/api/v1/notifications/*` | `http://localhost:3004/v1/notifications/*` |
| `/api/v1/search/*` | `http://localhost:3005/v1/search/*` |

Para que la app funcione end-to-end **todos** los servicios deben estar arriba — ver el [README principal](../../README.md).

## Estructura

```
src/
├── api/                    # Capa HTTP (un módulo por servicio)
│   ├── client.ts           # apiFetch + ApiError + token storage
│   ├── auth.ts
│   ├── users.ts
│   ├── tweets.ts
│   ├── feed.ts
│   ├── notifications.ts
│   └── hydrate.ts          # RawTweet[] → Tweet[] resolviendo authors
├── context/
│   └── AuthContext.tsx     # status: "loading" | "authed" | "anon"
├── components/
│   ├── ProtectedRoute.tsx
│   ├── layout/
│   └── tweet/              # TweetComposer, TweetCard
├── pages/                  # Login, Register, Home, Search, ...
└── types/index.ts          # User, RawTweet, Tweet, AuthIdentity
```

## Flujo de autenticación

1. `POST /v1/auth/login` → recibe `{ token, userId }`
2. Token guardado en `localStorage` bajo la clave `xcloud_token`
3. `AuthContext` decodifica el JWT para obtener el `handle` (claim `username`) y llama a `GET /v1/users/:handle` para hidratar el perfil
4. Todas las llamadas posteriores envían `Authorization: Bearer <token>` automáticamente (ver `api/client.ts`)

`ProtectedRoute` espera a `status !== "loading"` y redirige a `/login` si el estado es `"anon"`.

## Hidratación de tweets

El backend devuelve tweets con `authorId` pero sin el objeto `author`. `hydrateTweets()` en `api/hydrate.ts`:

1. Recolecta los `authorId` únicos del batch
2. Llama en paralelo a `GET /v1/users/by-id/:userId` para cada uno
3. Devuelve `Tweet[]` con el campo `author: User` resuelto
4. Si una petición falla, sustituye por un `User` placeholder en lugar de romper el render

## Scripts

```bash
npm run dev      # Vite dev server (HMR)
npm run build    # Build producción → dist/
npm run preview  # Preview del build
npm run lint     # ESLint
```

## Notas

- El JWT expira a las 8h; cuando una petición devuelve 401, `apiFetch` lanza un `ApiError` con `status === 401` y el código que lo recibe debe llamar a `logout()`.
- Los flags `liked` / `retweeted` por viewer aún no están expuestos por el backend; el cliente los inicializa a `false`.
