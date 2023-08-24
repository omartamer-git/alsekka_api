const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('CommunityMember', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    joinAnswer: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    },
    joinStatus: {
      type: DataTypes.ENUM('PENDING', 'REJECTED', 'APPROVED'),
      allowNull: false,
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
