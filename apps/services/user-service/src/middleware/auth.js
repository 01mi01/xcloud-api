require("dotenv").config({ path: require("path").resolve(__dirname, "../../../../.env") });
const jwt = require("jsonwebtoken");

// ── Cognito (disabled) ────────────────────────────────────────────────────────
// const { CognitoJwtVerifier } = require("aws-jwt-verify");
// const verifier = CognitoJwtVerifier.create({
//     userPoolId: process.env.COGNITO_USER_POOL_ID,
//     tokenUse: "access",
//     clientId: process.env.COGNITO_CLIENT_ID,
// });
// ─────────────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "xcloud-local-dev-secret";

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];

    try {
        // Local dev: verify with JWT_SECRET
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();

        // Cognito (disabled):
        // const payload = await verifier.verify(token);
        // req.user = payload;
        // next();
    } catch (err) {
        return res.status(401).json({ message: "Token is invalid or expired" });
    }
};

module.exports = { verifyToken };
