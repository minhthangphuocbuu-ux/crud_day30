const sendJson = require("../utils/sendJson");

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function parseBody(req, res, next) {
    try {
        req.body = await readBody(req);
        next();
    } catch (error) {
        sendJson(res, 400, { message: "Invalid JSON" });
    }
}

module.exports = parseBody;
