import * as svc from "../src/services/auth.service";
import { Pool } from "pg";
import bcrypt from "bcrypt";

jest.mock("pg", () => {
    // registerUser corre la inserción dentro de una transacción: además de
    // pool.query (chequeo de existencia) usa pool.connect() → client.query/release.
    const mockClient = { query: jest.fn(), release: jest.fn() };
    const query = jest.fn();
    return { Pool: jest.fn(() => ({ query, connect: jest.fn(async () => mockClient) })) };
});
jest.mock("bcrypt");
// registerUser publishes user.created via @xcloud/shared (Kafka locally). Mock
// the producer so tests don't open a real broker connection (slow + open handle).
jest.mock("../src/events/user.producer");

const mockPool  = new Pool({}) as jest.Mocked<Pool>;
const mockQuery = mockPool.query as jest.Mock;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

beforeEach(() => jest.clearAllMocks());

describe("registerUser", () => {
    it("creates user and returns userId", async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing email
        (mockBcrypt.hash as jest.Mock).mockResolvedValue("hashed");

        const result = await svc.registerUser("alice", "alice@example.com", "secret");
        // registerUser now returns { userId, token } (register issues a JWT).
        expect(typeof result.userId).toBe("string");
        expect(typeof result.token).toBe("string");

        const client = await (mockPool as unknown as { connect(): Promise<{ query: jest.Mock }> }).connect();
        const statements = client.query.mock.calls.map((c) => String(c[0]));
        expect(statements).toContain("BEGIN");
        expect(statements.some((s) => s.includes("INSERT INTO auth_users"))).toBe(true);
        expect(statements.some((s) => s.includes("INSERT INTO users"))).toBe(true);
        expect(statements).toContain("COMMIT");
    });

    it("throws UsernameExistsException when email already registered", async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ user_id: "existing" }] });
        await expect(svc.registerUser("alice", "alice@example.com", "secret"))
            .rejects.toMatchObject({ name: "UsernameExistsException" });
    });
});

describe("loginUser", () => {
    it("returns tokens when credentials are valid", async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ user_id: "uuid-1", handle: "alice", email: "alice@example.com", password_hash: "hashed", role: "user" }],
        });
        (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

        const tokens = await svc.loginUser("alice@example.com", "secret");
        expect(tokens).toHaveProperty("AccessToken");
        expect(tokens).toHaveProperty("IdToken");
    });

    it("throws NotAuthorizedException when user not found", async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await expect(svc.loginUser("ghost@example.com", "secret"))
            .rejects.toMatchObject({ name: "NotAuthorizedException" });
    });

    it("throws NotAuthorizedException when password is wrong", async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ user_id: "uuid-1", handle: "alice", email: "alice@example.com", password_hash: "hashed", role: "user" }],
        });
        (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);
        await expect(svc.loginUser("alice@example.com", "wrong"))
            .rejects.toMatchObject({ name: "NotAuthorizedException" });
    });
});
