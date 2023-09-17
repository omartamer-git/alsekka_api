const express = require("express");
// const cors = require('cors');

const bcrypt = require("bcrypt");

const config = require("./config");
const helper = require("./helper");
const multer = require('multer');
const log4js = require("log4js");
const userService = require("./services/userService");
const rideService = require("./services/rideService");
const carService = require("./services/carService");
const appService = require("./services/appService");
const communityService = require("./services/communityService");
const chatService = require("./services/chatService");
const cookieParser = require("cookie-parser");
const jwt = require('jsonwebtoken');
const { authenticateToken, sessionChecker } = require("./middleware/authenticateToken");
const { JWT_SECRET, JWT_EXPIRATION } = require("./config/auth.config");
const { getPredictions, geocode, getLocationFromPlaceId } = require("./services/googleMapsService");
const { staffLogin, findUser, updateUser, customerLicenses, updateLicense, getPendingLicenses, updateCar, getPendingCars, getMembers, createStaffMember, getStaffMember, editStaffMember, getAllAnnouncements, updateAnnouncement, createAnnouncement, getFullRide, cancelRide } = require("./services/staffService");
const session = require("express-session");


const { BadRequestError, NotAcceptableError, UnauthorizedError } = require("./errors/Errors");
const { default: axios } = require("axios");
const app = express();

const multerMid = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
})

app.disable('x-powered-by')
// app.use(multerMid.single('file'))
app.use(multerMid.any());
app.use(express.json());

// app.use(cors());
app.use(cookieParser());
app.use(session({
    secret: 'seschret_password_goes_brazy',
    resave: false,
    saveUninitialized: true,
}));
app.use(
    express.urlencoded({
        extended: true,
    })
);




log4js.configure({
    appenders: {
        console: { type: 'console' },
        file: {
            type: 'file',
            filename: 'logs/app.log',
            maxLogSize: 10485760, // 10 MB
            backups: 5,
            compress: true,
            level: 'warn' // Only log messages at the warn level or higher
        }
    },
    categories: {
        default: { appenders: ['console', 'file'], level: 'debug' }
    }
});
const logger = log4js.getLogger();


