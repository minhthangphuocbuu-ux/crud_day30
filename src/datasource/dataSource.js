const { MongoClient } = require("mongodb");
const { MONGO_URL, DB_NAME } = require("./config");

let client;
let database;
let connection;

async function connect() {
    if (database) return database;
    if (!MONGO_URL) {
        throw new Error("MONGO_URL is not configured. Add it to the project .env file.");
    }

    if (!connection) {
        client = new MongoClient(MONGO_URL);
        connection = client.connect()
            .then(async () => {
                const db = client.db(DB_NAME);
                database = db;
                console.log(`Connected to MongoDB database: ${DB_NAME}`);
                return database;
            })
            .catch(async error => {
                const failedClient = client;
                client = undefined;
                database = undefined;
                connection = undefined;
                if (failedClient) await failedClient.close().catch(() => {});
                throw error;
            });
    }

    return connection;
}

async function collection(name) {
    const db = await connect();
    return db.collection(name);
}

async function withTransaction(callback) {
    await connect();
    const session = client.startSession();
    try {
        return await session.withTransaction(() => callback(database, session));
    } finally {
        await session.endSession();
    }
}

module.exports = { connect, collection, withTransaction };
