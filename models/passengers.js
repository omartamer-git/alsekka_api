const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('passenger', {
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
