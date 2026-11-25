const { MongoClient } = require("mongodb");
const { MONGODB_URI, MONGODB_SETUP_URI, MONGODB_DB } = require("./config");
const schemas = require("./schemas");

async function configureCollection(db, name, schema) {
    const collectionInfo = await db.listCollections({ name }).next();
    if (!collectionInfo) {
        await db.createCollection(name, {
            validator: { $jsonSchema: schema },
            validationLevel: "strict",
            validationAction: "error"
        });
        return;
    }

    await db.command({
        collMod: name,
        validator: { $jsonSchema: schema },
        validationLevel: name === "products" ? "moderate" : "strict",
        validationAction: "error"
    });
}

async function setupDatabase() {
    const uri = MONGODB_SETUP_URI || MONGODB_URI;
    if (!uri) throw new Error("Set MONGODB_SETUP_URI or MONGODB_URI in the project .env file");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);

        for (const [name, schema] of Object.entries(schemas)) {
            await configureCollection(db, name, schema);
        }

        await db.collection("products").createIndex(
            { id: 1 },
            { unique: true, name: "uniq_product_id" }
        );
        await db.collection("customers").createIndex(
            { email: 1 },
            { unique: true, name: "uniq_customer_email" }
        );
        await db.collection("orders").createIndex(
            { code: 1 },
            { unique: true, name: "uniq_order_code" }
        );
        await db.collection("orders").createIndex(
            { status: 1, createdAt: -1 },
            { name: "idx_orders_status_createdAt" }
        );

        const lastProduct = await db.collection("products")
            .find({}, { projection: { _id: 0, id: 1 } })
            .sort({ id: -1 })
            .limit(1)
            .next();
        await db.collection("counters").updateOne(
            { _id: "product" },
            { $max: { seq: lastProduct ? lastProduct.id : 0 } },
            { upsert: true }
        );

        console.log(`Database schemas and indexes are ready: ${MONGODB_DB}`);
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    setupDatabase().catch(error => {
        console.error("Database setup failed:", error.message);
        process.exitCode = 1;
    });
}

module.exports = setupDatabase;
