const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('License', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    front: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    back: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    issuedate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    expirydate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    licensenumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isNumeric: true
      }
    },
    nationalid: {
      type: DataTypes.CHAR(15),
      allowNull: true,
      validate: {
        isNumeric: true
      }
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'REJECTED', 'APPROVED'),
      allowNull: false,
      defaultValue: "PENDING"
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
