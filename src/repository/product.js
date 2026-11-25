const dataSource = require("../datasource/dataSource");

const COLLECTION_NAME = "products";
const PUBLIC_PROJECTION = { _id: 0, cost: 0 };
const ACTIVE_PRODUCT = { deleted: { $ne: true } };

async function findPage({ filter, page, limit, sort, order }) {
    const products = await dataSource.collection(COLLECTION_NAME);
    const query = { ...ACTIVE_PRODUCT, ...filter };
    const [items, total] = await Promise.all([
        products.find(query, { projection: PUBLIC_PROJECTION })
            .sort({ [sort]: order })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray(),
        products.countDocuments(query)
    ]);

    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        products: items
    };
}

async function findById(id) {
    const products = await dataSource.collection(COLLECTION_NAME);
    return products.findOne(
        { id, ...ACTIVE_PRODUCT },
        { projection: PUBLIC_PROJECTION }
    );
}

async function create(product) {
    const products = await dataSource.collection(COLLECTION_NAME);
    const lastProduct = await products.find({}, { projection: { _id: 0, id: 1 } })
        .sort({ id: -1 })
        .limit(1)
        .next();
    const newProduct = {
        id: lastProduct ? lastProduct.id + 1 : 1,
        ...product,
        deleted: false
    };

    await products.insertOne(newProduct);
    const { cost, ...publicProduct } = newProduct;
    return publicProduct;
}

async function patch(id, fields) {
    const products = await dataSource.collection(COLLECTION_NAME);
    const result = await products.updateOne(
        { id, ...ACTIVE_PRODUCT },
        { $set: fields }
    );
    if (result.matchedCount === 0) return null;
    return findById(id);
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

module.exports = { findPage, findById, create, patch, changeStock, softDelete };
