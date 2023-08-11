const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Staff', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        password: {
            type: DataTypes.CHAR(64),
            allowNull: false
        },
        phone: {
            type: DataTypes.STRING(11),
            allowNull: false,
            validate: {
                isNumeric: true
            }
        },
        role: {
            type: DataTypes.ENUM('ADMIN', 'MARKETING', 'CS'),
            allowNull: false,
            defaultValue: 'CS'
        }
    }, {
        defaultScope: {
            attributes: { exclude: ['password'] } 
        },
        scopes: {
            auth: {
                attributes: { exclude: [] }
            }
        }
    });
};