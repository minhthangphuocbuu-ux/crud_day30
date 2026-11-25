const dataSource = require("../datasource/dataSource");

async function revenueByCustomer() {
    const orders = await dataSource.collection("orders");
    return orders.aggregate([
        { $match: { status: "paid" } },
        {
            $group: {
                _id: "$customerId",
                totalRevenue: { $sum: "$total" },
                orderCount: { $sum: 1 }
            }
        },
        { $sort: { totalRevenue: -1 } },
        {
            $lookup: {
                from: "customers",
                localField: "_id",
                foreignField: "_id",
                as: "customer"
            }
        },
        { $unwind: "$customer" },
        {
            $project: {
                _id: 0,
                customerId: "$_id",
                name: "$customer.name",
                email: "$customer.email",
                totalRevenue: 1,
                orderCount: 1
            }
        }
    ]).toArray();
}

module.exports = { revenueByCustomer };