app.post("/driverenrollment", async (req, res, next) => {
    const { fullName, phoneNumber, carDescription, token } = req.body;

    if (!fullName || !phoneNumber || !carDescription || !token) {
        return next(new BadRequestError());
    }

    let url = 'https://www.google.com/recaptcha/api/siteverify';
    const body = {
        secret: '',
        response: token,
    }
    const params = new URLSearchParams();
    params.append('secret', '6Ldcm9QnAAAAAAAmQlXVhwQ_R_l3KdY5nCrYDmX5');
    params.append('response', token);

    const { data } = await axios.post(url, params,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );
    if (data.success != true) {
        return next(new NotAcceptableError());
    }

    appService.addEnrolledDriver(req.body).then(() => {
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/accountavailable", async (req, res, next) => {
    const { phone, email } = req.query;
    if (!phone && !email) {
        return next(new BadRequestError());
    }

    const available = userService.accountAvailable(phone, email).then(
        available => {
            const success = available ? 1 : 0;
            res.json({ success: success });
        }
    ).catch(next);
});

app.get("/userinfo", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    userService.userInfo({ uid }).then((response) => {
        res.json(response);
    }).catch(next);
});

app.get("/createaccount", async (req, res, next) => {
    let { fname, lname, phone, email, password, gender } = req.query;

    if (!fname || !lname || !phone || !email || !password || !gender || !helper.isValidEmail(email)) {
        return next(new BadRequestError());
    }

    userService.createUser(req.query).then(
        newUser => {
            res.json(newUser)
        }
    ).catch(next);
});

app.get("/login", async (req, res, next) => {
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


app.post('/uploadprofilepicture', authenticateToken, async (req, res, next) => {
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
})




app.post("/refreshToken", async (req, res, next) => {
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

app.get("/verify", async (req, res, next) => {
    const phone = req.query.phone;
    if (!phone) {
        return next(new BadRequestError());
    }

    userService.getOtp(phone).then(response => {
        return res.json({ success: 1 });
    }).catch(next);
});

app.patch("/verify", async (req, res, next) => {
    const { otp, phone } = req.body;

    if (!phone || !otp) {
        return next(new BadRequestError());
    }

    userService.verifyOtp(req.body).then(response => {
        if (response === true) {
            userService.verifyUser(phone).then(() => {
                res.json({ message: "Account successfully verified" });
            });
        } else {
            next(new UnauthorizedError("Invalid verification code. Please try again."));
        }
    }).catch(next);
});

app.patch("/verifysecurity", async (req, res, next) => {
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
            next(new UnauthorizedError("Invalid verification code. Please try again."));
        }
    }).catch(next);
});

app.patch("/changepassword", async (req, res, next) => {
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

app.post("/referral", authenticateToken, async (req, res, next) => {
    const { referralCode } = req.body;
    const uid = req.user.userId;

    if (!referralCode) {
        next(new BadRequestError());
    }

    userService.addReferral(uid, req.body).then((ref) => {
        res.json(ref);
    }).catch(next);
});

app.get("/nearbyrides", authenticateToken, async (req, res, next) => {
    const maxDistance = 20000;
    let { startLng, startLat, endLng, endLat, date, gender } = req.query;
    if (!gender) {
        gender = 2;
    }
    if (!startLng || !startLat || !endLng || !endLat || !date) {
        return next(new BadRequestError());
    }

    rideService.getNearbyRides(req.user.userId, req.query).then(
        result => res.status(200).json(result)
    ).catch(next);
});

app.get("/ridedetails", authenticateToken, async (req, res, next) => {
    const { rideId } = req.query;
    if (!rideId) {
        return next(new BadRequestError());
    }

    rideService.getRideDetails(req.query).then(
        ride => {
            res.status(200).json(ride);
        }
    ).catch(next);
});

app.get("/bookride", authenticateToken, async (req, res, next) => {
    const { rideId, paymentMethod, seats, cardId, voucherId, pickupLocationLat, pickupLocationLng } = req.query;
    const uid = req.user.userId;

    if (!uid || !rideId || !paymentMethod) {
        return next(new BadRequestError());
    }

    if (paymentMethod === 'CARD' && !cardId) {
        return next(new BadRequestError());
    }

    rideService.bookRide({ uid, rideId, paymentMethod, seats, cardId, voucherId, pickupLocationLat, pickupLocationLng }).then(
        newPassenger => {
            return res.json({ id: newPassenger.id })
        }
    ).catch(next);
});

app.post("/postride", authenticateToken, async (req, res, next) => {
    // consider not getting all the data from the query and instead only taking the latitude figures? Could cost an extra API call
    // check that driver doesn't already have a ride scheduled within 1-2 (?) hours/duration of this ride
    // mainTextFrom/mainTextTo probably needs to be fetched from google api instead to prevent malicious use
    const { fromLatitude, fromLongitude, toLatitude,
        toLongitude, mainTextFrom,
        mainTextTo, pricePerSeat, pickupEnabled, pickupPrice,
        datetime, car, community, gender, seatsAvailable } = req.body;
    const driver = req.user.userId;

    if (!fromLatitude || !fromLongitude || !toLatitude || !toLongitude ||
        !mainTextFrom || !mainTextTo || !pricePerSeat || !driver || !car ||
        !datetime || !gender || !seatsAvailable
    ) {
        return next(new BadRequestError());
    }

    rideService.postRide({
        fromLatitude, fromLongitude, toLatitude,
        toLongitude, mainTextFrom, pickupPrice, pickupEnabled,
        mainTextTo, pricePerSeat,
        driver, datetime, car, community, gender, seatsAvailable
    }).then(ride => {
        res.json(ride);
    }).catch(next);
});

app.get("/upcomingrides", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;
    let limit = req.query.limit;

    if (limit) {
        req.query.limit = parseInt(limit);
    }

    if (!uid) {
        return next(new BadRequestError());
    }

    rideService.getUpcomingRides({ uid, ...req.query })
        .then(result => res.json(result))
        .catch(next);
});

app.get("/pastrides", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;
    let limit = req.query.limit;
    let after = req.query.after;

    if (limit) {
        req.query.limit = parseInt(limit);
    }

    rideService.getPastRides({ uid, ...req.query })
        .then(result => res.json(result))
        .catch(next);
});

app.get("/driverrides", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;
    let limit = req.query.limit;
    if (limit) {
        req.query.limit = parseInt(limit);
    }

    rideService.getDriverRides({ uid, ...req.query })
        .then(driverRides => res.json(driverRides))
        .catch(next);
});

app.get("/tripdetails", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;
    const uid = req.user.userId;

    rideService.getTripDetails({ uid, tripId })
        .then(tripResult => {
            res.json(tripResult);
        })
        .catch(next);
});

