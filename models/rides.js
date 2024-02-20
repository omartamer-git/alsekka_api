const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('Ride', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fromLocation: {
      type: Sequelize.GEOMETRY('POINT', 4326),
      allowNull: false
    },
    toLocation: {
      type: Sequelize.GEOMETRY('POINT', 4326),
      allowNull: false
    },
    mainTextFrom: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    mainTextTo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    pricePerSeat: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    pickupEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    pickupPrice: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    datetime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'SCHEDULED'
    },
    gender: {
      type: DataTypes.ENUM('MALE', 'FEMALE', 'ANY'),
      allowNull: false,
      defaultValue: 'ANY'
    },
    seatsAvailable: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    },
    driverFee: {
      type: DataTypes.DECIMAL(2, 2),
      allowNull: false,
      defaultValue: 0
    },
    driverCompletedRatings: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    polyline: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    topicArn: {
      type: DataTypes.TEXT,
      allowNull: false
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
      {
        name: "datetime_index",
        using: "BTREE",
        fields: [
          { name: "datetime" }
        ]
      },
      {
        name: "status_index",
        using: "BTREE",
        fields: [
          { name: "status" }
        ]
      }
    ]
  });
};
