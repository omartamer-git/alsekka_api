const { Op } = require("sequelize");
const { User, License, sequelize, Card, BankAccount, MobileWallet, Referral, Withdrawal, Device, DriverInvoice, ChatMessage, Ride, Passenger, Socials, UserPreference } = require("../models");
const bcrypt = require("bcrypt");
const { getCardDetails, checkCardNumber, generateOtp, addMinutes, uploadImage, uploadLicenseImage, capitalizeFirstLetter } = require("../helper");
const { UnauthorizedError, NotFoundError, ConflictError, InternalServerError, NotAcceptableError, BadRequestError } = require("../errors/Errors");
const { default: axios } = require("axios");
const config = require("../config");
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRATION, REFRESH_TOKEN_EXPIRATION, SECURITY_EXPIRATION } = require("../config/auth.config");
const { DRIVER_FEE, PASSENGER_FEE, CARDS_ENABLED, VERIFICATIONS_DISABLED, REFERRALS_DISABLED, CITIES } = require("../config/seaats.config");
const redis = require('ioredis');

let otpCodes = {};

async function accountAvailable(phone, email) {
    const userAccount = await User.findOne({
        where: {
            [Op.or]: {
                phone: phone,
                email: email
            }
        }, attributes: ['id', 'phone', 'email']
    });

    if (userAccount === null) {
        return [true, true];
    } else {
        let p = true;
        let e = true;
        if (userAccount.phone == phone) {
            p = false;
        }

        if (userAccount.email == email) {
            e = false;
        }

        return [p, e];
    }
}

async function checkOtp({ phone, otp }) {
    if (phone in otpCodes) {
        const actualOtp = otpCodes[phone];
        console.log(actualOtp);
        if (actualOtp.code == otp) {
            otpCodes[phone].verified = true;
            return true;
        } else {
            throw new BadRequestError("Incorrect verification code", "رمز التحقق غير صحيح");
        }
    } else {
        throw new BadRequestError("Phone number is not verified, please try again", "لم يتم التحقق من رقم الهاتف. حاول مرة اخرى");
    }
}

async function createUser({ fname, lname, phone, email, password, gender }) {
    // log all params
    console.log(fname, lname, phone, email, password, gender)
    if (!VERIFICATIONS_DISABLED) {
        if (!(phone in otpCodes) || !otpCodes[phone].verified) {
            console.log("BAD REQ ERR HERE")
            throw new BadRequestError("Phone number is not verified, please try again", "لم يتم التحقق من رقم الهاتف. حاول مرة اخرى");
        }
    }
    fname = capitalizeFirstLetter(fname);

    lname = capitalizeFirstLetter(lname);

    email = email.toLowerCase();

    const accAvailable = await accountAvailable(phone, email);
    if (!accAvailable[0] || !accAvailable[1]) {
        // Email or phone already in use
        throw new ConflictError();
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
        console.log(e);
        throw new InternalServerError();
    }
}

async function deleteUser(id, { password }) {
    const user = await User.scope('auth').findByPk(id);
    const result = await bcrypt.compare(password, user.password);
    if (!result) throw new UnauthorizedError("Incorrect phone and/or password", "رقم الهاتف أو كلمة المرور غير صحيحة. حاول مرة اخرى.");
    user.deleted = true;
    user.deletedSince = new Date();
    await user.save();
    return true;
}

async function linkUserDevice(id, { deviceToken }) {
    const user = await User.findByPk(id);
    const device = await Device.findOne({ where: { deviceToken: deviceToken } });
    if (device && user.DeviceId !== device.id) {
        user.DeviceId = device.id;
        await user.save();
    }
}

async function getUserStats(id) {
    const numRidesDrivenPromise = Ride.count({
        where: {
            DriverId: id,
            status: 'COMPLETED'
        }
    });

    const numRidesTakenPromise = Passenger.count({
        where: {
            UserId: id,
            status: 'ARRIVED'
        }
    });

    const createdAtPromise = User.scope('timestamps').findByPk(id, { attributes: ['createdAt'] });

    const [numRidesDriven, numRidesTaken, user] = await Promise.all([numRidesDrivenPromise, numRidesTakenPromise, createdAtPromise]);

    return {
        ridesDriven: numRidesDriven,
        ridesTaken: numRidesTaken + numRidesDriven,
        createdAt: user.createdAt
    }
}

async function getUserProfile(uid) {
    // const userPromise = User.findByPk(uid);
    const preferencesPromise = findPreferences(uid);
    const socialsPromise = getSocials(uid);
    const statsPromise = getUserStats(uid);

    const [socials, stats, preferences] = await Promise.all([socialsPromise, statsPromise, preferencesPromise]);
    // const [user, socials, stats, preferences] = await Promise.all([userPromise, socialsPromise, statsPromise, preferencesPromise]);

    return {
        socials,
        stats,
        preferences
    }
}