app.get("/cars", authenticateToken, async (req, res, next) => {
    const { approved } = req.query;
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    carService.getCars({ uid, ...req.query }).then(cars => {
        return res.json(cars);
    }).catch(next);
});

app.get("/cancelride", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;

    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.cancelRide({ tripId, ...req.query }).then(cancelStatus => {
        if (!cancelStatus) {
            return next(new NotAcceptableError("Ride was never cancelled"))
        }
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/cancelpassenger", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;

    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.cancelPassenger(req.query, req.user.userId).then(status => {
        res.json({ success: 1 });
    }).catch(next);
});

app.get("/startride", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;

    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.startRide({ tripId, ...req.query }).then(cancelStatus => {
        if (!cancelStatus) {
            return next(new NotAcceptableError("Could not start ride."))
        }
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/checkin", authenticateToken, async (req, res, next) => {
    const { tripId, passenger } = req.query;
    const uid = req.user.userId;

    if (!tripId || !passenger || !uid) {
        return next(new BadRequestError());
    }

    rideService.checkIn({ tripId, passenger, uid, ...req.query }).then(
        response => {
            return res.json({ success: 1 });
        }
    ).catch(next);
});

app.post("/checkout", authenticateToken, async (req, res, next) => {
    let { tripId, passenger, amountPaid, rating } = req.body;
    const uid = req.user.userId;

    if (!tripId || !passenger || !amountPaid || !uid) {
        return next(new BadRequestError());
    }

    rideService.checkOut({ tripId, passenger, amountPaid, rating, uid, ...req.query }).then(response => {
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/triptotals", authenticateToken, async(req, res, next) => {
    const { tripId } = req.query;
    if(!tripId) {
        return next(new BadRequestError());
    }

    rideService.getTripTotals(req.query).then(totals => {
        return res.json(totals);
    }).catch(next);
});

app.get("/noshow", authenticateToken, async (req, res, next) => {
    const { tripId, passenger } = req.query;
    const uid = req.user.userId;

    if (!tripId || !passenger || !uid) {
        return next(new BadRequestError());
    }

    rideService.noShow({ tripId, passenger, uid, ...req.query }).then(
        response => {
            return res.json({ success: 1 });
        }
    ).catch(next);
});

app.get("/passengerdetails", authenticateToken, async (req, res, next) => {
    const { tripId, passenger } = req.query;
    const uid = req.user.userId;

    if (!tripId || !passenger || !uid) {
        return next(new BadRequestError());
    }

    rideService.getPassengerDetails({ tripId, passenger, uid, ...req.query }).then(passengerDetails => {
        return res.json(passengerDetails);
    }).catch(next);
});

app.get("/wallet", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getWallet({ uid, ...req.query }).then(walletDetails => {
        return res.json(walletDetails);
    }).catch(next);
});

app.post("/newcar", authenticateToken, async (req, res, next) => {
    const { brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back } = req.body;
    const uid = req.user.userId;

    if (!uid || !brand || !year || !model || !color || !licensePlateLetters ||
        !licensePlateNumbers || !license_front || !license_back) {
        return next(new BadRequestError());
    }

    carService.newCar({ uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back }).then(newCar => {
        res.json({ success: 1 });
    }).catch(next);
});

app.post("/submitlicense", authenticateToken, async (req, res, next) => {
    const front = req.files[0];
    const back = req.files[1];
    // console.log(req);
    const uid = req.user.userId;

    if (!front || !back) {
        return next(new BadRequestError());
    }

    userService.submitLicense({ uid, frontSide: front, backSide: back }).then(license => {
        return res.json(license);
    }).catch(next);
});

app.get("/license", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getLicense({ uid, ...req.query }).then(license => {
        return res.json(license);
    }).catch(next);
});

app.get("/announcements", authenticateToken, async (req, res, next) => {
    const announcementId = req.query?.id;
    const active = req.query?.active;

    if (!announcementId && !active) {
        return next(new BadRequestError());
    }

    if (announcementId) {
        appService.getAnnouncement(announcementId).then(announcement => {
            return res.json(announcement);
        }).catch(next);
    } else {
        appService.getAnnouncements(active).then(announcements => {
            return res.json(announcements);
        }).catch(next);
    }
});

app.post("/createcommunity", authenticateToken, async (req, res, next) => {
    const { name, description, private, joinQuestion } = req.body;
    const file = req.files[0];
    const uid = req.user.userId;

    if (!file || !name || !description || !private || (private === 1 && !joinQuestion)) {
        return next(new BadRequestError());
    }


    communityService.createCommunity({ name, description, private, joinQuestion }, file, uid).then(community => {
        return res.json({ success: 1 });
    }).catch(next);
});


app.patch("/updatecommunity", authenticateToken, async (req, res, next) => {
    const { communityId, description, private, joinQuestion } = req.body;
    const file = req.files[0];
    const uid = req.user.userId;

    if (!communityId || !description || !private || (private === 1 && !joinQuestion)) {
        return next(new BadRequestError());
    }

    communityService.updateCommunity(req.body, file, uid).then(community => {
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/communities", authenticateToken, async (req, res, next) => {
    let { page } = req.query;
    if (!page) {
        req.query.page = 1;
    }

    const uid = req.user.userId;

    communityService.getCommunities({ uid, ...req.query }).then(communities => {
        res.json(communities);
    }).catch(next);
});

app.patch("/leavecommunity", authenticateToken, async (req, res, next) => {
    const { communityId } = req.body;

    if (!communityId) {
        return next(new BadRequestError());
    }

    const uid = req.user.userId;

    communityService.leaveCommunity(req.body, uid).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

app.get("/mycommunities", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    communityService.getUserCommunities({ uid, ...req.query }).then(communities => {
        return res.json(communities.Communities);
    }).catch(next);
});

app.get("/communitydetails", authenticateToken, async (req, res, next) => {
    const { communityId } = req.query;
    const uid = req.user.userId;

    if (!communityId || !uid) {
        return next(new BadRequestError());
    }

    communityService.getCommunityDetails({ communityId, uid, ...req.query }).then(community => {
        return res.json(community);
    }).catch(next);
});

app.get("/communitymembers", authenticateToken, async (req, res, next) => {
    const { communityId } = req.query;

    if (!communityId) {
        return next(new BadRequestError());
    }

    communityService.getCommunityMembers(req.query, req.user.userId).then(members => res.json(members)).catch(next);
});

app.patch("/acceptmember", authenticateToken, async (req, res, next) => {
    const { memberId } = req.body;
    if (!memberId) {
        return next(new BadRequestError());
    }

    communityService.acceptCommunityMember(req.body, req.user.userId).then(() => res.json({ success: 1 })).catch(next);
});

app.patch("/rejectmember", authenticateToken, async (req, res, next) => {
    const { memberId } = req.body;
    if (!memberId) {
        return next(new BadRequestError());
    }

    communityService.rejectCommunityMember(req.body, req.user.userId).then(() => res.json({ success: 1 })).catch(next);
});

app.get("/myfeed", authenticateToken, async (req, res, next) => {
    let { page } = req.query;
    if (!page) { req.query.page = 1; }

    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    communityService.getUserFeed({ uid, ...req.query }).then(feed => {
        return res.json(feed);
    }).catch(err => {
        console.error(err);
        return next(err);
    });
});

app.get("/loadchat", authenticateToken, async (req, res, next) => {
    let { receiver } = req.query;
    const uid = req.user.userId;

    chatService.loadChat({ receiver, uid, ...req.query }).then(user => {
        return res.json(user);
    }).catch(err => {
        if (err === 404) {
            return next(err);
        } else {
            console.error(err);
            return next(err);
        }
    });
});

app.get("/chats", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    chatService.getChats({ uid, ...req.query }).then(chats => {
        return res.json(chats);
    }).catch(next);
});

app.get("/chathistory", authenticateToken, async (req, res, next) => {
    let { receiver, page } = req.query; // last = last received message id

    if (!page) {
        req.query.page = 1;
    }

    const uid = req.user.userId;

    if (!uid || !receiver) {
        return next(new BadRequestError());
    }

    chatService.getChatHistory({ uid, receiver, ...req.query }).then(chatHistory => {
        return res.json(chatHistory);
    }).catch(next);
});

app.get("/newmessages", authenticateToken, async (req, res, next) => {
    const { receiver } = req.query;
    const uid = req.user.userId;

    if (!uid || !receiver) {
        return next(new BadRequestError());
    }

    chatService.getNewMessages({ uid, receiver, ...req.query }).then(newMessages => {
        return res.json(newMessages);
    }).catch(next);
});


app.get("/sendmessage", authenticateToken, async (req, res, next) => {
    const { receiver, message } = req.query;
    const uid = req.user.userId;

    if (!uid || !receiver || !message) {
        return next(new BadRequestError());
    }

    chatService.sendMessage({ uid, receiver, message, ...req.query }).then(sendMessageResult => {
        return res.json({ id: sendMessageResult.id });
    }).catch(next);
});

app.get("/cschathistory", authenticateToken, async (req, res, next) => {
    let { page } = req.query;

    if (!page) {
        page = 1;
    }

    const uid = req.user.userId;

    chatService.getCSChatHistory({ uid, page }).then(chatHistory => {
        res.json(chatHistory);
    }).catch(next);
});

app.get("/newcsmessages", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    chatService.getNewCSMessages({ uid }).then(newMessages => {
        res.json(newMessages);
    }).catch(next);
});

app.get("/sendcsmessage", authenticateToken, async (req, res, next) => {
    const { message } = req.query;
    const uid = req.user.userId;

    chatService.sendCSMessage({ uid, message }).then(newMessage => {
        res.json(newMessage);
    }).catch(next);
});


app.post("/bankaccount", authenticateToken, async (req, res, next) => {
    const { fullName, bankName, accNumber, swiftCode } = req.body;
    const uid = req.user.userId;

    if (!uid || !fullName || !bankName || !accNumber || !swiftCode) {
        return next(new BadRequestError());
    }

    userService.addBank({ uid, fullName, bankName, accNumber, swiftCode, ...req.body }).then(addBankResult => {
        return res.json(addBankResult);
    }).catch(next);
});


app.get("/banks", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getBanks({ uid, ...req.query }).then(banks => {
        return res.json(banks);
    }).catch(next);
});

app.post("/withdrawalrequest", authenticateToken, async (req, res, next) => {
    const { paymentMethodType, paymentMethodId } = req.body;

    if (!paymentMethodId || !paymentMethodType) {
        return next(new BadRequestError());
    }

    const uid = req.user.userId;

    userService.submitWithdrawalRequest(req.body, uid).then(withdrawal => {
        res.json(withdrawal)
    }).catch(next);
});

app.post("/mobilewallet", authenticateToken, async (req, res, next) => {
    const { phone } = req.body;
    const uid = req.user.userId;

    if (!uid || !phone) {
        return next(new BadRequestError());
    }

    userService.addMobileWallet({ uid, phone, ...req.body }).then(addWalletResult => {
        return res.json(addWalletResult);
    }).catch(next);
});

app.get("/mobilewallets", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getMobileWallets({ uid, ...req.query }).then(wallets => {
        return res.json(wallets);
    }).catch(next);
});

app.post("/card", authenticateToken, async (req, res, next) => {
    const { cardNumber, cardExpiry, cardholderName } = req.body;
    const uid = req.user.userId;

    if (!uid || !cardNumber || !cardExpiry || !cardholderName) {
        return next(new BadRequestError());
    }

    userService.addNewCard({ uid, cardNumber, cardExpiry, cardholderName, ...req.body }).then(addCardResult => {
        return res.json(addCardResult);
    }).catch(next);
});

app.patch("/name", authenticateToken, async (req, res, next) => {
    const { firstName, lastName } = req.body;
    const uid = req.user.userId;

    if (!uid || !firstName || !lastName || firstName.length < 2 || firstName.length > 20 || lastName.length < 2 || lastName.length > 20) {
        return next(new BadRequestError());
    }

    userService.updateName({ uid, firstName, lastName, ...req.body }).then(updateNameResult => {
        return res.json(updateNameResult);
    }).catch(next);
});


app.patch("/phone", authenticateToken, async (req, res, next) => {
    const { phone } = req.body;
    const uid = req.user.userId;

    if (!uid || !phone) {
        return next(new BadRequestError());
    }

    userService.updatePhone({ uid, phone, ...req.body }).then(updatePhoneResult => {
        return res.json(updatePhoneResult);
    }).catch(next);
});


app.patch("/email", authenticateToken, async (req, res, next) => {
    const { email } = req.body;
    const uid = req.user.userId;

    if (!uid || !email) {
        return next(new BadRequestError());
    }

    userService.updateEmail({ uid, email, ...req.body }).then(updateEmailResult => {
        return res.json(updateEmailResult);
    }).catch(next);
});

app.get("/searchcommunities", authenticateToken, async (req, res, next) => {
    const { name, page } = req.query;

    if (!name) {
        return next(new BadRequestError());
    }
    if (!page) {
        req.query.page = 1;
    }

    communityService.searchCommunities({ name, ...req.query }).then(searchResult => {
        return res.json(searchResult);
    }).catch(next);
});

app.post("/joincommunity", authenticateToken, async (req, res, next) => {
    const { communityId, answer } = req.body;
    const uid = req.user.userId;

    if (!uid || !communityId) {
        return next(new BadRequestError());
    }

    communityService.joinCommunity({ uid, communityId, answer, ...req.body }).then(joinResult => {
        return res.json(joinResult);
    }).catch(next);
});

app.get("/getPredictions", authenticateToken, async (req, res, next) => {
    const { text } = req.query;

    if (!text) {
        return next(new BadRequestError());
    }

    getPredictions(text).then(result => {
        return res.json(result);
    }).catch(next);
});

app.get("/geocode", authenticateToken, async (req, res, next) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        return next(new BadRequestError());
    }

    geocode(latitude, longitude).then(result => {
        return res.json(result);
    }).catch(next);
});

