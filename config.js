const config = {
    db: {
        host: "127.0.0.1",
        user: "root",
        password: "",
        database: "alsekka",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    },

    app: {
        port: 3000
    }
};

module.exports = config;