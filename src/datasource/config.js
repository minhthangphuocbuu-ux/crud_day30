const path = require("path");

const envFile = path.resolve(__dirname, "..", "..", "..", ".env");
if (typeof process.loadEnvFile === "function") {
    try {
        process.loadEnvFile(envFile);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

module.exports = {
    MONGO_URL: process.env.MONGO_URL || process.env.MONGODB_URI,
    MONGO_SETUP_URL: process.env.MONGO_SETUP_URL,
    DB_NAME: process.env.DB_NAME || process.env.MONGODB_DB || "crud_day30"
};
