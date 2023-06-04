module.exports = {
    HOST: "localhost",
    USER: "root",
    PASSWORD: "",
    DB: "alsekka2",
    dialect: "mysql",
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};