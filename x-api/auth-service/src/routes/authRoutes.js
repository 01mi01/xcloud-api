const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  assignUserToGroup,
} = require("../services/cognitoService");
const { verifyToken } = require("../middleware/auth");

// POST /v1/auth/register — creates a new user in Cognito and assigns default role
router.post("/register", async (req, res) => {
  const { handle, email, password } = req.body;

  if (!handle || !email || !password) {
    return res
      .status(400)
      .json({ message: "handle, email and password are required" });
  }

  try {
    const userId = await registerUser(handle, email, password);
    // All new users get the default "user" role
    await assignUserToGroup(email, "user");
    return res
      .status(201)
      .json({ userId, message: "User registered successfully" });
  } catch (err) {
    if (err.name === "UsernameExistsException") {
      return res.status(409).json({ message: "Email already registered" });
    }
    return res.status(400).json({ message: err.message });
  }
});

// POST /v1/auth/login — authenticates user and returns Cognito JWT
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  try {
    const tokens = await loginUser(email, password);
    return res.status(200).json({
      token: tokens.AccessToken,
      idToken: tokens.IdToken,
      expiresAt: new Date(Date.now() + tokens.ExpiresIn * 1000).toISOString(),
    });
  } catch (err) {
    if (err.name === "NotAuthorizedException") {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    return res.status(400).json({ message: err.message });
  }
});

// GET /v1/auth/me — protected endpoint, returns user identity from token
router.get("/me", verifyToken, (req, res) => {
  return res.status(200).json({
    userId: req.user.sub,
    email: req.user.email,
    role: req.user["cognito:groups"]?.[0] ?? "user",
  });
});

module.exports = router;
