const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('car', {
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
      allowNull: false,
    },
    issuedate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    expirydate: {
      type: DataTypes.DATEONLY,
      allowNull: true
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
    status: {
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
    ],
    defaultScope: {
      attributes: {
        exclude: ['license_front', 'license_back']
      }
    },
    scopes: {
      staff: {
        attributes: {
          exclude: []
        }
      }
    }
  });
};
