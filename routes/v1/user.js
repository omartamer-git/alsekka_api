const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError, UnauthorizedError } = require('../../errors/Errors');
const router = express.Router();
const userService = require("../../services/userService");
const { JWT_EXPIRATION, JWT_SECRET } = require('../../config/auth.config');
const jwt = require('jsonwebtoken');
const { isValidEmail } = require('../../helper');
const { REFERRALS_DISABLED } = require('../../config/seaats.config');
const { default: rateLimit } = require('express-rate-limit');
const { generateKashierDriverSettlementHash } = require('../../services/kashierService');
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);

router.get("/accountavailable", async (req, res, next) => {
    const { phone, email } = req.query;
    if (!phone || !email) {
        return next(new BadRequestError());
    }

    const available = userService.accountAvailable(phone, email).then(
        available => {
            res.json({ phone: available[0], email: available[1] });
        }
    ).catch(next);
});

router.get("/userinfo", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    userService.userInfo(req.query, uid).then((response) => {
        res.json(response);
    }).catch(next);
});

router.get("/createaccount", async (req, res, next) => {
    let { fname, lname, phone, email, password, gender } = req.query;

    if (!fname || !lname || !phone || !email || !password || !gender || !isValidEmail(email)) {
        return next(new BadRequestError());
    }

    userService.createUser(req.query).then(
        newUser => {
            res.json(newUser)
        }
    ).catch(next);
});

router.post("/deleteuser", authenticateToken, async (req, res, next) => {
    const password = req.body?.password;
    const uid = req.user.userId;

    if (!password) return next(new BadRequestError());
    userService.deleteUser(uid, req.body).then(() => {
        res.status(200).json({});
    }).catch(next);
});

router.get("/login", async (req, res, next) => {
    const { phone, email, password } = req.query;
    if ((!phone && !email) || !password) {
        return next(new BadRequestError());
    }

    userService.loginUser(req.query).then(
        userAccount => {
            return res.json(userAccount);
        }
    ).catch(next);
});

router.post("/linkdevice", authenticateToken, async (req, res, next) => {
    const { deviceToken } = req.body;

    if (!deviceToken) { return next(new BadRequestError()) }
    userService.linkUserDevice(req.user.userId, req.body).then(() => {
        res.status(200).send();
    }).catch(next);
});

router.post('/uploadprofilepicture', authenticateToken, async (req, res, next) => {
    try {
        if (!req.files) {
            return next(new BadRequestError());
        }

        userService.uploadProfilePicture(req.user.userId, req.files[0]).then(response => {
            res.json(response);
        }).catch(next);
    } catch (error) {
        console.error(error);
        next(error)
    }
});

router.post("/refreshToken", async (req, res, next) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return next(new BadRequestError());
    }

    const accessToken = userService.refreshToken(req.body).then(
        refreshToken => {
            return res.json(refreshToken);
        }
    ).catch(next);
});

router.get("/verify", async (req, res, next) => {
    const phone = req.query.phone;
    if (!phone) {
        return next(new BadRequestError());
    }

    userService.getOtp(phone).then(response => {
        return res.json(response);
    }).catch(next);
});

router.get("/isverified", async (req, res, next) => {
    const phone = req.query.phone;

    const isVerified = await userService.isVerified(phone);
    if (isVerified) {
        res.json({ verified: true });
    } else {
        res.json({ verified: false });
    }
});

router.patch("/verifysecurity", async (req, res, next) => {
    const { otp, phone } = req.body;
    if (!phone || !otp) {
        return next(new BadRequestError());
    }

    userService.verifyOtp(req.body).then(response => {
        if (response === true) {
            userService.verifyUser(phone).then(() => {
                const securityToken = jwt.sign({ phone: phone }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
                res.json({ token: securityToken });
            });
        } else {
            next(new UnauthorizedError("Invalid verification code. Please try again", "رمز التحقق غير صالح. حاول مرة اخرى."));
        }
    }).catch(next);
});

router.patch("/changepassword", async (req, res, next) => {
    const { token, newPassword } = req.body;


    if (!token || !newPassword) {
        return next(new BadRequestError());
    }

    jwt.verify(token, JWT_SECRET, (err, data) => {
        if (err) {
            next(new UnauthorizedError());
        }

        userService.updatePassword(data.phone, newPassword).then(() => {
            res.status(200).send();
        }).catch(next);
    });
});

router.post("/referral", authenticateToken, async (req, res, next) => {
    const { referralCode } = req.body;
    const uid = req.user.userId;

    if (!referralCode || REFERRALS_DISABLED) {
        next(new BadRequestError());
    }

    userService.addReferral(uid, req.body).then((ref) => {
        res.json(ref);
    }).catch(next);
});

router.get("/wallet", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getWallet({ uid, ...req.query }).then(walletDetails => {
        return res.json(walletDetails);
    }).catch(next);
});

router.patch("/linkfacebook", authenticateToken, async (req, res, next) => {
    const { facebookLink } = req.body;
    const uid = req.user.userId;

    if (!facebookLink) {
        return next(new BadRequestError());
    }

    userService.updateFacebookLink(uid, req.body).then((response) => {
        res.status(200).json(response);
    }).catch(next);
});

router.patch("/linkinstagram", authenticateToken, async (req, res, next) => {
    const { instagramLink } = req.body;
    const uid = req.user.userId;

    if (!instagramLink) {
        return next(new BadRequestError());
    }

    userService.updateInstagramLink(uid, req.body).then((response) => {
        res.status(200).json(response);
    }).catch(next);
});


