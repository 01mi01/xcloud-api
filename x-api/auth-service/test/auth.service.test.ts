import * as svc from "../src/services/auth.service";
import { Pool } from "pg";
import bcrypt from "bcrypt";

jest.mock("pg", () => {
    const query = jest.fn();
    return { Pool: jest.fn(() => ({ query })) };
});
jest.mock("bcrypt");

const mockPool  = new Pool({}) as jest.Mocked<Pool>;
const mockQuery = mockPool.query as jest.Mock;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

beforeEach(() => jest.clearAllMocks());

describe("registerUser", () => {
    it("creates user and returns userId", async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });
        (mockBcrypt.hash as jest.Mock).mockResolvedValue("hashed");

        const userId = await svc.registerUser("alice", "alice@example.com", "secret");
        expect(typeof userId).toBe("string");
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
