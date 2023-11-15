const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Device', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    deviceToken: {
        type: DataTypes.STRING(256),
        allowNull: false,
    },
    platformEndpoint: {
        type: DataTypes.STRING(2048),
        allowNull: false
    },
    platform: {
        type: DataTypes.ENUM('ios', 'android'),
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
      {
        name: "DEVICETOKEN",
        unique: true,
        fields: [
            { name: "deviceToken" }
        ]
      }
    ]
  });
};