router.patch("/linkmusic", authenticateToken, async (req, res, next) => {
    const { musicLink } = req.body;
    const uid = req.user.userId;

    if (!musicLink) {
        return next(new BadRequestError());
    }

    userService.updateMusicLink(uid, req.body).then((response) => {
        res.status(200).json(response);
    }).catch(next);
});

router.get("/profile", authenticateToken, async (req, res, next) => {
    const uid = req.query.userId || req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getUserProfile(uid).then(profile => {
        return res.json(profile);
    }).catch(next);
});

router.put("/preferences", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.updatePreferences(uid, req.body).then(preferences => {
        return res.json(preferences);
    }).catch(next);
});


router.post("/submitlicense", authenticateToken, async (req, res, next) => {
    const front = req.files[0];
    const back = req.files[1];
    const uid = req.user.userId;

    if (!front || !back) {
        return next(new BadRequestError());
    }

    userService.submitLicense({ uid, frontSide: front, backSide: back }).then(license => {
        return res.json(license);
    }).catch(next);
});

router.get("/license", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getLicense({ uid, ...req.query }).then(license => {
        return res.json(license);
    }).catch(next);
});

router.post("/bankaccount", authenticateToken, async (req, res, next) => {
    const { fullName, bankName, accNumber, swiftCode } = req.body;
    const uid = req.user.userId;

    if (!uid || !fullName || !bankName || !accNumber) {
        return next(new BadRequestError());
    }

    userService.addBank({ uid, fullName, bankName, accNumber, swiftCode, ...req.body }).then(addBankResult => {
        return res.json(addBankResult);
    }).catch(next);
});


router.get("/banks", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getBanks({ uid, ...req.query }).then(banks => {
        return res.json(banks);
    }).catch(next);
});

router.post("/withdrawalrequest", authenticateToken, async (req, res, next) => {
    const { paymentMethodType, paymentMethodId } = req.body;

    if (!paymentMethodId || !paymentMethodType) {
        return next(new BadRequestError());
    }

    const uid = req.user.userId;

    userService.submitWithdrawalRequest(req.body, uid).then(withdrawal => {
        res.json(withdrawal)
    }).catch(next);
});

router.get("/withdrawalrequest", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    userService.getWithdrawalRequests(uid).then(withdrawals => {
        res.json(withdrawals)
    }).catch(next);
});

router.post("/mobilewallet", authenticateToken, async (req, res, next) => {
    const { phone } = req.body;
    const uid = req.user.userId;

    if (!uid || !phone) {
        return next(new BadRequestError());
    }

    userService.addMobileWallet({ uid, phone, ...req.body }).then(addWalletResult => {
        return res.json(addWalletResult);
    }).catch(next);
});

router.get("/mobilewallets", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getMobileWallets({ uid, ...req.query }).then(wallets => {
        return res.json(wallets);
    }).catch(next);
});

router.post("/card", authenticateToken, async (req, res, next) => {
    const { cardNumber, cardExpiry, cardholderName } = req.body;
    const uid = req.user.userId;

    if (!uid || !cardNumber || !cardExpiry || !cardholderName) {
        return next(new BadRequestError());
    }

    userService.addNewCard({ uid, cardNumber, cardExpiry, cardholderName, ...req.body }).then(addCardResult => {
        return res.json(addCardResult);
    }).catch(next);
});

router.patch("/name", authenticateToken, async (req, res, next) => {
    const { firstName, lastName } = req.body;
    const uid = req.user.userId;

    if (!uid || !firstName || !lastName || firstName.length < 2 || firstName.length > 20 || lastName.length < 2 || lastName.length > 20) {
        return next(new BadRequestError());
    }

    userService.updateName({ uid, firstName, lastName, ...req.body }).then(updateNameResult => {
        return res.json(updateNameResult);
    }).catch(next);
});


router.patch("/phone", authenticateToken, async (req, res, next) => {
    const { phone } = req.body;
    const uid = req.user.userId;

    if (!phone) {
        return next(new BadRequestError());
    }

    userService.updatePhone({ uid, phone, ...req.body }).then(updatePhoneResult => {
        return res.json(updatePhoneResult);
    }).catch(next);
});


router.patch("/email", authenticateToken, async (req, res, next) => {
    const { email } = req.body;
    const uid = req.user.userId;

    if (!uid || !email) {
        return next(new BadRequestError());
    }

    userService.updateEmail({ uid, email, ...req.body }).then(updateEmailResult => {
        return res.json(updateEmailResult);
    }).catch(next);
});

router.get("/settlementId", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    const settlementId = await userService.getUserSettlementId(uid);

    res.json({
        settlementId: crypto.randomUUID()
    });
});

router.get("/settle", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;
    const settlementId = req.query.settlementId;

    const userBalance = await userService.getUserBalance(uid);
    if (userBalance >= 0) {
        return next(new BadRequestError());
    }
    const hash = generateKashierDriverSettlementHash(uid, settlementId, userBalance);

    res.json({
        hash
    });
});

// router.post("/updatelocation", authenticateToken, async(req, res, next) => {
//     const {lat, lng, timestamp} = req.body;
//     const uid = req.user.userId;

//     redisClient.set(`driverLocation:${uid}`, JSON.stringify(req.body), 'EX', 60 * 60);

//     res.status(200).send();
// });




module.exports = router;
