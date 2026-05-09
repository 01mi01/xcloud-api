require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
const { CognitoJwtVerifier } = require("aws-jwt-verify");

// Verifier checks the token against our Cognito User Pool
const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: "access",
    clientId: process.env.COGNITO_CLIENT_ID,
});

// Middleware to protect routes — user identity always comes from the token
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = await verifier.verify(token);
        // Attach decoded token payload to request for downstream use
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token is invalid or expired" });
    }
};

module.exports = { verifyToken };