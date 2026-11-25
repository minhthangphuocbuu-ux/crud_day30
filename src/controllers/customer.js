const customerRepository = require("../repository/customer");
const sendJson = require("../utils/sendJson");

async function create(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return sendJson(res, 400, { message: "Body must be a JSON object" });
    }
    if (Object.keys(body).some(key => !["name", "email"].includes(key))) {
        return sendJson(res, 400, { message: "Only name and email are allowed" });
    }
    if (typeof body.name !== "string" || !body.name.trim()) {
        return sendJson(res, 400, { message: "name must be a non-empty string" });
    }
    if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        return sendJson(res, 400, { message: "email must be a valid email address" });
    }

    try {
        const customer = await customerRepository.create({
            name: body.name.trim(),
            email: body.email.trim().toLowerCase()
        });
        return sendJson(res, 201, customer);
    } catch (error) {
        if (error.code === 11000) return sendJson(res, 409, { message: "Email already exists" });
        throw error;
    }
}

module.exports = { create };
