const { UserPreference } = require("../models/index");

async function updateUserPreferences(preferences, smoking, chattiness, music, rest_stop) {
  preferences.smoking = smoking;
  preferences.chattiness = chattiness;
  preferences.music = music;
  preferences.rest_stop = rest_stop;
  await preferences.save();
  return preferences;
}

async function createUserPreferences(userId, smoking = null, chattiness = null, music = null, rest_stop = null) {
  return await UserPreference.create({ userId, smoking, chattiness, music, rest_stop });
}

module.exports = {
  updateUserPreferences,
  createUserPreferences
};