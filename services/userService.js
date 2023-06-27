const { Op } = require("sequelize");
const { User, License, sequelize, Card, BankAccount } = require("../models");
const bcrypt = require("bcrypt");
const { getCardDetails, checkCardNumber } = require("../helper");
const { UnauthorizedError, NotFoundError, ConflictError, InternalServerError, NotAcceptableError } = require("../errors/Errors")


async function accountAvailable(phone, email) {
    let userAccount;
    if (phone) {
        userAccount = await User.findOne({ where: { phone: phone }, attributes: ['id'] });
    } else if (email) {
        userAccount = await User.findOne({ where: { email: email }, attributes: ['id'] });
    }
    return (userAccount === null);
}

async function createUser({ fname, lname, phone, email, password, gender }) {
    fname = fname.charAt(0).toUpperCase() + fname.slice(1);
    lname = lname.charAt(0).toUpperCase() + lname.slice(1);
    email = email.toLowerCase();

    const emailAvailable = await accountAvailable(undefined, email);
    if (!emailAvailable) {
        throw new ConflictError("Email is already in use");
    }

    const phoneAvailable = await accountAvailable(phone, undefined);
    console.log(phoneAvailable);
    if (!phoneAvailable) {
        throw new ConflictError("Phone number is already in use")
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
        throw new InternalServerError();
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
        throw new UnauthorizedError("Invalid phone and/or password. Please try again.");
    }

    const result = await bcrypt.compare(password, userAccount.password);
    if (result) {
        return userAccount;
    } else {
        throw new UnauthorizedError("Invalid phone and/or password. Please try again.");
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

    if (user === null) {
        throw new NotFoundError("User not found");
    }

    return user;
}

async function getWallet({ uid }) {
    const walletDetails = await User.findByPk(uid, {
        attributes: ['balance'],
        include: [
            {
                model: Card,
                attributes: ['cardNumber'],
            }
        ]
    });

    if (walletDetails === null) {
        throw new NotFoundError("User not found");
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
    try {
        const license = await License.create({
            UserId: uid,
            front: frontSide,
            back: backSide
        });
        return license;
    } catch (err) {
        throw new NotFoundError("User not found");
    }


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

async function addBank({ uid, fullName, bankName, accNumber, swiftCode }) {
    try {
        const bank = await BankAccount.create({
            UserId: uid,
            fullName: fullName,
            bankName: bankName,
            accNumber: accNumber,
            swiftCode: swiftCode
        });
        return bank;
    } catch (err) {
        throw new NotFoundError("User not found");
    }
}

async function getBanks({ uid }) {
    const bank = await BankAccount.findAll({
        where: {
            UserId: uid
        }
    });

    return bank;
}

async function addNewCard({ uid, cardNumber, cardExpiry, cardholderName }) {
    if(cardNumber.length !== 16 || !checkCardNumber(cardNumber)) {
        throw new NotAcceptableError("Invalid card number");
    }
    const expiryRegex = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
    if(!expiryRegex.test(cardExpiry)) {
        throw new NotAcceptableError("Invalid expiry date. Please enter in the form MM/YY");
    }
    try {
        const card = await Card.create({
            UserId: uid,
            cardholderName: cardholderName,
            cardNumber: cardNumber,
            cardExpiry: cardExpiry
        });
        return card;
    } catch (err) {
        throw new NotFoundError("User not found");
    }
}

async function updateName({ uid, firstName, lastName }) {
    try {
        const user = await User.findByPk(uid);
        user.firstName = firstName;
        user.lastName = lastName;
        await user.save();
        return user;
    } catch (err) {
        throw new NotFoundError("User not found");
    }

}

async function updateEmail({ uid, email }) {
    const emailAvailable = await accountAvailable(undefined, email);
    if (!emailAvailable) {
        throw new ConflictError("Email already in use");
    }
    try {
        const user = await User.findByPk(uid);
        user.email = email;
        await user.save();
        return user;
    } catch (err) {
        throw new NotFoundError("User not found");
    }
}

async function updatePhone({ uid, phone }) {
    const phoneAvailable = await accountAvailable(phone, undefined);
    if (!phoneAvailable) {
        throw new ConflictError("Phone number already in use");
    }
    try {
        const user = await User.findByPk(uid);
        user.phone = phone;
        await user.save();
        return user;
    } catch (err) {
        throw new NotFoundError("User not found");
    }
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
    getBanks,
    updateName,
    updateEmail,
    updatePhone,
    addNewCard
}