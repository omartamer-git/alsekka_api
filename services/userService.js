const { Op } = require("sequelize");
const { User, License, sequelize, Card, BankAccount } = require("../models");
const bcrypt = require("bcrypt");
const { getCardDetails } = require("../helper");

async function accountAvailable(phone, email) {
    let userAccount;
    if (phone) {
        userAccount = await User.findOne({ where: { phone: phone } });
    } else if (email) {
        userAccount = await User.findOne({ where: { email: email } });
    }
    return (userAccount === null);
}

async function createUser({ fname, lname, phone, email, password, gender }) {
    fname = fname.charAt(0).toUpperCase() + fname.slice(1);
    lname = lname.charAt(0).toUpperCase() + lname.slice(1);
    email = email.toLowerCase();

    const emailAvailable = accountAvailable(undefined, email);
    const phoneAvailable = accountAvailable(phone, undefined);
    if (!emailAvailable) {
        throw new Error("Email is already in use");
    } else if (!phoneAvailable) {
        throw new Error("Phone number is already in use")
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            firstName: fname,
            lastName: lname,
            phone: phone,
            email: email,
            password: hash,
            gender: gender,
        });
        return newUser;
    } catch (e) {
        console.error(e);
        throw new Error("Unexpected error occured");
    }
}

async function loginUser({ phone, email, password }) {
    let userAccount;
    if (phone) {
        userAccount = await User.findOne({ where: { phone: phone } });
    } else if (email) {
        userAccount = await User.findOne({ where: { email: email } });
    }

    if (userAccount === null) {
        throw 401;
    }

    try {
        const result = await bcrypt.compare(password, userAccount.password);
        if (result) {
            return userAccount;
        } else {
            throw 401;
        }
    } catch (e) {
        console.error(e);
        throw 500;
    }
}

async function userInfo({ uid }) {
    const user = await User.findByPk(uid,
        {
            attributes: [
                'firstName',
                'lastName',
                'phone',
                'email',
                'balance',
                'rating',
                'profilePicture',
                'gender',
                [
                    sequelize.literal('(COUNT(licenses.id) >= 1)'),
                    'driver'
                ]
            ],
            include: [
                {
                    model: License,
                    attributes: [],
                    where: {
                        status: 'APPROVED',
                        expiryDate: { [Op.gt]: sequelize.literal('CURDATE()') }
                    },
                    required: true
                }
            ]
        });

    return user;
}

async function getWallet({ uid }) {
    const walletDetails = await User.findByPk(uid, {
        attributes: ['balance'],
        include: [
            {
                model: Card,
                attributes: ['cardnumber'],
            }
        ]
    });

    if (walletDetails === null) {
        throw 404;
    }
    let result = {
        balance: walletDetails.balance,
        cards: []
    };
    for (const card of walletDetails.Cards) {
        result.cards.push(getCardDetails(card));
    }

    return result;
}

async function submitLicense({ uid, frontSide, backSide }) {
    console.log("UID: ", uid);
    const license = await License.create({
        UserId: uid,
        front: frontSide,
        back: backSide
    });

    return license;
}

async function getLicense({ uid }) {
    const license = await License.findOne({
        where: {
            UserId: uid,
            [Op.or]: {
                expiryDate: null,
                expiryDate: { [Op.gt]: sequelize.literal('CURDATE()') }
            }
        },
        order: [['expiryDate', 'DESC']]
    });
    return license;
}

async function addBank({ uid, fullName, bankName, accountNumber, swiftCode }) {
    const bank = await BankAccount.create({
        UserId: uid,
        fullName: fullName,
        bankName: bankName,
        accountNumber: accountNumber,
        swiftCode: swiftCode
    });

    return bank;
}

async function getBanks({ uid }) {
    const bank = await BankAccount.findAll({
        where: {
            UserId: uid
        }
    });

    return bank;
}


module.exports = {
    accountAvailable,
    createUser,
    loginUser,
    userInfo,
    getWallet,
    submitLicense,
    getLicense,
    addBank,
    getBanks
}