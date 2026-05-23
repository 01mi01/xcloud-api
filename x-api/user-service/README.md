# User Service — xcloud-api

Profile management and social graph (follow/unfollow) for the X clone project.

Built with Node.js, Express and PostgreSQL.

## Prerequisites
- [Node.js v22+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/01mi01/xcloud-api.git
cd xcloud-api
```

### 2. Configure environment variables

Copy `.env.example` and fill in the values:

```bash
cp x-api/auth-service/.env.example .env
```

The DB variables are already set for local Docker development — no changes needed for local dev:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xcloud
DB_USER=postgres
DB_PASSWORD=postgres
```

### 3. Start the database

From the **root** of the repository:

```bash
docker compose up -d
```

This starts a PostgreSQL 17 container on port 5432 and runs `db/init.sql` automatically to create the tables.

Verify it's running:

```bash
docker compose ps
```

### 4. Install dependencies

```bash
cd x-api/user-service
npm install
```

### 5. Start the service

```bash
npm run dev
```

The service runs on port **3001** by default.

---

## API Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET    | /v1/users/:handle        | No  | Get user profile by handle |
| PUT    | /v1/users/me             | Yes | Update own profile |
| POST   | /v1/users/:userId/follow | Yes | Follow a user |
| DELETE | /v1/users/:userId/follow | Yes | Unfollow a user |

---

## Tests

Get a Bearer token first from the auth-service (`POST /v1/auth/login`), then:

### Get user profile
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/v1/users/testuser1" -Method GET -UseBasicParsing
```

### Update own profile
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/v1/users/me" -Method PUT `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body '{"displayName":"Test User","bio":"Hello world"}' `
  -UseBasicParsing
```

### Follow a user
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/v1/users/<userId>/follow" -Method POST `
  -Headers @{Authorization="Bearer $token"} `
  -UseBasicParsing
```

### Unfollow a user
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/v1/users/<userId>/follow" -Method DELETE `
  -Headers @{Authorization="Bearer $token"} `
  -UseBasicParsing
```

---

## Stop the database

```bash
docker compose down
```

To also delete all data:

```bash
docker compose down -v
```

---

## Project Structure

```
user-service/
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Entry point
│   ├── middleware/
│   │   └── auth.js         # JWT verification middleware
│   ├── routes/
│   │   └── userRoutes.js   # GET handle, PUT me, follow, unfollow
│   └── services/
│       └── userService.js  # PostgreSQL queries
├── package.json
└── README.md
```
