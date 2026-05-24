require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});