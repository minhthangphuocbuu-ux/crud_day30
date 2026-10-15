const auth = require("../middlewares/auth");
const parseBody = require("../middlewares/parseBody");
const controller = require("../controllers/product");
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
    const url = new URL(req.url, "http://localhost");

    const method = req.method;
    const pathname = url.pathname;

    console.log(method, pathname);

    if (method === "GET" && pathname === "/products") {
        if (!await apply(req, res, [auth])) return;

        req.query = url.searchParams;
        return controller.getAll(req, res);
    }

    if (method === "GET" && pathname.startsWith("/products/")) {
        if (!await apply(req, res, [auth])) return;

        req.params = { id: pathname.split("/")[2] };
        return controller.getById(req, res);
    }

    if (method === "POST" && pathname === "/products") {
        if (!await apply(req, res, [auth, parseBody])) return;

        return controller.create(req, res);
    }

    if (method === "PUT" && pathname.startsWith("/products/")) {
        if (!await apply(req, res, [auth, parseBody])) return;

        req.params = { id: pathname.split("/")[2] };
        return controller.update(req, res);
    }

    if (method === "PATCH" && pathname.startsWith("/products/")) {
        if (!await apply(req, res, [auth, parseBody])) return;

        req.params = { id: pathname.split("/")[2] };
        return controller.patch(req, res);
    }

    if (method === "DELETE" && pathname.startsWith("/products/")) {
        if (!await apply(req, res, [auth])) return;

        req.params = { id: pathname.split("/")[2] };
        return controller.remove(req, res);
    }

    return sendJson(res, 404, { message: "Not found" });
}

module.exports = handleRequest;
