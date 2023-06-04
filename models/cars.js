const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('Car', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    brand: {
      type: DataTypes.STRING(12),
      allowNull: false
    },
    year: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    model: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    licensePlateLetters: {
      type: DataTypes.STRING(4),
      allowNull: false
    },
    licensePlateNumbers: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    license_front: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    license_back: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    approved: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
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
      }
    ]
  });
};
