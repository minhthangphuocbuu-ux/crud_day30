const { MongoClient } = require("mongodb");
const { MONGODB_URI, MONGODB_DB } = require("./config");

let client;
let database;
let connection;

async function connect() {
    if (database) return database;
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured in the project .env file");
    }

    if (!connection) {
        client = new MongoClient(MONGODB_URI);
        connection = client.connect()
            .then(() => {
                database = client.db(MONGODB_DB);
                console.log(`Connected to MongoDB database: ${MONGODB_DB}`);
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

async function getDb() {
    return connect();
}

async function collection(name) {
    const db = await getDb();
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

async function close() {
    if (connection) await connection.catch(() => {});
    if (client) await client.close();
    client = undefined;
    database = undefined;
    connection = undefined;
}

module.exports = { connect, getDb, collection, withTransaction, close };
