const { Op } = require("sequelize");
const { User, License, sequelize, Card, BankAccount, MobileWallet, Referral, Withdrawal, Device } = require("../models");
const bcrypt = require("bcrypt");
const { getCardDetails, checkCardNumber, generateOtp, addMinutes, uploadImage, uploadLicenseImage } = require("../helper");
const { UnauthorizedError, NotFoundError, ConflictError, InternalServerError, NotAcceptableError, BadRequestError } = require("../errors/Errors");
const { default: axios } = require("axios");
const config = require("../config");
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRATION, REFRESH_TOKEN_EXPIRATION, SECURITY_EXPIRATION } = require("../config/auth.config");
const { DRIVER_FEE, PASSENGER_FEE, CARDS_ENABLED, VERIFICATIONS_DISABLED, REFERRALS_DISABLED } = require("../config/seaats.config");

let otpCodes = {};

let otpCodes = {};

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
    if (!VERIFICATIONS_DISABLED) {
        if (!(phone in otpCodes) || !otpCodes[phone].verified) {
            throw new BadRequestError("Phone number is not verified");
        }
    }
    fname = fname.charAt(0).toUpperCase() + fname.slice(1);
    lname = lname.charAt(0).toUpperCase() + lname.slice(1);
    email = email.toLowerCase();

    const emailAvailable = await accountAvailable(undefined, email);
    if (!emailAvailable) {
        throw new ConflictError("Email is already in use");
    }

    const phoneAvailable = await accountAvailable(phone, undefined);
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
            verified: true,
            profilePicture: gender === 'MALE' ? 'https://storage.googleapis.com/alsekka_profile_pics/default_male.png' : 'https://storage.googleapis.com/alsekka_profile_pics/default_female.png'
        });
        return newUser;
    } catch (e) {
        throw new InternalServerError();
    }
}

async function loginUser({ phone, email, password, deviceToken }) {
    let userAccount;
    userAccount = await User.scope('auth').findOne({ where: { phone: phone } });
    if (!userAccount) {
        throw new UnauthorizedError("Invalid phone and/or password. Please try again.");
    }

    const result = await bcrypt.compare(password, userAccount.password);
    if (result) {
        const today = new Date();
        const license = await License.findOne({
            where: {
                UserId: userAccount.id,
                status: 'APPROVED',
                expiryDate: { [Op.gt]: today }
            }
        });

        if (deviceToken) {
            const device = await Device.findOne({
                where: {
                    deviceToken: deviceToken
                }
            });

            if (deviceToken && device.id !== userAccount.DeviceId) {
                userAccount.DeviceId = device.id;
                await userAccount.save();
            }
        }


        userAccount.password = undefined;

        const accessToken = jwt.sign({ userId: userAccount.id }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
        const refreshToken = jwt.sign({ userId: userAccount.id }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });


        return {
            ...userAccount.dataValues,
            driver: !!license,
            accessToken: accessToken,
            refreshToken: refreshToken,
            driverFee: DRIVER_FEE,
            passengerFee: PASSENGER_FEE,
            cardsEnabled: CARDS_ENABLED,
            verificationsDisabled: VERIFICATIONS_DISABLED,
            referralsDisabled: REFERRALS_DISABLED
        };
    } else {
        throw new UnauthorizedError("Invalid phone and/or password. Please try again.");
    }
}

async function userInfo({ deviceToken }, uid) {
    let userAccount = await User.findByPk(uid);

    const today = new Date();
    const license = await License.findOne({
        where: {
            UserId: uid,
            status: 'APPROVED',
            expiryDate: { [Op.gt]: today }
        }
    });

    if (deviceToken) {
        const device = await Device.findOne({
            where: {
                deviceToken: deviceToken
            }
        });

        if (deviceToken && device.id !== userAccount.DeviceId) {
            userAccount.DeviceId = device.id;
            await userAccount.save();
        }
    }

    return {
        ...userAccount.dataValues,
        driver: !!license,
        driverFee: DRIVER_FEE,
        passengerFee: PASSENGER_FEE,
        cardsEnabled: CARDS_ENABLED,
        verificationsDisabled: VERIFICATIONS_DISABLED,
        referralsDisabled: REFERRALS_DISABLED
    }
}

async function refreshToken({ refreshToken }) {
    try {
        // Verify the refresh token
        const decoded = await jwt.verify(refreshToken, JWT_SECRET);

        // Generate new access token
        const accessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

        // Return the new access token
        return { accessToken };
    } catch (err) {
        console.error(err);
        throw new UnauthorizedError('Invalid token');
    }
}

setInterval(() => {
    for (const [uid, codeObj] of Object.entries(otpCodes)) {
        if (codeObj.expiry > new Date()) {
            delete otpCodes[uid];
        }
    }
}, 1000 * 60 * config.otp.expiryMinutes);

