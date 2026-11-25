const path = require("path");

const envFile = path.resolve(__dirname, "..", "..", ".env");
if (typeof process.loadEnvFile === "function") {
    try {
        process.loadEnvFile(envFile);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

const rawPort = process.env.PORT || "3000";
const PORT = Number(rawPort);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
}

module.exports = {
    MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
    MONGODB_SETUP_URI: process.env.MONGODB_SETUP_URI || process.env.MONGO_SETUP_URL,
    MONGODB_DB: process.env.MONGODB_DB || process.env.DB_NAME || "crud_day30",
    PORT
};
