const { readProducts, writeProducts } = require("../repository/product");
const getNextId = require("../utils/getNextId");
const sendJson = require("../utils/sendJson");

function getAll(req, res) {
    const products = readProducts();
    const limit = req.query.get("limit");

    if (limit !== null) {
        const numberLimit = Number(limit);

        if (Number.isNaN(numberLimit) || numberLimit < 0) {
            return sendJson(res, 400, { message: "Invalid limit" });
        }

        return sendJson(res, 200, products.slice(0, numberLimit));
    }

    return sendJson(res, 200, products);
}

function getById(req, res) {
    const id = Number(req.params.id);
    const products = readProducts();
    const product = products.find(product => product.id === id);

    if (!product) {
        return sendJson(res, 404, { message: "Product not found" });
    }

    return sendJson(res, 200, product);
}

function create(req, res) {
    const products = readProducts();

    const newProduct = {
        id: getNextId(products),
        name: req.body.name,
        price: req.body.price,
        category: req.body.category
    };

    products.push(newProduct);

    writeProducts(products);
    return sendJson(res, 201, newProduct);
}

function update(req, res) {
    const id = Number(req.params.id);
    const products = readProducts();
    const productIndex = products.findIndex(product => product.id === id);

    if (productIndex === -1) {
        return sendJson(res, 404, { message: "Product not found" });
    }

    products[productIndex] = {
        id: id,
        name: req.body.name,
        price: req.body.price,
        category: req.body.category
    };

    writeProducts(products);
    return sendJson(res, 200, products[productIndex]);
}

function patch(req, res) {
    const id = Number(req.params.id);
    const products = readProducts();
    const productIndex = products.findIndex(product => product.id === id);

    if (productIndex === -1) {
        return sendJson(res, 404, { message: "Product not found" });
    }

    const body = { ...req.body };
    delete body.id;

    products[productIndex] = {
        ...products[productIndex],
        ...body,
        id: id
    };

    writeProducts(products);
    return sendJson(res, 200, products[productIndex]);
}

function remove(req, res) {
    const id = Number(req.params.id);
    const products = readProducts();
    const productIndex = products.findIndex(product => product.id === id);

    if (productIndex === -1) {
        return sendJson(res, 404, { message: "Product not found" });
    }

    const deletedProduct = products.splice(productIndex, 1)[0];
    writeProducts(products);
    return sendJson(res, 200, deletedProduct);
}

module.exports = { getAll, getById, create, update, patch, remove };
