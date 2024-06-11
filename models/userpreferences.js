module.exports = function (sequelize, DataTypes) {
  return sequelize.define('UserPreferences', {
    id: {
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    chattiness: {
      type: DataTypes.ENUM("I prefer talking during the ride", "I prefer a quiet ride", "I am flexible about talking"),
      allowNull: false  
    },
    rest_stop: {
      type: DataTypes.ENUM("I prefer frequent stops during the ride", "I prefer rest stops only when necessary", "I don't mind as long as we get there!"),
      allowNull: false  
    },
    music: {
      type: DataTypes.ENUM("I prefer music during the ride", "I prefer no music during the ride", "I am flexible about music"),
      allowNull: false        
    },
    smoking: {
      type: DataTypes.ENUM("I prefer a smoke-free ride", "I prefer smoking during the ride", "Cigarette breaks outside the car are ok"),
      allowNull: false  
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