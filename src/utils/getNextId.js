function getNextId(products) {
    if (products.length === 0) {
        return 1;
    }

    return Math.max(...products.map(product => product.id)) + 1;
}

module.exports = getNextId;
