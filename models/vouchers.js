const Sequelize = require('sequelize');

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('Voucher', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    code: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM('PERCENTAGE', 'FIXED'),
        allowNull: false,
    },
    value: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    maxValue: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    maxUses: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    currentUses: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    expiration: {
        type: DataTypes.DATE,
        allowNull: false
    },
    singleUse: {
        type: DataTypes.BOOLEAN,
        defaultValue: 1,
        allowNull: false
    }
  }, {
    sequelize,
    timestamps: true,
    indexes: [
      {
        name: 'PRIMARY',
        unique: true,
        using: 'BTREE',
        fields: [
          { name: 'id' },
        ],
      },
    ],
  });
};