app.get("/getLocationFromPlaceId", authenticateToken, async (req, res, next) => {
    const { place_id } = req.query;

    if (!place_id) {
        return next(new BadRequestError());
    }

    getLocationFromPlaceId(place_id).then(result => {
        return res.json(result);
    }).catch(next);
});

app.get("/verifyvoucher", authenticateToken, async (req, res, next) => {
    const { code } = req.query;

    if (!code) {
        throw new BadRequestError("Voucher code is required");
    }

    const uid = req.user.userId;

    rideService.verifyVoucher(req.query, uid).then(voucher => {
        res.json(voucher);
    }).catch(next);
});

app.post("/staff/login", async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return next(new BadRequestError());
    }

    staffLogin(req.body).then(response => {
        req.session.profile = { loggedIn: true };
        res.send("{}");
    }).catch(next);
});

app.get("/staff/session", sessionChecker, async (req, res, next) => {
    res.json({ success: 1 });
});

app.get("/staff/searchuser", sessionChecker, async (req, res, next) => {
    const { phone } = req.query;

    if (!phone) {
        return next(new BadRequestError());
    }

    findUser(req.query).then(user => {
        res.json(user);
    }).catch(next);
});

app.get("/staff/userrides", sessionChecker, async (req, res, next) => {
    let { uid, page } = req.query;

    if (!uid) {
        return next(new BadRequestError());
    }

    if (!page) {
        page = 1;
    }

    const limit = 8;
    const offset = (page - 1) * limit;
    const after = null;
    rideService.getPastRides({ uid, limit, after, offset }).then(rides => {
        res.json(rides);
    }).catch(next);
});

