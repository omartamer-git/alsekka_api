module.exports = function (sequelize, DataTypes) {
  return sequelize.define('UserPreferences', {
    id: {
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    chattiness: {
      type: DataTypes.ENUM("CHATTY", "QUITE", "FLEXIBLE"),
      allowNull: true  
    },
    rest_stop: {
      type: DataTypes.ENUM("FREQUENT", "WHEN_NECESSARY", "DONT_MIND"),
      allowNull: true  
    },
    music: {
      type: DataTypes.ENUM("LIKE_MUSIC", "NO_MUSIC", "FLEXIBLE"),
      allowNull: true        
    },
    smoking: {
      type: DataTypes.ENUM("SMOKE_FREE", "SMOKING", "CIGARETTE_BREAKS"),
      allowNull: true  
    },
    userId: {
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