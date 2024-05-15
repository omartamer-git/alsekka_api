const Sequelize = require('sequelize');
const { BadRequestError } = require('../errors/Errors');

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('Referral', {
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
            throw new BadRequestError('Can not refer an account older than yours', 'لا يمكن إحالة حساب أقدم من حسابك.');
          }
        },
      },
      fulfilled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
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