async function loginUser({ phone, email, password, deviceToken }) {
    let userAccount;
    userAccount = await User.scope('auth').findOne({ where: { phone: phone } });
    if (!userAccount) {
        throw new UnauthorizedError("Incorrect phone and/or password", "رقم الهاتف أو كلمة المرور غير صحيحة. حاول مرة اخرى.");
    }

    if (userAccount.deleted) {
        const currentDate = new Date();
        let fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(currentDate.getDate() - 14);

        if (userAccount.deletedSince <= fourteenDaysAgo) {
            throw new UnauthorizedError("Incorrect phone and/or password", "رقم الهاتف أو كلمة المرور غير صحيحة. حاول مرة اخرى.");
        }
    }

    const result = await bcrypt.compare(password, userAccount.password);
    if (result) {
        if (userAccount.deleted) {
            userAccount.deleted = false;
            userAccount.deletedSince = null;
            userAccount.save();
        }
        const today = new Date();
        const licensePromise = License.findOne({
            where: {
                UserId: userAccount.id,
                status: 'APPROVED',
                expiryDate: { [Op.gt]: today }
            }
        });

        const chatsPromise = ChatMessage.count({
            where: {
                ReceiverId: userAccount.id,
                messageread: false
            }
        });

        const socialsPromise = getSocials(userAccount.id);

        const statsPromise = getUserStats(userAccount.id);

        const preferencesPromise = findPreferences(userAccount.id);

        const [license, chats, stats, socials, preferences] = await Promise.all([licensePromise, chatsPromise, statsPromise, socialsPromise, preferencesPromise]);


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
            referralsDisabled: REFERRALS_DISABLED,
            cities: CITIES,
            unreadMessages: chats,
            stats: stats,
            socials: socials,
            preferences: preferences
        };
    } else {
        throw new UnauthorizedError("Incorrect phone and/or password", "رقم الهاتف أو كلمة المرور غير صحيحة. حاول مرة اخرى.");
    }
}

