const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('NationalID', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nationalId: {
        type: DataTypes.CHAR(14),
        allowNull: true
    },
    front: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    back: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    expirydate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    dob: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    governorate: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    legalFirstName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    legalLastName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'REJECTED', 'APPROVED'),
      allowNull: false,
      defaultValue: "APPROVED"
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