app.post("/staff/updateuser", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    updateUser(req.body).then(newUser => res.json(newUser)).catch(next);
});

app.get("/staff/userlicenses", sessionChecker, async (req, res, next) => {
    if (!req.query.uid) {
        return next(new BadRequestError());
    }

    customerLicenses(req.query).then(licenses => {
        res.json(licenses);
    }).catch(next);
});

app.post("/staff/updatelicense", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    updateLicense(req.body).then(license => {
        res.json(license);
    }).catch(next);
});

app.get("/staff/pendinglicenses", sessionChecker, async (req, res, next) => {
    getPendingLicenses().then(licenses => {
        res.json(licenses);
    }).catch(next);
});

app.post("/staff/updatecar", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    updateCar(req.body).then(car => {
        res.json(car);
    }).catch(next);
});

app.get("/staff/pendingcars", sessionChecker, async (req, res, next) => {
    getPendingCars().then(cars => {
        res.json(cars);
    }).catch(next);
});

app.get("/staff/members", sessionChecker, async (req, res, next) => {
    getMembers().then(members =>
        res.json(members)
    ).catch(next);
});

app.post("/staff/createuser", sessionChecker, async (req, res, next) => {
    const { username, password, phone, role } = req.body;
    if (!username || !password || !phone || !role) {
        return next(new BadRequestError());
    }

    createStaffMember(req.body).then(() => {
        res.json({ success: true });
    }).catch((err) => {
        console.error(err);
    });
});

