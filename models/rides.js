const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Ride', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fromLatitude: {
      type: DataTypes.DECIMAL(8,6),
      allowNull: false,
    },
    fromLongitude: {
      type: DataTypes.DECIMAL(9,6),
      allowNull: false,
    },
    toLatitude: {
      type: DataTypes.DECIMAL(8,6),
      allowNull: false,
    },
    toLongitude: {
      type: DataTypes.DECIMAL(9,6),
      allowNull: false,
    },
    mainTextFrom: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    mainTextTo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    pricePerSeat: {
      type: DataTypes.INTEGER,
      allowNull: false
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
      type: DataTypes.DECIMAL(2,2),
      allowNull: false,
      defaultValue: 0
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
    ]
  });
};