async function userInfo({ deviceToken }, uid) {
    let userAccount = await User.findByPk(uid);

    const today = new Date();
    const licensePromise = License.findOne({
        where: {
            UserId: uid,
            status: 'APPROVED',
            expiryDate: { [Op.gt]: today }
        }
    });

    const chatsPromise = ChatMessage.count({
        where: {
            ReceiverId: uid,
            messageread: false
        }
    });

    const socialsPromise = getSocials(uid);

    const statsPromise = getUserStats(uid);

    const preferencesPromise = findPreferences(uid);

    const [license, chats, stats, socials, preferences] = await Promise.all([licensePromise, chatsPromise, statsPromise, socialsPromise, preferencesPromise]);

    return {
        ...userAccount.dataValues,
        driver: !!license,
        driverFee: DRIVER_FEE,
        passengerFee: PASSENGER_FEE,
        cardsEnabled: CARDS_ENABLED,
        verificationsDisabled: VERIFICATIONS_DISABLED,
        referralsDisabled: REFERRALS_DISABLED,
        cities: CITIES,
        socials: socials,
        stats: stats,
        preferences: preferences,
        unreadMessages: chats
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
        let code = (Math.random() * 99999).toFixed(0).toString().padStart(5, '0');
        

        if(phone in otpCodes) {
            return { type: "sms", success: true };
        }

        otpCodes[phone] = {
            verified: false,
            expiry: addMinutes(new Date(), config.otp.expiryMinutes),
            code: code
        }


        if (!phone.startsWith("010")) {
            const params = {
                "environment": 1,
                "username": process.env.SMS_USERNAME,
                "password": process.env.SMS_PASSWORD,
                "sender": process.env.SMS_SENDER,
                "language": "1",
                "mobile": `2${phone}`,
                "template": "e83faf6025ec41d0f40256d2812629f5fa9291d05c8322f31eea834302501da8",
                "otp": code
            }

            console.log(params);

            const response = await axios.post(`https://smsmisr.com/api/OTP/?environment=2&username=${params.username}&password=${params.password}&sender=${params.sender}&language=1&mobile=${params.mobile}&template=${params.template}&otp=${params.otp}`);

            console.log(response.data);

            return { type: "sms", success: true };
        } else {
            const params = {
                "username": "25496940dd23fdaa990ac1d54adefa05cd43607bb47b7d41c2f9016edb98039e",
                "password": "67bd7d7edba830e85934671b5515e84a1150348fb14c020ad058490d2e1f13f8",
                "reference": phone,
                "message": "Welcome to Seaats! We have verified your account. Please head back to the app to continue the sign up process.\n\nمرحبا بكم في سيتس! لقد قمنا بالتحقق من حسابك. يرجى العودة إلى التطبيق لمواصلة عملية التسجيل."
            }
            const response = await axios.get("https://wasage.com/api/otp/", {
                params: params,
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = response.data;
            const jwtToken = jwt.sign({ phone: phone }, JWT_SECRET, { expiresIn: SECURITY_EXPIRATION });

            if (data.Code == "5500") {
                return { type: "whatsapp", uri: data.Clickable, token: jwtToken };
            } else {
                throw new InternalServerError();
            }
        }
    } catch (err) {
        console.log(err)
    }
}

async function verifyOtp({ phone, otp }) {
    const user = await User.findOne({ where: { phone: phone }, attributes: ['id', 'phone'] });
    const uid = user.id;

    const actualOtp = otpCodes[uid];
    if (!actualOtp) {
        throw new UnauthorizedError("This verification code is no longer valid, please try again", "رمز التحقق هذا لم يعد صالحا، يرجى المحاولة مرة أخرى");
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
        otpCodes[phone] = {
            verified: true,
            expiry: addMinutes(new Date(), 15)
        }
    } catch (e) {
        console.log(e);
    }
}

async function isVerified(phone) {
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
    const t = await sequelize.transaction();

    try {
        const reffererId = parseInt(referralCode);

        if (reffererId > uid) {
            throw new BadRequestError();
        }

        const reference = await Referral.create({
            ReferrerID: reffererId,
            RefereeID: uid
        }, { transaction: t });

        // const [user1, user2] = await Promise.all([User.findByPk(uid), User.findByPk(reffererId)]);
        // user1.balance = parseFloat(user1.balance) + parseFloat(process.env.REFERRAL_SUM);
        // user2.balance = parseFloat(user2.balance) + parseFloat(process.env.REFERRAL_SUM);
        // await user1.save({ transaction: t });
        // await user2.save({ transaction: t });

        await t.commit();

        return reference;
    } catch (err) {
        await t.rollback();
        throw new BadRequestError(err.message || "Referral account is newer than your account", err.message_ar || "حساب الإحالة أحدث من حسابك");
    }
}

async function getSocials(uid) {
    const socials = await Socials.findOne({
        where: {
            UserId: uid
        }
    });

    return socials;
}

async function updateFacebookLink(uid, { facebookLink }) {
    // check if facebook link is validc
    const fbRegex = /^(?:(?:http|https):\/\/)?(?:www\.)?(?:facebook|fb|m\.facebook)\.(?:com|me)\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[\w\-]*\/)*([\w\-\.]+)(?:\/)?/
    if (!(fbRegex.test(facebookLink))) {
        throw new BadRequestError("Invalid Facebook link", "رابط الفيسبوك غير صالح");
    }

    const social = await Socials.findOne({
        where: {
            UserId: uid
        }
    });

    if (social) {
        social.facebookLink = facebookLink;
        await social.save();
        return social;
    } else {
        const newSocial = await Socials.create({
            UserId: uid,
            facebookLink: facebookLink
        });
        return newSocial;
    }
}

async function updateInstagramLink(uid, { instagramLink }) {
    const igRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/
    if (!(igRegex.test(instagramLink))) {
        throw new BadRequestError("Invalid Instagram link", "رابط الإنستغرام غير صالح");
    }

    const social = await Socials.findOne({
        where: {
            UserId: uid
        }
    });

    if (social) {
        social.instagramLink = instagramLink;
        await social.save();
        return social;
    } else {
        const newSocial = await Socials.create({
            UserId: uid,
            instagramLink: instagramLink
        });
        return newSocial;
    }
}

async function updateMusicLink(uid, { musicLink }) {
    const spotifyRegex = /^https?:\/\/open\.spotify\.com\/user\/.+$/
    const anghamiRegex = /^https?:\/\/open\.anghami\.com\/[a-zA-Z0-9_]+\/?$/
    const appleMusicRegex = /^https?:\/\/music\.apple\.com(?:$|\/)/

    if (!spotifyRegex.test(musicLink) && !anghamiRegex.test(musicLink) && !appleMusicRegex.test(musicLink)) {
        throw new BadRequestError("Invalid music link", "رابط الموسيقى غير صالح");
    }

    const social = await Socials.findOne({
        where: {
            UserId: uid
        }
    });

    if (social) {
        social.musicLink = musicLink;
        await social.save();
        return social;
    } else {
        const newSocial = await Socials.create({
            UserId: uid,
            musicLink: musicLink
        });
        return newSocial;
    }
}

async function findPreferences(uid) {
    return await UserPreference.findOne({ where: { UserId: uid } });
}

async function updatePreferences(uid, { smoking, chattiness, music, rest_stop }) {
    const preferences = await findPreferences(uid);
    if (preferences) {
        preferences.smoking = smoking;
        preferences.chattiness = chattiness;
        preferences.music = music;
        preferences.rest_stop = rest_stop;
        await preferences.save();
    } else {
        UserPreference.create({ UserId: uid, smoking, chattiness, music, rest_stop });
    }
    return preferences;
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
        throw new NotFoundError();
    }


}