app.get("/staff/memberdetails", sessionChecker, async (req, res, next) => {
    const { id } = req.query;
    if (!id) {
        next(new BadRequestError());
    }

    getStaffMember(req.query).then(member => {
        res.json(member);
    }).catch(next);
});

app.post("/staff/editmember", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    console.log(req.body);

    editStaffMember(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

app.get("/staff/announcements", sessionChecker, async (req, res, next) => {
    getAllAnnouncements().then(ann => {
        res.json(ann);
    }).catch(next);
});

app.post("/staff/updateannouncement", sessionChecker, async (req, res, next) => {
    const { id } = req.body;
    if (!id) {
        return next(new BadRequestError());
    }
    console.log(req.body);
    updateAnnouncement(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

app.post("/staff/createannouncement", sessionChecker, async (req, res, next) => {
    const { title_en, title_ar, text_en, text_ar, from, to, active } = req.body;

    if (!title_en || !title_ar || !text_en || !text_ar || !from || !to || !active) {
        next(new BadRequestError());
    }

    createAnnouncement(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

app.get("/staff/ride", sessionChecker, async (req, res, next) => {
    if (!req.query.id) {
        return next(new BadRequestError());
    }

    getFullRide(req.query).then(ride => {
        res.json(ride);
    }).catch(next);
});

app.post("/staff/cancelride", sessionChecker, async (req, res, next) => {
    const { id } = req.body;
    if (!id) {
        return next(new BadRequestError());
    }

    cancelRide(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});


app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        error: {
            message: err.message,
        },
    });
});

app.listen(config.app.port, () => {
    console.log(`API listening at http://localhost:${config.app.port}`);
});