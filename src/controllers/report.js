const reportRepository = require("../repository/report");
const sendJson = require("../utils/sendJson");

async function revenueByCustomer(req, res) {
    const report = await reportRepository.revenueByCustomer();
    return sendJson(res, 200, report);
}

module.exports = { revenueByCustomer };
