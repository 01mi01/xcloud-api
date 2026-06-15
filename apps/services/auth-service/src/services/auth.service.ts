import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { dbConfig, JWT_SECRET, JWT_EXPIRES, SALT_ROUNDS } from "../config/cognito.config";
import { publishUserCreated } from "../events/user.producer";

const pool = new Pool(dbConfig);

export interface AuthTokens {
    AccessToken: string;
    IdToken:     string;
    ExpiresIn:   number;
}

export class UsernameExistsError extends Error {
    constructor(m: string) { super(m); this.name = "UsernameExistsException"; }
}
export class NotAuthorizedError extends Error {
    constructor(m: string) { super(m); this.name = "NotAuthorizedException"; }
}

// Signs a JWT with the same claim shape used at login (sub/email/username/groups).
const issueToken = (userId: string, handle: string, email: string, role: string): string =>
    jwt.sign(
        { sub: userId, email, username: handle, "cognito:groups": [role] },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );

export const registerUser = async (handle: string, email: string, password: string): Promise<{ userId: string; token: string }> => {
    const existing = await pool.query("SELECT user_id FROM auth_users WHERE email = $1", [email]);
    if (existing.rows.length > 0) throw new UsernameExistsError("Email already registered");

    const userId       = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create both the credential record (auth_users) and the public profile
    // row (users) in a single transaction so the user-service can resolve the
    // profile by handle immediately after registration.
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            "INSERT INTO auth_users (user_id, handle, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
            [userId, handle, email, passwordHash, "user"]
        );
        await client.query(
            `INSERT INTO users (user_id, handle, display_name)
             VALUES ($1, $2, $2)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, handle]
        );
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }

    // Publish outside the transaction so a messaging hiccup never rolls back a
    // committed registration. search-service indexes the new user from this.
    await publishUserCreated({ userId, handle, displayName: handle, createdAt: new Date().toISOString() });

    // §3.1 — registration returns a JWT so the client is logged in immediately.
    return { userId, token: issueToken(userId, handle, email, "user") };
};

export const loginUser = async (email: string, password: string): Promise<AuthTokens> => {
    const { rows } = await pool.query(
        "SELECT user_id, handle, email, password_hash, role FROM auth_users WHERE email = $1",
        [email]
    );

    if (rows.length === 0) throw new NotAuthorizedError("Invalid credentials");

    const user  = rows[0] as { user_id: string; handle: string; email: string; password_hash: string; role: string };
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new NotAuthorizedError("Invalid credentials");

    const token = issueToken(user.user_id, user.handle, user.email, user.role);

    return { AccessToken: token, IdToken: token, ExpiresIn: 8 * 60 * 60 };
};

export const assignUserToGroup = async (_email: string, _group: string): Promise<void> => {};
