const dbConfig = require("../config/db.config.js");

const Sequelize = require("sequelize");
const initModels = require("./init-models.js");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    operatorsAliases: false,

    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle
    }
});

const models = initModels(sequelize);

sequelize.sync({ alter: true }).then(() => {
     console.log("Database is synchronized");
 });

module.exports = models;