async function getOtp(phone) {
    try {
        otpCodes[phone] = {
            verified: false,
            expiry: addMinutes(new Date(), config.otp.expiryMinutes)
        }

        const params = {
            "username": "25496940dd23fdaa990ac1d54adefa05cd43607bb47b7d41c2f9016edb98039e",
            "password": "67bd7d7edba830e85934671b5515e84a1150348fb14c020ad058490d2e1f13f8",
            "reference": phone,
            "message": "Welcome to Seaats! We have verified your account. Please head back to the app to continue the sign up process."
        }

        console.log("waiting for resp");

        const response = await axios.get("https://wasage.com/api/otp/", {
            params: params,
            headers: {
                'Content-Type': 'application/json',
            }
        });

        console.log("resp");
        console.log(response);

        const data = response.data;
        console.log(data);
        const jwtToken = jwt.sign({ phone: phone }, JWT_SECRET, { expiresIn: SECURITY_EXPIRATION });

        if (data.Code == "5500") {
            console.log(jwtToken);
            console.log("done");
            console.log(data.Clickable);
            return { uri: data.Clickable, token: jwtToken };
        } else {
            throw new InternalServerError("An unknown error occurred");
        }
    } catch (err) { console.log(err) }
}

async function verifyOtp({ phone, otp }) {
    const user = await User.findOne({ where: { phone: phone }, attributes: ['id', 'phone'] });
    const uid = user.id;

    const actualOtp = otpCodes[uid];
    if (!actualOtp) {
        throw new UnauthorizedError("This verification code is no longer valid, please try again");
    }

    if (actualOtp.otp == otp) {
        delete otpCodes[uid];
        return true;
    } else {
        return false;
    }
}

async function verifyUser(phone) {
    try {
        // User.findOne({ where: { phone: phone } }).then(user => {
        //     user.verified = true;
        //     user.save();
        // });
        otpCodes[phone] = {
            verified: true,
            expiry: addMinutes(new Date(), 15)
        }
    } catch (e) {
        // couldn't verify
        console.log(e);
    }
}

async function isVerified(phone) {
    // const user = await User.findOne({ where: { phone: phone } });
    // if (user) {
    //     if (user.verified === true) {
    //         return true;
    //     }
    // } else {
    //     return false;
    // }

    if (phone in otpCodes) {
        return otpCodes[phone].verified;
    }
    return false;
}

async function uploadProfilePicture(uid, file) {
    const imageUrl = await uploadImage(file);
    const user = await User.findByPk(uid);
    user.profilePicture = imageUrl;
    user.save();
    return user;
}

async function addReferral(uid, { referralCode }) {
    try {
        const reffererId = parseInt(referralCode);

        const reference = await Referral.create({
            ReferrerID: reffererId,
            RefereeID: uid
        });

        return reference;
    } catch (err) {
        throw new BadRequestError("Referral account is newer than your account");
    }
}

async function submitLicense({ uid, frontSide, backSide }) {
    try {
        const frontUrl = await uploadLicenseImage(frontSide);
        const backUrl = await uploadLicenseImage(backSide);
        const license = await License.create({
            UserId: uid,
            front: frontUrl,
            back: backUrl
        });
        return license;
    } catch (err) {
        console.error(err);
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

async function getWallet({ uid }) {
    const walletDetails = await Card.findAll({
        where: {
            UserId: uid
        }
    });

    let cards = [];
    for (let card of walletDetails) {
        cards.push(getCardDetails(card));
    }

    if (walletDetails === null) {
        throw new NotFoundError("User not found");
    }

    return cards;
}

async function submitWithdrawalRequest({ paymentMethodType, paymentMethodId }, uid) {
    const user = await User.findByPk(uid);

    console.log(paymentMethodType);
    console.log(paymentMethodId);

    const oldBalance = user.balance;
    const newBalance = Math.min(0, oldBalance);

    const t = await sequelize.transaction();

    const withdrawal = await Withdrawal.create({
        amount: oldBalance,
        UserId: uid,
        MobileWalletId: paymentMethodType === "WALLET" ? paymentMethodId : null,
        BankAccountId: paymentMethodType === "BANK" ? paymentMethodId : null,
    }, { transaction: t });

    user.balance = newBalance;
    await user.save({ transaction: t });

    await t.commit();

    return { balance: newBalance };
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
        console.error(err);
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


async function addMobileWallet({ uid, phone }) {
    try {
        const wallet = await MobileWallet.create({
            UserId: uid,
            phone: phone
        });
        return wallet;
    } catch (err) {
        throw new NotFoundError("User not found");
    }
}

async function getMobileWallets({ uid }) {
    const wallet = await MobileWallet.findAll({
        where: {
            UserId: uid
        }
    });
    return wallet;
}



async function addNewCard({ uid, cardNumber, cardExpiry, cardholderName }) {
    if (cardNumber.length !== 16 || !checkCardNumber(cardNumber)) {
        throw new NotAcceptableError("Invalid card number");
    }
    const expiryRegex = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
    if (!expiryRegex.test(cardExpiry)) {
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

async function updatePassword(phone, newPassword) {
    try {
        const user = await User.scope('auth').findOne({
            where: {
                phone: phone
            }
        });

        try {
            const hash = await bcrypt.hash(newPassword, 10);
            user.password = hash;
            user.save();
            return true;
        } catch (e) {
            throw new InternalServerError();
        }
    } catch (err) {
        throw new NotFoundError("User not found");
    }
}



module.exports = {
    accountAvailable,
    createUser,
    loginUser,
    getOtp,
    verifyOtp,
    verifyUser,
    getWallet,
    submitLicense,
    getLicense,
    addBank,
    getBanks,
    addMobileWallet,
    getMobileWallets,
    updateName,
    updateEmail,
    updatePhone,
    addNewCard,
    refreshToken,
    userInfo,
    updatePassword,
    addReferral,
    isVerified,
    uploadProfilePicture,
    submitWithdrawalRequest
}
