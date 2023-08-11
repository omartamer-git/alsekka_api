let DataTypes = require("sequelize").DataTypes;
let _announcements = require("./announcements");
let _bankaccounts = require("./bankaccounts");
let _mobilewallets = require("./mobilewallets");
let _cards = require("./cards");
let _cars = require("./cars");
let _chatmessages = require("./chatmessages");
let _communities = require("./communities");
let _communitymembers = require("./communitymembers");
let _licenses = require("./licenses");
let _passengers = require("./passengers");
let _rides = require("./rides");
let _users = require("./users");
let _referrals = require("./referrals");
let _staff = require("./staff");

function initModels(sequelize) {
  let Announcement = _announcements(sequelize, DataTypes);
  let BankAccount = _bankaccounts(sequelize, DataTypes);
  let Card = _cards(sequelize, DataTypes);
  let Car = _cars(sequelize, DataTypes);
  let ChatMessage = _chatmessages(sequelize, DataTypes);
  let Community = _communities(sequelize, DataTypes);
  let CommunityMember = _communitymembers(sequelize, DataTypes);
  let License = _licenses(sequelize, DataTypes);
  let Passenger = _passengers(sequelize, DataTypes);
  let Ride = _rides(sequelize, DataTypes);
  let User = _users(sequelize, DataTypes);
  let MobileWallet = _mobilewallets(sequelize, DataTypes);
  let Referral = _referrals(sequelize, DataTypes);
  let Staff = _staff(sequelize, DataTypes);


  User.belongsToMany(Community, { as: 'Communities', through: CommunityMember });
  Community.belongsToMany(User, { as: 'Member', through: CommunityMember });

  CommunityMember.belongsTo(User);
  User.hasMany(CommunityMember);


  Ride.belongsTo(Car);
  Car.hasMany(Ride);

  Community.belongsTo(User, {as: 'Owner', foreignKey: "OwnerId"});
  User.hasMany(Community, { as: 'Administrated', foreignKey: "OwnerId" });

  Ride.belongsToMany(User, { as: 'Passengers', through: Passenger });
  User.belongsToMany(Ride, { as: 'Rides', through: Passenger });

  Passenger.belongsTo(Ride);
  Ride.hasMany(Passenger);

  Card.hasMany(Passenger);
  Passenger.belongsTo(Card);

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

  MobileWallet.belongsTo(User);
  User.hasMany(MobileWallet);

  Ride.belongsTo(User, { as: 'Driver', foreignKey: 'DriverId' });
  User.hasMany(Ride, { as: 'Drives', foreignKey: 'DriverId' });

  Ride.belongsTo(Community);
  Community.hasMany(Ride);

  User.hasMany(Referral, { foreignKey: 'ReferrerID', as: 'Referrals' });
  Referral.belongsTo(User, { foreignKey: 'ReferrerID', as: 'Referrer' });
  Referral.belongsTo(User, { foreignKey: 'RefereeID', as: 'Referee' });
  User.belongsTo(Referral, { foreignKey: 'RefereeID', as: 'Referee' })

  return {
    Announcement,
    BankAccount,
    MobileWallet,
    Card,
    Car,
    ChatMessage,
    Community,
    Community,
    License,
    Passenger,
    Ride,
    User,
    CommunityMember,
    Referral,
    Staff,
    sequelize,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
