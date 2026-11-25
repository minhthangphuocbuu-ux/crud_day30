const { ObjectId } = require("mongodb");
const dataSource = require("../datasource/dataSource");
const AppError = require("../utils/AppError");

async function create({ code, customerId, items }) {
    return dataSource.withTransaction(async (db, session) => {
        const customers = db.collection("customers");
        const products = db.collection("products");
        const orders = db.collection("orders");

        const existingOrder = await orders.findOne(
            { code },
            { session, projection: { _id: 1 } }
        );
        if (existingOrder) throw new AppError(409, "Order code already exists");

        const customerExists = await customers.findOne(
            { _id: customerId },
            { session, projection: { _id: 1 } }
        );
        if (!customerExists) throw new AppError(404, "Customer not found");

        const orderItems = [];
        for (const item of items) {
            const product = await products.findOne(
                { id: item.productId, deleted: { $ne: true } },
                { session, projection: { id: 1, name: 1, price: 1, stock: 1 } }
            );
            if (!product) throw new AppError(404, `Product ${item.productId} not found`);
            if (!Number.isSafeInteger(product.price) || !Number.isSafeInteger(product.stock)) {
                throw new AppError(409, `Product ${item.productId} has invalid price or stock data`);
            }
            if (product.stock < item.quantity) {
                throw new AppError(409, `Insufficient stock for product ${item.productId}`);
            }

            orderItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });
        }

        const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (!Number.isSafeInteger(total)) throw new AppError(400, "Order total is too large");

        const order = {
            code,
            customerId,
            items: orderItems,
            total,
            status: "pending",
            createdAt: new Date()
        };
        await orders.insertOne(order, { session });

        for (const item of orderItems) {
            const result = await products.updateOne(
                {
                    id: item.productId,
                    deleted: { $ne: true },
                    stock: { $gte: item.quantity }
                },
                { $inc: { stock: -item.quantity } },
                { session }
            );
            if (result.matchedCount === 0) {
                throw new AppError(409, `Insufficient stock for product ${item.productId}`);
            }
        }

        return order;
    });
}

async function findByCode(code) {
    const orders = await dataSource.collection("orders");
    return orders.findOne({ code });
}

async function changeStatus(code, status) {
    return dataSource.withTransaction(async (db, session) => {
        const orders = db.collection("orders");
        const products = db.collection("products");
        const order = await orders.findOne({ code }, { session });
        if (!order) return null;
        if (order.status === status) return order;
        if (order.status !== "pending") {
            throw new AppError(409, `Cannot change order from ${order.status} to ${status}`);
        }

        if (status === "cancelled") {
            for (const item of order.items) {
                const result = await products.updateOne(
                    { id: item.productId },
                    { $inc: { stock: item.quantity } },
                    { session }
                );
                if (result.matchedCount === 0) {
                    throw new AppError(409, `Product ${item.productId} no longer exists`);
                }
            }
        }

        const result = await orders.updateOne(
            { code, status: "pending" },
            { $set: { status } },
            { session }
        );
        if (result.matchedCount === 0) throw new AppError(409, "Order status changed concurrently");
        return { ...order, status };
    });
}

function toObjectId(value) {
    return typeof value === "string" && /^[a-f\d]{24}$/i.test(value)
        ? new ObjectId(value)
        : null;
}

module.exports = { create, findByCode, changeStatus, toObjectId };
