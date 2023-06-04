var DataTypes = require("sequelize").DataTypes;
var _announcements = require("./announcements");
var _bankaccounts = require("./bankaccounts");
var _cards = require("./cards");
var _cars = require("./cars");
var _chatmessages = require("./chatmessages");
var _communities = require("./communities");
var _communitymembers = require("./communitymembers");
var _licenses = require("./licenses");
var _passengers = require("./passengers");
var _ridecommunities = require("./ridecommunities");
var _rides = require("./rides");
var _users = require("./users");

function initModels(sequelize) {
  var Announcement = _announcements(sequelize, DataTypes);
  var BankAccount = _bankaccounts(sequelize, DataTypes);
  var Card = _cards(sequelize, DataTypes);
  var Car = _cars(sequelize, DataTypes);
  var ChatMessage = _chatmessages(sequelize, DataTypes);
  var Community = _communities(sequelize, DataTypes);
  var CommunityMember = _communitymembers(sequelize, DataTypes);
  var License = _licenses(sequelize, DataTypes);
  var Passenger = _passengers(sequelize, DataTypes);
  var RideCommunity = _ridecommunities(sequelize, DataTypes);
  var Ride = _rides(sequelize, DataTypes);
  var User = _users(sequelize, DataTypes);


  User.belongsToMany(Community, { as: 'Communities', through: CommunityMember });
  Community.belongsToMany(User, { as: 'Member', through: CommunityMember });

  Ride.belongsToMany(Community, { through: RideCommunity });
  Community.belongsToMany(Ride, { through: RideCommunity });

  Ride.belongsTo(Car);
  Car.hasMany(Ride);

  Community.belongsTo(User);
  User.hasMany(Community);

  Ride.belongsToMany(User, { as: 'Passengers', through: Passenger });
  User.belongsToMany(Ride, { as: 'Rides', through: Passenger });

  Passenger.belongsTo(Ride);
  Ride.hasMany(Passenger);

  Passenger.belongsTo(User);
  User.hasMany(Passenger);


  Card.belongsTo(User);
  User.hasMany(Card);

  Car.belongsTo(User);
  User.hasMany(Car);

  ChatMessage.belongsTo(User, { as: "Sender", foreignKey: "SenderId" });
  User.hasMany(ChatMessage, { as: "Sent", foreignKey: "SenderId" });
  ChatMessage.belongsTo(User, { as: "Receiver", foreignKey: "ReceiverId" });
  User.hasMany(ChatMessage, { as: "Received", foreignKey: "ReceiverId" });

  License.belongsTo(User);
  User.hasMany(License);

  BankAccount.belongsTo(User);
  User.hasMany(BankAccount);

  Ride.belongsTo(User, { as: 'Driver', foreignKey: 'DriverId' });
  User.hasMany(Ride, { as: 'Drives', foreignKey: 'DriverId' });

  return {
    Announcement,
    BankAccount,
    Card,
    Car,
    ChatMessage,
    Community,
    Community,
    License,
    Passenger,
    RideCommunity,
    Ride,
    User,
    sequelize
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
