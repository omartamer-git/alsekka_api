const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('MailingList', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(320),
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING(14),
            allowNull: false
        },
        gender: {
            type: DataTypes.ENUM('Male', 'Female'),
            allowNull: false,
            defaultValue: "Male"
        },
        car: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        sequelize,
        timestamps: true,
        indexes: [
            {
                name: "PRIMARY",
                unique: true,
                using: "BTREE",
                fields: [
                    { name: "id" },
                ]
            },
            {
                name: "phone_unique",
                unique: true,
                fields: [
                    { name: "phone" }
                ]
            }
        ]
    });
};
