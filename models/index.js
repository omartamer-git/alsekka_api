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
    const createSpatialIndexQueryFrom = `CREATE SPATIAL INDEX spatial_from_location_idx ON rides (fromLocation);`;
    const createSpatialIndexQueryTo = `CREATE SPATIAL INDEX spatial_to_location_idx ON rides (toLocation);`;

    sequelize
        .query(createSpatialIndexQueryFrom)
        .then(() => {
            console.log('Spatial index (FROM) created successfully.');
        })
        .catch((error) => {
            console.error('Error creating spatial index:', error);
        });

    sequelize
        .query(createSpatialIndexQueryTo)
        .then(() => {
            console.log('Spatial index (TO) created successfully.');
        })
        .catch((error) => {
            console.error('Error creating spatial index:', error);
        });

});

module.exports = models;