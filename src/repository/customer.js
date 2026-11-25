const dataSource = require("../datasource/dataSource");

async function create(customer) {
    const customers = await dataSource.collection("customers");
    const result = await customers.insertOne(customer);
    return { _id: result.insertedId, ...customer };
}

module.exports = { create };
