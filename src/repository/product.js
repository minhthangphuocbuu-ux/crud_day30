const dataSource = require("../data-sources/mongo-data-source");

const COLLECTION_NAME = "products";
const PUBLIC_PROJECTION = { _id: 0, cost: 0 };
const ACTIVE_PRODUCT = { deleted: { $ne: true } };

async function findAll({ filter = {}, page = 1, limit, sort = "id", order = 1 } = {}) {
    const products = await dataSource.collection(COLLECTION_NAME);
    let cursor = products.find(
        { ...ACTIVE_PRODUCT, ...filter },
        { projection: PUBLIC_PROJECTION }
    ).sort({ [sort]: order });

    if (limit !== undefined) {
        cursor = cursor.skip((page - 1) * limit).limit(limit);
    }
    return cursor.toArray();
}

async function findById(id) {
    const products = await dataSource.collection(COLLECTION_NAME);
    return products.findOne(
        { id, ...ACTIVE_PRODUCT },
        { projection: PUBLIC_PROJECTION }
    );
}

async function nextProductId(products) {
    const counters = await dataSource.collection("counters");
    let counter = await counters.findOne({ _id: "product" }, { projection: { _id: 1 } });

    if (!counter) {
        const lastProduct = await products.find({}, { projection: { _id: 0, id: 1 } })
            .sort({ id: -1 })
            .limit(1)
            .next();
        try {
            await counters.insertOne({ _id: "product", seq: lastProduct ? lastProduct.id : 0 });
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }

    counter = await counters.findOneAndUpdate(
        { _id: "product" },
        { $inc: { seq: 1 } },
        { returnDocument: "after", includeResultMetadata: false }
    );
    if (!counter) throw new Error("Could not allocate a product id");
    return counter.seq;
}

function toPublicProduct(product) {
    const { _id, cost, ...publicProduct } = product;
    return publicProduct;
}

async function create(product) {
    const products = await dataSource.collection(COLLECTION_NAME);
    const newProduct = {
        id: await nextProductId(products),
        ...product,
        stock: product.stock ?? 0,
        cost: product.cost ?? 0,
        deleted: false
    };

    await products.insertOne(newProduct);
    return toPublicProduct(newProduct);
}

async function update(id, fields) {
    const products = await dataSource.collection(COLLECTION_NAME);
    const result = await products.updateOne(
        { id, ...ACTIVE_PRODUCT },
        { $set: fields }
    );
    if (result.matchedCount === 0) return null;
    return findById(id);
}

async function patch(id, fields) {
    return update(id, fields);
}

async function changeStock(id, change) {
    const products = await dataSource.collection(COLLECTION_NAME);
    const filter = { id, ...ACTIVE_PRODUCT };
    if (change < 0) filter.stock = { $gte: -change };

    const result = await products.updateOne(filter, { $inc: { stock: change } });
    if (result.matchedCount > 0) return findById(id);

    const existingProduct = await products.findOne(
        { id, ...ACTIVE_PRODUCT },
        { projection: { _id: 1 } }
    );
    return existingProduct ? { insufficientStock: true } : null;
}

async function softDelete(id) {
    const products = await dataSource.collection(COLLECTION_NAME);
    const result = await products.updateOne(
        { id, ...ACTIVE_PRODUCT },
        { $set: { deleted: true } }
    );
    return result.matchedCount > 0 ? { id, deleted: true } : null;
}

module.exports = { findAll, findById, create, update, patch, changeStock, softDelete };
