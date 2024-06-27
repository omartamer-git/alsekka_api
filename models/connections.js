module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Connection', {
    user1_Id: {
      type: DataTypes.INTEGER
    },
    user2_Id: {
      type: DataTypes.INTEGER
    },
    last_ride_Id: {
      type: DataTypes.INTEGER,
    }
  },{
      uniqueKeys: {
        connections_unique: {
          fields: ['user1_Id', 'user2_Id']
        }
      }
  });
}