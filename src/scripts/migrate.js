const fs = require("fs");
const path = require("path");
const dataSource = require("../data-sources/mongo-data-source");

const projectRoot = path.resolve(__dirname, "..", "..");
const sourceCandidates = [
    path.join(projectRoot, "database.json"),
    path.join(projectRoot, "src", "data-sources", "products.txt")
];

function readProducts() {
    const sourcePath = sourceCandidates.find(candidate => fs.existsSync(candidate));
    if (!sourcePath) {
        throw new Error("No legacy data file found (expected database.json or src/data-sources/products.txt)");
    }

    const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const sourceProducts = Array.isArray(parsed) ? parsed : parsed.products;
    if (!Array.isArray(sourceProducts)) throw new Error("Legacy data must be an array of products");

    const products = sourceProducts.map(product => {
        if (!Number.isInteger(product.id) || product.id < 1) {
            throw new Error("Every legacy product needs a positive integer id");
        }
        if (typeof product.name !== "string" || typeof product.category !== "string") {
            throw new Error(`Legacy product ${product.id} has an invalid name or category`);
        }
        if (!Number.isInteger(product.price) || product.price < 0) {
            throw new Error(`Legacy product ${product.id} has an invalid price`);
        }

        return {
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            stock: Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : 0,
            cost: Number.isInteger(product.cost) && product.cost >= 0 ? product.cost : 0,
            deleted: product.deleted === true
        };
    });

    return { sourcePath, products };
}

async function migrate() {
    const { sourcePath, products: legacyProducts } = readProducts();
    const db = await dataSource.getDb();
    const products = db.collection("products");

    const result = legacyProducts.length === 0
        ? { upsertedCount: 0 }
        : await products.bulkWrite(legacyProducts.map(product => ({
            updateOne: {
                filter: { id: product.id },
                update: { $setOnInsert: product },
                upsert: true
            }
        })), { ordered: true });

    const highestProduct = await products.find({}, { projection: { _id: 0, id: 1 } })
        .sort({ id: -1 })
        .limit(1)
        .next();
    await db.collection("counters").updateOne(
        { _id: "product" },
        { $max: { seq: highestProduct ? highestProduct.id : 0 } },
        { upsert: true }
    );

    console.log(`Migration source: ${path.relative(projectRoot, sourcePath)}`);
    console.log(`Products inserted: ${result.upsertedCount}`);
}

migrate()
    .catch(error => {
        console.error("Migration failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => dataSource.close());
