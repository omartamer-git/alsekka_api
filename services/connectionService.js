const { Passenger, Ride, User, Connection } = require("../models");
const { Op } = require("sequelize");

async function updateConnections(userIds, tripId) {
  const connections = [];

  // test its behavior if same userIds but different ride Id
  for (let i = 0; i < userIds.length; i++) {
    const user1 = userIds[i];
    for (let j = i + 1; j < userIds.length; j++) {
      let user2 = userIds[j];

      const [user1_Id, user2_Id] =
        user1 < user2 ? [user1, user2] : [user2, user1];

      connections.push({ user1_Id, user2_Id, last_ride_Id: tripId });
    }
  }

  try {
    await Promise.all(
      connections.map(async (connection) => {
        const upsertvalue = await Connection.upsert(connection);
        return upsertvalue;
      })
    );
    return connections.length;
  } catch (error) {
    throw new Error(error);
  }
}

async function findSecondDegreeConnections(loggedUserId, userToCheckConnection) {
  try {
    // Step 1: Find direct connections of user1
    const user1Connections = await Connection.findAll({
        where: {
            [Op.or]: [
                { user1_Id: loggedUserId },
                { user2_Id: loggedUserId }
            ]
        },
        attributes: ['user1_Id', 'user2_Id']
    });

    // Step 2: Find direct connections of user2
    const user2Connections = await Connection.findAll({
        where: {
            [Op.or]: [
                { user1_Id: userToCheckConnection },
                { user2_Id: userToCheckConnection }
            ]
        },
        attributes: ['user1_Id', 'user2_Id']
    });

    // Extract connected user IDs for user1
    const user1ConnectionIds = new Set(user1Connections.map(connection => 
        connection.user1_Id == loggedUserId ? connection.user2_Id : connection.user1_Id
    ));

    // Extract connected user IDs for user2
    const user2ConnectionIds = new Set(user2Connections.map(connection => 
        connection.user1_Id == userToCheckConnection ? connection.user2_Id : connection.user1_Id
    ));

    // Find common connections
    const commonConnections = [...user1ConnectionIds].filter(userId => user2ConnectionIds.has(userId));

    return commonConnections;
  } catch (error) {
    throw new Error(error);
  }
}

module.exports = {
  updateConnections,
  findSecondDegreeConnections,
};