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
        type: DataTypes.Text,
        allowNull: false,
    },
    platformEndpoint: {
        type: DataTypes.Text,
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
        using: "BTREE",
        unique: true,
        fields: [
            { name: "deviceToken" }
        ]
      }
    ]
  });
};
