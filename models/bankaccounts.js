const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('BankAccount', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fullName: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: {
        isAlpha: true
      }
    },
    bankName: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isAlpha: true
      }
    },
    accNumber: {
      type: DataTypes.STRING(34),
      allowNull: false
    },
    swiftCode: {
      type: DataTypes.STRING(11),
      allowNull: false
    },
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
