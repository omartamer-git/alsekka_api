const express = require("express");
// ADD CORS

const mysql = require("mysql2");
const bcrypt = require("bcrypt");

const config = require("./config");
const pool = require("./mysql-pool");
const helper = require("./helper");
const multer = require('multer')

const { BadRequestError, NotAcceptableError, UnauthorizedError } = require("./errors/Errors")
const app = express();

const multerMid = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
})

app.disable('x-powered-by')
app.use(multerMid.single('file'))
app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    })
);


const log4js = require("log4js");
const userService = require("./services/userService");
const rideService = require("./services/rideService");
const carService = require("./services/carService");
const appService = require("./services/appService");
const communityService = require("./services/communityService");
const chatService = require("./services/chatService");
const jwt = require('jsonwebtoken');
const authenticateToken = require("./middleware/authenticateToken");
const { JWT_SECRET, JWT_EXPIRATION } = require("./config/auth.config");
const { getPredictions, geocode, getLocationFromPlaceId } = require("./services/googleMapsService");

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


app.post('/uploads', async (req, res, next) => {
    try {
      const myFile = req.file
      const imageUrl = await helper.uploadImage(myFile)
      res
        .status(200)
        .json({
          message: "Upload was successful",
          data: imageUrl
        })
    } catch (error) {
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
    console.log(phone + " HELLO??");
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

    console.log(req.body);

    if (!token || !newPassword) {
        return next(new BadRequestError());
    }

    jwt.verify(token, JWT_SECRET, (err, data) => {
        console.log('here 1');
        if (err) {
            next(new UnauthorizedError());
        }
        console.log('here 2');
        console.log(data);

        userService.updatePassword(data.phone, newPassword).then(() => {
            console.log("pw updated");
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

    userService.addReferral(uid, req.body).then(() => {
        res.status(200).send();
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

    rideService.getNearbyRides(req.query).then(
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
    const { rideId, paymentMethod } = req.query;
    const uid = req.user.userId;

    if (!uid || !rideId || !paymentMethod) {
        return next(new BadRequestError());
    }

    rideService.bookRide({ uid, rideId, paymentMethod }).then(
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
        mainTextTo, pricePerSeat,
        driver, datetime, car } = req.body;
    const uid = req.user.userId;

    if (!fromLatitude || !fromLongitude || !toLatitude || !toLongitude ||
        !mainTextFrom || !mainTextTo || !pricePerSeat || !driver || !car ||
        !datetime || !uid
    ) {
        return next(new BadRequestError());
    }

    rideService.postRide({
        fromLatitude, fromLongitude, toLatitude,
        toLongitude, mainTextFrom,
        mainTextTo, pricePerSeat,
        driver, datetime, car, uid
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

app.get("/checkout", authenticateToken, async (req, res, next) => {
    let { tripId, passenger, amountPaid, rating } = req.query;
    const uid = req.user.userId;

    if (!tripId || !passenger || !amountPaid || !uid) {
        return next(new BadRequestError());
    }

    rideService.checkOut({ tripId, passenger, amountPaid, rating, uid, ...req.query }).then(response => {
        return res.json({ success: 1 });
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
    const { frontSide, backSide } = req.body;
    const uid = req.user.userId;

    if (!uid || !frontSide || !backSide) {
        return next(new BadRequestError());
    }

    userService.submitLicense({ uid, frontSide, backSide }).then(license => {
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
    const { name, picture, description, private } = req.body;
    const uid = req.user.userId;

    if (!name || !uid) {
        return next(new BadRequestError());
    }

    communityService.createCommunity({ name, picture, description, private, uid }).then(community => {
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
    console.log("new messages polled");
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