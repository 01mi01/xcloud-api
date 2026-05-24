# Auth Service — xcloud-api

Authentication and authorization service for the X (Twitter) clone project.

Built with Node.js and AWS Cognito using OIDC/JWT.

## Prerequisites
- [Node.js v22+](https://nodejs.org/)
- [AWS CLI](https://aws.amazon.com/cli/)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/01mi01/xcloud-api.git
cd xcloud-api/x-api/auth-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file at the root of `xcloud-api` with these values:

```
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_CLIENT_SECRET=
AWS_REGION=
PORT=
```

### 4. Configure AWS credentials

```bash
aws configure
```

Enter your AWS Access Key ID, Secret Access Key, region and output format (`json`).

### 5. Start the service

```bash
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | /v1/auth/register | No | Register a new user |
| POST | /v1/auth/login | No | Login and get JWT token |
| GET | /v1/auth/me | Yes (Bearer token) | Get current user from token |

## Tests

### Test 1 — Register a new user

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/v1/auth/register" -Method POST -ContentType "application/json" -Body '{"handle":"testuser1","email":"test1@test.com","password":"Test1234!"}' -UseBasicParsing
```

**Expected response — 201 Created:**

```json
{
  "userId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "User registered successfully"
}
```

> If you see `409 Email already registered` the user already exists, go to Test 2.

### Test 2 — Login and save JWT token

**Step 1 — Login:**
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"test1@test.com","password":"Test1234!"}' -UseBasicParsing
```

**Step 2 — Save the token:**
```powershell
$token = ($response.Content | ConvertFrom-Json).token
```

> The token is saved in `$token` for Test 3.

### Test 3 — Access protected endpoint using JWT

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/v1/auth/me" -Method GET -Headers @{Authorization="Bearer $token"} -UseBasicParsing
```

**Expected response — 200 OK:**

```json
{
  "userId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "role": "user"
}
```

## Roles

| Role | Precedence | Description |
|------|------------|-------------|
| user | 2 | Default role assigned on registration |
| admin | 1 | Administrative access |

Roles are managed through AWS Cognito User Pool Groups.

## Project Structure

```
auth-service/
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Entry point
│   ├── middleware/
│   │   └── auth.js         # JWT verification middleware
│   ├── routes/
│   │   └── authRoutes.js   # Register, login, me endpoints
│   └── services/
│       └── cognitoService.js  # AWS Cognito integration
├── package.json
└── README.md
```