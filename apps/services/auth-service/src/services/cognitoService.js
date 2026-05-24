/**
 * LOCAL DEV MODE — Cognito is disabled to avoid AWS costs during development.
 * To re-enable Cognito, uncomment the Cognito block and comment out the local block.
 *
 * What changes when switching back to Cognito:
 *  - registerUser  → SignUpCommand + AdminAddUserToGroupCommand
 *  - loginUser     → InitiateAuthCommand (returns AccessToken, IdToken, ExpiresIn)
 *  - assignUserToGroup → AdminAddUserToGroupCommand
 *  - auth middleware → CognitoJwtVerifier instead of jwt.verify
 */

// ── Cognito (disabled) ────────────────────────────────────────────────────────
// const {
//   CognitoIdentityProviderClient,
//   SignUpCommand,
//   InitiateAuthCommand,
//   AdminAddUserToGroupCommand,
// } = require("@aws-sdk/client-cognito-identity-provider");
// const crypto = require("crypto");
// const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
// const computeSecretHash = (username) =>
//   crypto.createHmac("SHA256", process.env.COGNITO_CLIENT_SECRET)
//         .update(username + process.env.COGNITO_CLIENT_ID).digest("base64");
// ─────────────────────────────────────────────────────────────────────────────

// ── Local dev ─────────────────────────────────────────────────────────────────
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const SALT_ROUNDS = 10;
const JWT_SECRET  = process.env.JWT_SECRET || "xcloud-local-dev-secret";
const JWT_EXPIRES = "8h";

const registerUser = async (handle, email, password) => {
    const existing = await pool.query("SELECT user_id FROM auth_users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
        const err = new Error("Email already registered");
        err.name = "UsernameExistsException";
        throw err;
    }

    const userId       = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query(
        "INSERT INTO auth_users (user_id, handle, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
        [userId, handle, email, passwordHash, "user"]
    );

    return userId;
};

const loginUser = async (email, password) => {
    const { rows } = await pool.query(
        "SELECT user_id, handle, email, password_hash, role FROM auth_users WHERE email = $1",
        [email]
    );

    if (rows.length === 0) {
        const err = new Error("Invalid credentials");
        err.name = "NotAuthorizedException";
        throw err;
    }

    const user  = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        const err = new Error("Invalid credentials");
        err.name = "NotAuthorizedException";
        throw err;
    }

    const payload = {
        sub:                user.user_id,
        email:              user.email,
        username:           user.handle,
        "cognito:groups":   [user.role],
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return {
        AccessToken: token,
        IdToken:     token,
        ExpiresIn:   8 * 60 * 60,
    };
};

// No-op in local mode — role is stored in auth_users table
const assignUserToGroup = async (_email, _group) => {};

module.exports = { registerUser, loginUser, assignUserToGroup };