async function getLicense({ uid }) {
    const license = await License.findOne({
        where: {
            UserId: uid,
            expiryDate: {
                [Op.or]: {
                    [Op.eq]: null,
                    [Op.gt]: sequelize.literal('CURDATE()')
                }
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
        throw new NotFoundError();
    }

    return cards;
}

async function submitWithdrawalRequest({ paymentMethodType, paymentMethodId }, uid) {
    const user = await User.findByPk(uid);

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

async function getWithdrawalRequests(uid) {
    const withdrawals = await Withdrawal.findAll({
        where: {
            UserId: uid
        }
    });

    return withdrawals;
}

async function getUserBalance(uid) {
    const user = await User.findByPk(uid);
    return user.balance;
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
        throw new NotFoundError();
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
        throw new NotFoundError();
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
        throw new NotAcceptableError("Invalid card number", "رقم البطاقة غير صالحة");
    }
    const expiryRegex = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
    if (!expiryRegex.test(cardExpiry)) {
        throw new NotAcceptableError("Invalid expiry date. Please enter in the form MM/YY", "تاريخ انتهاء الصلاحية غير صالح. الرجاء إدخال النموذج MM/YY");
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
        throw new NotFoundError();
    }
}

async function updateName({ uid, firstName, lastName }) {
    try {
        const user = await User.findByPk(uid);
        user.firstName = capitalizeFirstLetter(firstName);
        user.lastName = capitalizeFirstLetter(lastName);
        await user.save();
        return user;
    } catch (err) {
        throw new NotFoundError();
    }

}

async function updateEmail({ uid, email }) {
    email = email.toLowerCase();
    const emailAvailable = await accountAvailable(null, email);
    if (!emailAvailable[1]) {
        throw new ConflictError("Email already in use", "البريد الإلكتروني قيد الاستخدام من قبل حساب آخر");
    }
    try {
        const user = await User.findByPk(uid);
        user.email = email;
        await user.save();
        return user;
    } catch (err) {
        throw new NotFoundError();
    }
}

async function updatePhone({ uid, phone }) {
    const phoneAvailable = await accountAvailable(phone, null);
    if (!phoneAvailable[0]) {
        throw new ConflictError("Phone number already in use", "رقم الهاتف قيد الاستخدام من قبل حساب آخر");
    }
    try {
        const user = await User.findByPk(uid);
        user.phone = phone;
        await user.save();
        return user;
    } catch (err) {
        throw new NotFoundError();
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
        throw new NotFoundError();
    }
}

async function settleBalance(uid) {
    const t = await sequelize.transaction();
    try {

        const user = await User.findByPk(uid);
        const transaction = await DriverInvoice.create({
            amount: user.balance * -1,
            transactionType: 'SETTLEMENT',
            DriverId: uid,
            RideId: null
        }, { transaction: t });

        user.balance = 0;
        await user.save({ transaction: t });
        await t.commit();
    } catch (err) {
        console.log(err);
        // TODO: Refund
        await t.rollback();
        throw new InternalServerError();
    }
}

async function getUserSettlementId(uid) {
    try {
        const cnt = await DriverInvoice.count({
            where: {
                DriverId: uid
            }
        });

        return `${uid}-${cnt}`;
    } catch (err) {
        // TODO: Refund
        throw new InternalServerError();
    }
}



module.exports = {
    accountAvailable,
    createUser,
    deleteUser,
    getUserSettlementId,
    loginUser,
    linkUserDevice,
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
    updateFacebookLink,
    updateInstagramLink,
    updateMusicLink,
    updatePreferences,
    getUserProfile,
    addNewCard,
    refreshToken,
    userInfo,
    updatePassword,
    addReferral,
    checkOtp,
    isVerified,
    uploadProfilePicture,
    getUserBalance,
    submitWithdrawalRequest,
    getWithdrawalRequests,
    settleBalance
}
