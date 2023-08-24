const config = {
    db: {
        host: "127.0.0.1",
        user: "root",
        password: "C0YoOQO%mwluZ3jT3x&RelGtM5H7PjCl47cwVUWs&TdF^P^l87",
        database: "alsekka2",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    },

    app: {
        port: 3000
    },

    // refer to SMSMisr documentation
    otp: {
        environment: "2",
        username: '4a04427a-33f8-4f72-afb1-b5d92d7a7ad5',
        password: '6e86259e107099033c334f8d6c80075af5b8683a5797a2f5bbc660ea4e9e0bd2',
        sender: 'b611afb996655a94c8e942a823f1421de42bf8335d24ba1f84c437b2ab11ca27',
        template: '9b04deada138c009fa6a39ee1ca37c476e1501fbfefb8b72b14a90fe8e863dbe',
        expiryMinutes: 10
    }
};

module.exports = config;
