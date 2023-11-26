const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('DriverInvoice', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        transactionType: {
            type: DataTypes.ENUM('LATE_CANCELLATION'),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM("CARD_CHARGED", "BALANCE_DEDUCTED"),
            allowNull: false
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
                    { name: "id" }
                ]
            }
        ]
    })
}