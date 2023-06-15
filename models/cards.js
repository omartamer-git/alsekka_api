const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Card', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    cardNumber: {
      type: DataTypes.STRING(19),
      allowNull: false
    },
    cardholderName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    cardExpiry: {
      type: DataTypes.CHAR(5),
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
          { name: "id" },
        ]
      },
    ]
  });
};
