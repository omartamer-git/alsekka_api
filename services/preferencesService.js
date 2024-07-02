const { UserPreference } = require("../models/index");

async function findPreferences(UserId) {
  return await UserPreference.findOne({ where: { UserId } });
}

async function updateUserPreferences(UserId, smoking, chattiness, music, rest_stop) {
  const preferences = await findPreferences(UserId);
  if (preferences) {
    preferences.smoking = smoking;
    preferences.chattiness = chattiness;
    preferences.music = music;
    preferences.rest_stop = rest_stop;
    await preferences.save();
  } else {
    UserPreference.create({ UserId, smoking, chattiness, music, rest_stop });
  }
  return preferences;
}

async function createUserPreferences(UserId, smoking = null, chattiness = null, music = null, rest_stop = null) {
  return await UserPreference.create({ UserId, smoking, chattiness, music, rest_stop });
}

module.exports = {
  findPreferences,
  updateUserPreferences,
  createUserPreferences
};