const auth = require("../middlewares/auth");
const parseBody = require("../middlewares/parseBody");
const controller = require("../controllers/product");
const customerController = require("../controllers/customer");
const orderController = require("../controllers/order");
const reportController = require("../controllers/report");
const sendJson = require("../utils/sendJson");

async function apply(req, res, middlewares) {
    for (const middleware of middlewares) {
        let nextCalled = false;

        await middleware(req, res, () => {
            nextCalled = true;
        });

        if (!nextCalled) {
            return false;
        }
    }

    return true;
}

async function handleRequest(req, res) {
    try {
        const url = new URL(req.url, "http://localhost");

        const method = req.method;
        const pathname = url.pathname;

        console.log(method, pathname);

        if (method === "GET" && pathname === "/reports/revenue/by-customer") {
            if (!await apply(req, res, [auth])) return;
            return await reportController.revenueByCustomer(req, res);
        }

        if (method === "GET" && pathname === "/products") {
            if (!await apply(req, res, [auth])) return;

            req.query = url.searchParams;
            return await controller.getAll(req, res);
        }

        const productRoute = /^\/products\/([^/]+)$/.exec(pathname);
        const stockRoute = /^\/products\/([^/]+)\/stock$/.exec(pathname);

        if (method === "GET" && productRoute) {
            if (!await apply(req, res, [auth])) return;

            req.params = { id: productRoute[1] };
            return await controller.getById(req, res);
        }

        if (method === "POST" && pathname === "/products") {
            if (!await apply(req, res, [auth, parseBody])) return;

            return await controller.create(req, res);
        }

        if (method === "POST" && pathname === "/customers") {
            if (!await apply(req, res, [auth, parseBody])) return;
            return await customerController.create(req, res);
        }

        if (method === "POST" && pathname === "/orders") {
            if (!await apply(req, res, [auth, parseBody])) return;
            return await orderController.create(req, res);
        }

        const orderRoute = /^\/orders\/([^/]+)$/.exec(pathname);
        const orderStatusRoute = /^\/orders\/([^/]+)\/status$/.exec(pathname);

        if (method === "GET" && orderRoute) {
            if (!await apply(req, res, [auth])) return;
            req.params = { code: orderRoute[1] };
            return await orderController.getByCode(req, res);
        }

        if (method === "PATCH" && orderStatusRoute) {
            if (!await apply(req, res, [auth, parseBody])) return;
            req.params = { code: orderStatusRoute[1] };
            return await orderController.changeStatus(req, res);
        }

        if (method === "PATCH" && stockRoute) {
            if (!await apply(req, res, [auth, parseBody])) return;

            req.params = { id: stockRoute[1] };
            return await controller.changeStock(req, res);
        }

        if (method === "PATCH" && productRoute) {
            if (!await apply(req, res, [auth, parseBody])) return;

            req.params = { id: productRoute[1] };
            return await controller.patch(req, res);
        }

        if (method === "DELETE" && productRoute) {
            if (!await apply(req, res, [auth])) return;

            req.params = { id: productRoute[1] };
            return await controller.remove(req, res);
        }

        return sendJson(res, 404, { message: "Not found" });
    } catch (error) {
        console.error("Request failed:", error.message);
        if (!res.headersSent) {
            return sendJson(res, 500, { message: "Internal server error" });
        }
        res.end();
    }
}

module.exports = handleRequest;
