const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "data", "products.txt");

function readProducts() {
    const data = fs.readFileSync(FILE_PATH, "utf8");
    if (!data.trim()) return [];
    return JSON.parse(data);
}

function writeProducts(products) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(products, null, 2));
}

module.exports = { readProducts, writeProducts };
