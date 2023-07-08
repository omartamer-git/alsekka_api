const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('User', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isAlpha: true
      }
    },
    lastName: {
      type: DataTypes.STRING(40),
      allowNull: false,
      validate: {
        isAlpha: true
      }
    },
    phone: {
      type: DataTypes.STRING(16),
      allowNull: false,
      validate: {
        isNumeric: true
      }
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.CHAR(64),
      allowNull: false
    },
    gender: {
      type: DataTypes.ENUM('MALE', 'FEMALE'),
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      defaultValue: 0.00
    },
    rating: {
      type: DataTypes.DECIMAL(4,3),
      allowNull: false,
      defaultValue: 5.000
    },
    numRatings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    profilePicture: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "https:\/\/i.pinimg.com\/564x\/1f\/0b\/ed\/1f0bedce4d40a21bd6106bd66915c2b9.jpg"
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    }
  }, {
    sequelize,
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ['password', 'createdAt', 'updatedAt'] },
    },
    scopes: {
      auth: {
        attributes: { exclude: [] }
      }
    },
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "phone",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "phone" },
        ]
      },
      {
        name: "email",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "email" },
        ]
      },
    ]
  });
};
