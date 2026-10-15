const sendJson = require("../utils/sendJson");

async function auth(req, res, next) {
    const token = process.env.AUTH_TOKEN;

    if (!token) {
        return next();
    }

    const header = req.headers["authorization"];

    if (header === `Bearer ${token}`) {
        return next();
    }

    return sendJson(res, 401, { message: "Unauthorized" });
}

module.exports = auth;
