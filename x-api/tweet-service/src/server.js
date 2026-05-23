require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
const app = require("./app");

const PORT = 3002;

app.listen(PORT, () => {
    console.log(`Tweet Service running on port ${PORT}`);
});
