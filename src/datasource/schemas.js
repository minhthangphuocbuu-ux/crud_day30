const integer = { bsonType: ["int", "long"] };
const numeric = { bsonType: "number" };

const schemas = {
    products: {
        bsonType: "object",
        required: ["id", "name", "price", "category", "stock", "cost", "deleted"],
        additionalProperties: false,
        properties: {
            _id: { bsonType: "objectId" },
            id: { bsonType: "int", minimum: 1 },
            name: { bsonType: "string", minLength: 1 },
            price: { ...integer, minimum: 0 },
            category: { bsonType: "string", minLength: 1 },
            stock: { ...integer, minimum: 0 },
            cost: { ...integer, minimum: 0 },
            deleted: { bsonType: "bool" }
        }
    },
    customers: {
        bsonType: "object",
        required: ["name", "email"],
        additionalProperties: false,
        properties: {
            _id: { bsonType: "objectId" },
            name: { bsonType: "string", minLength: 1 },
            email: { bsonType: "string", minLength: 3, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" }
        }
    },
    orders: {
        bsonType: "object",
        required: ["code", "customerId", "items", "total", "status", "createdAt"],
        additionalProperties: false,
        properties: {
            _id: { bsonType: "objectId" },
            code: { bsonType: "string", minLength: 1, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" },
            customerId: { bsonType: "objectId" },
            items: {
                bsonType: "array",
                minItems: 1,
                items: {
                    bsonType: "object",
                    required: ["productId", "name", "price", "quantity"],
                    additionalProperties: false,
                    properties: {
                        productId: { bsonType: "int", minimum: 1 },
                        name: { bsonType: "string", minLength: 1 },
                        price: { ...integer, minimum: 0 },
                        quantity: { bsonType: "int", minimum: 1 }
                    }
                }
            },
            total: { ...numeric, minimum: 0 },
            status: { bsonType: "string", enum: ["pending", "paid", "cancelled"] },
            createdAt: { bsonType: "date" }
        }
    }
};

module.exports = schemas;
