module.exports = function (sequelize, DataTypes) {
  return sequelize.define('UserPreferences', {
    id: {
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    chattiness: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false
    },
    rest_stop: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false
    },
    music: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false
    },
    smoking: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'userpreferences',
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
  })
}
