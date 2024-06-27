const dbConfig = require("../config/db.config.js");
const Sequelize = require("sequelize");
const initModels = require("./init-models.js");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    operatorsAliases: false,
    logging: process.env.NODE_ENV === 'production' ? false : console.log,

    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle
    }
});

const models = initModels(sequelize);

// chatgpt code for duplicate index error
// sequelize.sync({ alter: true }).then(async () => {
//     console.log("Database is synchronized");

//     // Function to check if an index exists
//     const indexExists = async (indexName, tableName) => {
//         const [results] = await sequelize.query(`
//             SHOW INDEX FROM ${tableName} WHERE Key_name = '${indexName}';
//         `);
//         return results.length > 0;
//     };

//     // Create Spatial Index (FROM) if it doesn't exist
//     const indexFromExists = await indexExists('spatial_from_location_idx', 'rides');
//     if (!indexFromExists) {
//         await sequelize.query(`CREATE SPATIAL INDEX spatial_from_location_idx ON rides (fromLocation);`)
//             .then(() => {
//                 console.log('Spatial index (FROM) created successfully.');
//             })
//             .catch((error) => {
//                 console.error('Error creating spatial index:', error);
//             });
//     } else {
//         console.log('Spatial index (FROM) already exists.');
//     }

//     // Create Spatial Index (TO) if it doesn't exist
//     const indexToExists = await indexExists('spatial_to_location_idx', 'rides');
//     if (!indexToExists) {
//         await sequelize.query(`CREATE SPATIAL INDEX spatial_to_location_idx ON rides (toLocation);`)
//             .then(() => {
//                 console.log('Spatial index (TO) created successfully.');
//             })
//             .catch((error) => {
//                 console.error('Error creating spatial index:', error);
//             });
//     } else {
//         console.log('Spatial index (TO) already exists.');
//     }
// }).catch((error) => {
//     console.error('Error synchronizing database:', error);
// });

module.exports = models;