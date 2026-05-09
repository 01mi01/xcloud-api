const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminAddUserToGroupCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const crypto = require("crypto");

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

// Compute Cognito secret hash required when app client has a secret
const computeSecretHash = (username) => {
  return crypto
    .createHmac("SHA256", process.env.COGNITO_CLIENT_SECRET)
    .update(username + process.env.COGNITO_CLIENT_ID)
    .digest("base64");
};

// Register a new user in Cognito User Pool
const registerUser = async (handle, email, password) => {
  const command = new SignUpCommand({
    ClientId: process.env.COGNITO_CLIENT_ID,
    SecretHash: computeSecretHash(email),
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "preferred_username", Value: handle },
    ],
  });
  const result = await client.send(command);
  return result.UserSub; // returns the userId (UUID) from Cognito
};

// Assign a role (group) to a user in Cognito
const assignUserToGroup = async (email, group) => {
  const command = new AdminAddUserToGroupCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    Username: email,
    GroupName: group,
  });
  await client.send(command);
};

// Authenticate user and return JWT tokens from Cognito
const loginUser = async (email, password) => {
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
      SECRET_HASH: computeSecretHash(email),
    },
  });
  const result = await client.send(command);
  return result.AuthenticationResult;
};

module.exports = { registerUser, loginUser, assignUserToGroup };
