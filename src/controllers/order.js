const orderRepository = require("../repository/order");
const AppError = require("../utils/AppError");
const sendJson = require("../utils/sendJson");

function sendOrderError(res, error) {
    if (error instanceof AppError) {
        return sendJson(res, error.statusCode, { message: error.message });
    }
    if (error.code === 11000) {
        return sendJson(res, 409, { message: "Order code already exists" });
    }
    throw error;
}

async function create(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return sendJson(res, 400, { message: "Body must be a JSON object" });
    }
    if (Object.keys(body).some(key => !["code", "customerId", "items"].includes(key))) {
        return sendJson(res, 400, { message: "Only code, customerId, and items are accepted" });
    }
    if (typeof body.code !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(body.code.trim())) {
        return sendJson(res, 400, { message: "code must contain 1-64 letters, numbers, underscores, or hyphens" });
    }

    const customerId = orderRepository.toObjectId(body.customerId);
    if (!customerId) return sendJson(res, 400, { message: "customerId must be a valid ObjectId" });
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return sendJson(res, 400, { message: "items must be a non-empty array" });
    }

    const items = [];
    const seenProducts = new Set();
    for (const item of body.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return sendJson(res, 400, { message: "Each item must be an object" });
        }
        if (Object.keys(item).some(key => !["productId", "quantity"].includes(key))) {
            return sendJson(res, 400, { message: "Order items accept only productId and quantity" });
        }
        if (!Number.isSafeInteger(item.productId) || item.productId < 1 || item.productId > 2147483647) {
            return sendJson(res, 400, { message: "productId must be a positive integer" });
        }
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) {
            return sendJson(res, 400, { message: "quantity must be a positive integer" });
        }
        if (seenProducts.has(item.productId)) {
            return sendJson(res, 400, { message: "Each product may appear only once per order" });
        }
        seenProducts.add(item.productId);
        items.push({ productId: item.productId, quantity: item.quantity });
    }

    try {
        const order = await orderRepository.create({
            code: body.code.trim(),
            customerId,
            items
        });
        return sendJson(res, 201, order);
    } catch (error) {
        return sendOrderError(res, error);
    }
}

async function getByCode(req, res) {
    const code = req.params.code;
    if (!code || code.length > 64) return sendJson(res, 400, { message: "Invalid order code" });

    const order = await orderRepository.findByCode(code);
    if (!order) return sendJson(res, 404, { message: "Order not found" });
    return sendJson(res, 200, order);
}

async function changeStatus(req, res) {
    const code = req.params.code;
    if (!code || code.length > 64) return sendJson(res, 400, { message: "Invalid order code" });
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return sendJson(res, 400, { message: "Body must be a JSON object" });
    }
    if (Object.keys(req.body).length !== 1 || !["paid", "cancelled"].includes(req.body.status)) {
        return sendJson(res, 400, { message: "status must be paid or cancelled" });
    }

    try {
        const order = await orderRepository.changeStatus(code, req.body.status);
        if (!order) return sendJson(res, 404, { message: "Order not found" });
        return sendJson(res, 200, order);
    } catch (error) {
        return sendOrderError(res, error);
    }
}

module.exports = { create, getByCode, changeStatus };
