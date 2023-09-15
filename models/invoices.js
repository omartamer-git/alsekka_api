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
        discountAmount: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        grandTotal: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        dueDate: {
            type: DataTypes.DATETIME
        },
        paymentStatus: {
            type: DataTypes.ENUM('UNPAID', 'PAID'),
            allowNull: false
        },
        paymentDate: {
            type: DataTypes.DATETIME
        },
        paymentMethod: {
            type: DataTypes.ENUM('CASH', 'CARD')
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
