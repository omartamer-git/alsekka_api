const express = require("express");
// ADD CORS

const mysql = require("mysql2");
const bcrypt = require("bcrypt");

const config = require("./config");
const pool = require("./mysql-pool");
const helper = require("./helper");
const { BadRequestError, NotAcceptableError } = require("./errors/Errors")
const app = express();

/*
Handle SQL errors
Add user authentication 
Check all logical error possibilities for each endpoint
*/

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

app.get("/createaccount", async (req, res, next) => {
    let { fname, lname, phone, email, password, gender } = req.query;

    if (!fname || !lname || !phone || !email || !password || !gender || !helper.isValidEmail(email)) {
        return next(new BadRequestError());
    }

    userService.createUser(req.query).then(
        newUser => {
            res.json({ success: 1, id: newUser.id })
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
            return res.status(201).json({ success: 1, id: userAccount.id });
        }
    ).catch(next);
});

app.get("/nearbyrides", async (req, res, next) => {
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
    ).catch(next)
});

app.get("/ridedetails", async (req, res, next) => {
    const { rideId } = req.query;
    if (!rideId) {
        return next(new BadRequestError());
    }


    rideService.getRideDetails(req.query).then(
        (ride) => {
            res.status(200).json(ride);
        }
    ).catch(next);
});

app.get("/bookride", async (req, res, next) => {
    const { uid, rideId, paymentMethod } = req.query;
    if (!uid || !rideId || !paymentMethod) {
        return next(new BadRequestError());
    }

    rideService.bookRide(req.query).then(
        newPassenger => {
            return res.json({ id: newPassenger.id })
        }
    ).catch(next);
});

app.post("/postride", async (req, res, next) => {
    // consider not getting all the data from the query and instead only taking the latitude figures? Could cost an extra API call
    // check that driver doesn't already have a ride scheduled within 1-2 (?) hours/duration of this ride
    // mainTextFrom/mainTextTo probably needs to be fetched from google api instead to prevent malicious use

    const { fromLatitude, fromLongitude, toLatitude,
        toLongitude, mainTextFrom,
        mainTextTo, pricePerSeat,
        driver, datetime, car } = req.body;
    if (!fromLatitude || !fromLongitude || !toLatitude || !toLongitude ||
        !mainTextFrom || !mainTextTo || !pricePerSeat || !driver || !car ||
        !datetime
    ) {
        return next(new BadRequestError());
    }

    rideService.postRide(req.body).then(ride => {
        res.json(ride);
    }).catch(next);
});

app.get("/userinfo", async (req, res, next) => {
    console.log("/userinfo");
    const { uid } = req.query;
    if (!uid) {
        return next(new BadRequestError());
    }
    console.log("uid: " + uid);

    userService.userInfo(req.query).then(user => {
        res.json(user);
    }).catch(next);
});

app.get("/upcomingrides", async (req, res, next) => {
    const uid = req.query.uid;
    let limit = req.query.limit;

    if (limit) {
        req.query.limit = parseInt(limit);
    }

    if (!uid) {
        return next(new BadRequestError());
    }

    rideService.getUpcomingRides(req.query)
    .then(result => res.json(result))
    .catch(next);
});

app.get("/pastrides", async (req, res, next) => {
    const uid = req.query.uid;
    let limit = req.query.limit;
    let after = req.query.after;

    if (limit) {
        req.query.limit = parseInt(limit);
    }

    rideService.getPastRides(req.query)
    .then(result => res.json(result))
    .catch(next);
});

app.get("/driverrides", async (req, res, next) => {
    const uid = req.query.uid;
    let limit = req.query.limit;
    if (limit) {
        req.query.limit = parseInt(limit);
    }

    rideService.getDriverRides(req.query)
    .then(driverRides => res.json(driverRides))
    .catch(next)
});

app.get("/tripdetails", async (req, res, next) => {
    const { uid, tripId } = req.query;
    rideService.getTripDetails(req.query).then(tripResult => {
        res.json(tripResult);
    }).catch(next)
});

app.get("/cars", async (req, res, next) => {
    const { uid, approved } = req.query;
    if (!uid) {
        return next(new BadRequestError());
    }

    carService.getCars(req.query).then(cars => {
        return res.json(cars);
    }).catch(next);
});

