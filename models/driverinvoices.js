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
            type: DataTypes.ENUM('PENALTY', 'BONUS', 'CASH_COLLECTED', 'WITHDRAWAL', 'SETTLEMENT'),
            allowNull: false
        },
        reason: {
            type: DataTypes.ENUM('REFERRAL', 'COMPENSATION', 'LATE_CANCELLATION_NOSHOW'),
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
                    { name: "id" }
                ]
            }
        ]
    })
}