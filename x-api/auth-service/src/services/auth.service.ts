import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { dbConfig, JWT_SECRET, JWT_EXPIRES, SALT_ROUNDS } from "../config/cognito.config";

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

export const registerUser = async (handle: string, email: string, password: string): Promise<string> => {
    const existing = await pool.query("SELECT user_id FROM auth_users WHERE email = $1", [email]);
    if (existing.rows.length > 0) throw new UsernameExistsError("Email already registered");

    const userId       = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query(
        "INSERT INTO auth_users (user_id, handle, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
        [userId, handle, email, passwordHash, "user"]
    );

    return userId;
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

    const payload = {
        sub:              user.user_id,
        email:            user.email,
        username:         user.handle,
        "cognito:groups": [user.role],
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return { AccessToken: token, IdToken: token, ExpiresIn: 8 * 60 * 60 };
};

export const assignUserToGroup = async (_email: string, _group: string): Promise<void> => {};
