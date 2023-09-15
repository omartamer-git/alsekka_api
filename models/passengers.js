const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Passenger', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    paymentMethod: {
      type: DataTypes.ENUM('CASH', 'CARD'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('REQUESTED', 'CONFIRMED', 'REJECTED', 'ENROUTE', 'ARRIVED', 'CANCELLED', 'NOSHOW'),
      allowNull: false,
      defaultValue: 'CONFIRMED'
    },
    seats: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    passengerFee: {
      type: DataTypes.DECIMAL(2,2),
      allowNull: false,
      defaultValue: 0
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
