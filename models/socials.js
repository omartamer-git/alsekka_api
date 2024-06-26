const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('Social', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        musicLink: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        facebookLink: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        instagramLink: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        timestamps: true,
        indexes: [
            {
                name: 'PRIMARY',
                unique: true,
                using: 'BTREE',
                fields: [
                    { name: 'id' },
                ],
            },
        ],
    });
};