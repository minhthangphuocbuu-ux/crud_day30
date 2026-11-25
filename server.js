const http = require("http");
const handleRequest = require("./src/router/product");
const dataSource = require("./src/data-sources/mongo-data-source");
const { PORT } = require("./src/data-sources/config");

async function startServer() {
    await dataSource.connect();

    const server = http.createServer((req, res) => {
        handleRequest(req, res);
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(PORT, () => {
            server.removeListener("error", reject);
            console.log("Server running at http://localhost:" + PORT);
            resolve();
        });
    });

    const shutdown = () => {
        server.close(async () => {
            await dataSource.close();
        });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    return server;
}

if (require.main === module) {
    startServer().catch(async error => {
        console.error("Server failed to start:", error.message);
        await dataSource.close().catch(() => {});
        process.exitCode = 1;
    });
}

module.exports = startServer;