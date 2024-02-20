const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('Invoice', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        totalAmount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        driverFeeTotal: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        passengerFeeTotal: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        pickupAddition: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        balanceDue: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        discountAmount: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        grandTotal: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        dueDate: {
            type: DataTypes.DATE
        },
        paymentStatus: {
            type: DataTypes.ENUM('UNPAID', 'REVERSED', 'PAID'),
            allowNull: false,
            defaultValue: 'UNPAID'
        },
        paymentDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        paymentMethod: {
            type: DataTypes.ENUM('CASH', 'CARD')
        },
        reference: {
            type: DataTypes.TEXT,
            allowNull: true
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
        ]
    });
};
