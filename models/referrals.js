const Sequelize = require('sequelize');

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('referral', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    expiry: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: () => {
        const today = new Date();
        const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // Add 30 days to today
        return futureDate;
      },
    },
    ReferrerID: {
      type: DataTypes.INTEGER,
    },
    RefereeID: {
      type: DataTypes.INTEGER,
      unique: true,
      validate: {
        isGreaterThanReferrer(value) {
          if (value <= this.ReferrerID) {
            throw new Error('RefereeID must be greater than ReferrerID');
          }
        },
      },
    }
  }, {
    sequelize,
    timestamps: true,
    indexes: [
      {
        name: 'PRIMARY',
        unique: true,
        using: 'BTREE',
        fields: [
          { name: 'id' },
        ],
      },
    ],
  });
};