app.get("/cancelride", async (req, res, next) => {
    const { tripId } = req.query;

    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.cancelRide(req.query).then(cancelStatus => {
        if (!cancelStatus) {
            return next(new NotAcceptableError("Ride was never cancelled"))
        }
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/startride", async (req, res, next) => {
    const { tripId } = req.query;

    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.startRide(req.query).then(cancelStatus => {
        if (!cancelStatus) {
            return next(new NotAcceptableError("Could not start ride."))
        }
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/checkin", async (req, res, next) => {
    const { tripId, passenger } = req.query;
    if (!tripId || !passenger) {
        return next(new BadRequestError());
    }

    rideService.checkIn(req.query).then(
        response => {
            return res.json({ success: 1 });
        }
    ).catch(next);
});

app.get("/checkout", async (req, res, next) => {
    let { tripId, passenger, amountPaid, rating } = req.query;

    if (!tripId || !passenger || !amountPaid) {
        return next(new BadRequestError());
    }

    rideService.checkOut(req.query).then(response => {
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/noshow", async (req, res, next) => {
    const { tripId, passenger } = req.query;
    if (!tripId || !passenger) {
        return next(new BadRequestError());
    }

    rideService.noShow(req.query).then(
        response => {
            return res.json({ success: 1 });
        }
    ).catch(next);
});

app.get("/passengerdetails", async (req, res, next) => {
    const { tripId, passenger } = req.query;
    if (!tripId || !passenger) {
        return next(new BadRequestError());
    }

    rideService.getPassengerDetails(req.query).then(passengerDetails => {
        return res.json(passengerDetails);
    }).catch(next)
});

app.get("/wallet", async (req, res, next) => {
    const { uid } = req.query;
    if(!uid) {
        return next(new BadRequestError());
    }
    userService.getWallet(req.query).then(walletDetails => {
        return res.json(walletDetails);
    }).catch(next)
});

app.post("/newcar", async (req, res, next) => {
    const { uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back } = req.body;

    if (!uid || !brand || !year || !model || !color || !licensePlateLetters ||
        !licensePlateNumbers || !license_front || !license_back) {
        return next(new BadRequestError());
    }

    carService.newCar(req.body).then(newCar => {
        res.json({ success: 1 });
    }).catch(next);
});

app.post("/submitlicense", async (req, res, next) => {
    const { uid, frontSide, backSide } = req.body;

    if(!uid || !frontSide || !backSide) {
        return next(new BadRequestError());
    }

    userService.submitLicense(req.body).then(license => {
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/license", async (req, res, next) => {
    const { uid } = req.query;
    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getLicense(req.query).then(license => {
        return res.json(license);
    }).catch(next);
});

app.get("/announcements", async (req, res, next) => {
    const announcementId = req.query?.id;
    const active = req.query?.active;

    if(!announcementId && !active) {
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

app.post("/createcommunity", async (req, res, next) => {
    const { name, picture, description, private, uid } = req.body;
    if(!name || !uid) {
        return next(new BadRequestError());
    }

    communityService.createCommunity(req.body).then(community => {
        return res.json({ success: 1 });
    }).catch(next);

});

app.get("/communities", async (req, res, next) => {
    // find some way to order recommended communities (maybe fastest growing communities)
    let { page } = req.query;
    if (!page) { req.query.page = 1; }

    communityService.getCommunities(req.query).then(communities => {
        res.json(communities);
    }).catch(next);

});

app.get("/mycommunities", async (req, res, next) => {
    const { uid } = req.query;
    if (!uid) {
        return next(new BadRequestError());
    }

    communityService.getUserCommunities(req.query).then(communities => {
        return res.json(communities.Communities);
    }).catch(next);
});

app.get("/communitydetails", async (req, res, next) => {
    const { communityId, uid } = req.query;
    if (!communityId || !uid) {
        return next(new BadRequestError());
    }

    communityService.getCommunityDetails(req.query).then(community => {
        return res.json(community);
    }).catch(next);
});

app.get("/myfeed", async (req, res, next) => {
    let { uid, page } = req.query;
    if (!page) { req.query.page = 1; }
    if (!uid) {
        return next(new BadRequestError());
    }
    communityService.getUserFeed(req.query).then(feed => {
        return res.json(feed);
    }).catch(err => {
        console.error(err);
        return next(err);
    })
});

app.get("/loadchat", async (req, res, next) => {
    let { receiver } = req.query;
    chatService.loadChat(req.query).then(user => {
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

app.get("/chats", async (req, res, next) => {
    let { uid } = req.query;
    if (!uid) {
        return next(new BadRequestError());
    }

    chatService.getChats(req.query).then(chats => {
        return res.json(chats);
    }).catch(next);
});

app.get("/chathistory", async (req, res, next) => {
    let { uid, receiver, page } = req.query; // last = last received message id

    if (!page) { req.query.page = 1 }
    if (!uid || !receiver) {
        return next(new BadRequestError());
    }

    chatService.getChatHistory(req.query).then(chatHistory => {
        return res.json(chatHistory);
    }
    ).catch(next);
});

app.get("/newmessages", async (req, res, next) => {
    console.log("new messages polled");
    let { uid, receiver } = req.query;

    if (!uid || !receiver) {
        return next(new BadRequestError());
    }

    chatService.getNewMessages(req.query).then(newMessages => {
        return res.json(newMessages);
    }
    ).catch(next);
});


app.get("/sendmessage", async (req, res, next) => {
    let { uid, receiver, message } = req.query;

    if (!uid || !receiver || !message) {
        return next(new BadRequestError());
    }
    chatService.sendMessage(req.query).then(sendMessageResult => {
        return res.json({ id: sendMessageResult.id });
    }
    ).catch(next);
});


app.post("/bankaccount", async (req, res, next) => {
    let { uid, fullName, bankName, accNumber, swiftCode } = req.body;
    console.log(req.body);
    if (!uid || !fullName || !bankName || !accNumber || !swiftCode) {
        return next(new BadRequestError());
    }

    userService.addBank(req.body).then(addBankResult => {
        console.log({ id: addBankResult.id });
        return res.json({ id: addBankResult.id });
    }
    ).catch(next);
});

app.post("/card", async (req, res, next) => {
    let { uid, cardNumber, cardExpiry, cardholderName } = req.body;
    if (!uid || !cardNumber || !cardExpiry || !cardholderName) {
        return next(new BadRequestError());
    }

    userService.addNewCard(req.body).then(addCardResult => {
        return res.json({ id: addCardResult.id });
    }
    ).catch(next);
});

app.get("/banks", async (req, res, next) => {
    let { uid } = req.query;

    if (!uid) {
        return next(new BadRequestError());
    }

    userService.getBanks(req.query).then(banks => {
        return res.json(banks);
    }
    ).catch(next);
});

app.patch("/name", async (req, res, next) => {
    let { uid, firstName, lastName } = req.body;

    if (!uid || !firstName || !lastName || firstName.length < 2 || firstName.length > 20 || lastName.length < 2 || lastName.length > 20) {
        return next(new BadRequestError());
    }

    userService.updateName(req.body).then(updateNameResult => {
        return res.json({ success: 1 });
    }
    ).catch(next);
});


app.patch("/phone", async (req, res, next) => {
    let { uid, phone } = req.body;

    if (!uid || !phone) {
        return next(new BadRequestError());
    }

    userService.updatePhone(req.body).then(updatePhoneResult => {
        return res.json({ success: 1 });
    }
    ).catch(next);
});


app.patch("/email", async (req, res, next) => {
    let { uid, email } = req.body;

    if (!uid || !email) {
        return next(new BadRequestError());
    }

    userService.updateEmail(req.body).then(updateEmailResult => {
        return res.json({ success: 1 });
    }
    ).catch(next);
});

app.get("/searchcommunities", async (req, res, next) => {
    let { name, page } = req.query;
    if (!name) {
        return next(new BadRequestError());
    }
    if (!page) {
        req.query.page = 1;
    }
    communityService.searchCommunities(req.query).then(searchResult => {
        return res.json(searchResult);
    }).catch(next);
});

app.post("/joincommunity", async (req, res, next) => {
    let { uid, communityId, answer } = req.body;
    if (!uid || !communityId) {
        return next(new BadRequestError());
    }
    communityService.joinCommunity(req.body).then(joinResult => {
        return res.json({ success: 1 });
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