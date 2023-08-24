const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('withdrawal', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
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
