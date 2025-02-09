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
      type: DataTypes.ENUM('AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'ENROUTE', 'ARRIVED', 'CANCELLED', 'DRIVER_CANCELLED', 'NOSHOW', 'PAYMENT_FAILED'),
      allowNull: false,
      defaultValue: 'CONFIRMED'
    },
    seats: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    pickupLocationLat: {
      type: DataTypes.DECIMAL(8, 6),
      defaultValue: null
    },
    pickupLocationLng: {
      type: DataTypes.DECIMAL(9, 6),
      defaultValue: null
    },
    passengerFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    passengerCompletedRating: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
