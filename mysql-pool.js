const config = require("./config");
const mysql = require('mysql2/promise');

const pool = mysql.createPool(config.db);

module.exports = pool;