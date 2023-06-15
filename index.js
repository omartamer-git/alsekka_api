const express = require("express");
// ADD CORS

const mysql = require("mysql2");
const bcrypt = require("bcrypt");

const config = require("./config");
const pool = require("./mysql-pool");
const helper = require("./helper");
const errors = require("./errors");

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


app.get("/accountavailable", async (req, res) => {
    const { phone, email } = req.query;
    if (!phone || !email) {
        return res.status(400).json({ error: "Phone or email parameters are required." });
    }

    const available = userService.accountAvailable(phone, email).then(
        available => {
            const success = available ? 1 : 0;
            res.json({ success: success });
        }
    ).catch(
        err => {
            console.error(err);
        }
    );
});

app.get("/createaccount", async (req, res) => {
    let { fname, lname, phone, email, password, gender } = req.query;
    if (!fname || !lname || !phone || !email || !password || !gender) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }
    if (!helper.isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid Email" });
    }

    userService.createUser(req.query).then(
        newUser => {
            res.status(201).json({ success: 1, id: newUser.id })
        }
    ).catch(
        err => {
            res.status(500).json({ error: err });
        }
    );
});

app.get("/login", async (req, res) => {
    const { phone, email, password } = req.query;
    console.log(req.query);
    console.log("HOLALA");
    if ((!phone && !email) || !password) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.loginUser(req.query).then(
        userAccount => {
            return res.status(201).json({ success: 1, id: userAccount.id });
        }
    ).catch(
        err => {
            res.status(err).json({ error: 1 });
        }
    );
});

app.get("/nearbyrides", async (req, res) => {
    const maxDistance = 20000;
    let { startLng, startLat, endLng, endLat, date, gender } = req.query;
    if (!gender) {
        gender = 2;
    }
    if (!startLng || !startLat || !endLng || !endLat || !date) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.getNearbyRides(req.query).then(
        result => res.status(200).json(result)
    ).catch(err => {
        console.error(err);
        res.status(500).json({ error: 1 })
    });
    /*
    // let values = [startLat, startLng, startLat, endLat, endLng, endLat, date, gender];
    // let rideQuery = `SELECT *, 
    //     ( 6371 * acos( cos( radians(?) ) * cos( radians( fromLatitude ) ) * cos( radians( fromLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( fromLatitude ) ) ) ) AS distanceStart,
    //     ( 6371 * acos( cos( radians(?) ) * cos( radians( toLatitude ) ) * cos( radians( toLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( toLatitude ) ) ) ) AS distanceEnd 
    //     FROM rides HAVING distanceStart <= 50 AND distanceEnd <= 50 AND datetime >= ? AND gender=? ORDER BY datetime, distanceStart, distanceEnd`;

    // const rideResult = await pool.query(rideQuery, values);
    // let result = [];
    // for (const ride of rideResult[0]) {
    //     const seatsQuery = `SELECT COUNT(*) as count FROM passengers WHERE ride=?`;
    //     const seatsResult = await pool.query(seatsQuery, [ride.id]);
    //     const countSeatsOccupied = seatsResult[0][0].count;
    //     result.push({
    //         "id": ride.id,
    //         "mainTextFrom": ride.mainTextFrom,
    //         "mainTextTo": ride.mainTextTo,
    //         "pricePerSeat": ride.pricePerSeat,
    //         "datetime": ride.datetime,
    //         "seatsOccupied": countSeatsOccupied,
    //     });
    // }
    // res.json(result); */
});

app.get("/ridedetails", async (req, res) => {
    const { rideId } = req.query;
    if (!rideId) {
        return res.status(400).json({ error: "Some required fields are mising" });
    }

    rideService.getRideDetails(req.query).then(
        (ride) => {
            res.status(200).json(ride);
        }
    ).catch(
        err => {
            res.status(err).json({ error: "Ride not found" });
        }
    );
});

app.get("/bookride", async (req, res) => {
    const { uid, rideId, paymentMethod } = req.query;
    if (!uid || !rideId || !paymentMethod) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.bookRide(req.query).then(
        newPassenger => {
            return res.json({ id: newPassenger.id })
        }
    ).catch(err => {
        return res.status(500).json({ error: "Unexpected server error occured" })
    });
});

app.post("/postride", async (req, res) => {
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
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.postRide(req.body).then(ride => {
        res.json(ride);
    }).catch(err => {
        res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.get("/userinfo", async (req, res) => {
    console.log("/userinfo");
    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }
    console.log("uid: " + uid);

    userService.userInfo(req.query).then(user => {
        res.json(user);
    }).catch(err => {
        console.error(err);
        res.status(500).json({ error: "Unexpected server error occured" })
    });
});

app.get("/upcomingrides", async (req, res) => {
    const uid = req.query.uid;
    let limit = req.query.limit;

    if (limit) {
        req.query.limit = parseInt(limit);
    }

    if (!uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    let result = await rideService.getUpcomingRides(req.query);

    res.json(result);
});

app.get("/pastrides", async (req, res) => {
    const uid = req.query.uid;
    let limit = req.query.limit;
    let after = req.query.after;

    if (limit) {
        req.query.limit = parseInt(limit);
    }

    const result = await rideService.getPastRides(req.query);

    res.json(result);
});

app.get("/driverrides", async (req, res) => {
    const uid = req.query.uid;
    let limit = req.query.limit;
    if (limit) {
        req.query.limit = parseInt(limit);
    }

    const driverRides = await rideService.getDriverRides(req.query);
    res.json(driverRides);
});

app.get("/tripdetails", async (req, res) => {
    const { uid, tripId } = req.query;
    rideService.getTripDetails(req.query).then(tripResult => {
        res.json(tripResult);
    }).catch(err => {
        if (err === 404) {
            return res.status(404).json({ error: "Trip not found" });
        }
        if (err === 401) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        console.error(err);
        res.status(500).json({ error: "Unexpected error occured" });

    });
});

app.get("/cars", async (req, res) => {
    const { uid, approved } = req.query;
    if (!uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    carService.getCars(req.query).then(cars => {
        return res.json(cars);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});

app.get("/cancelride", async (req, res) => {
    const { tripId } = req.query;

    if (!tripId) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.cancelRide(req.query).then(cancelStatus => {
        if (!cancelStatus) {
            return res.status(406).json({ error: "Could not cancel ride" });
        }
        return res.json({ success: 1 });
    }).catch(err => {
        if (err === 404) {
            return res.status(500).json({ error: "Not found" });
        } else {
            return res.status(500).json({ error: "Unexpected server error occured" });
        }
    });
});

app.get("/startride", async (req, res) => {
    const { tripId } = req.query;

    if (!tripId) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.startRide(req.query).then(cancelStatus => {
        if (!cancelStatus) {
            return res.status(406).json({ error: "Could not start ride" });
        }
        return res.json({ success: 1 });
    }).catch(err => {
        if (err === 404) {
            return res.status(500).json({ error: "Not found" });
        } else if (err === 401) {
            return res.status(401).json({ error: "Ride is not ready yet" })
        } else {
            return res.status(500).json({ error: "Unexpected server error occured" });
        }
    });
});

app.get("/checkin", async (req, res) => {
    const { tripId, passenger } = req.query;
    if (!tripId || !passenger) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.checkIn(req.query).then(
        response => {
            return res.json({ success: 1 });
        }
    ).catch(
        err => {
            if (err === 404) {
                return res.status(404).json({ error: "Ride not found" });
            } else {
                console.error(err);
                return res.status(500).json({ error: "Unexpected server error occured" });
            }
        }
    );
});

app.get("/checkout", async (req, res) => {
    let { tripId, passenger, amountPaid, rating } = req.query;

    if (!tripId || !passenger || !amountPaid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.checkOut(req.query).then(response => {
        return res.json({ success: 1 });
    }).catch(err => {
        if (err === 404) {
            return res.status(404).json({ error: "Ride not found" });
        } else {
            console.log(err);
            return res.status(500).json({ error: "Unexpected server error occured" });
        }
    });

});

app.get("/noshow", async (req, res) => {
    const { tripId, passenger } = req.query;
    if (!tripId || !passenger) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    rideService.noShow(req.query).then(
        response => {
            return res.json({ success: 1 });
        }
    ).catch(
        err => {
            if (err === 404) {
                return res.status(404).json({ error: "Ride not found" });
            } else {
                return res.status(500).json({ error: "Unexpected server error occured" });
            }
        }
    );
});

app.get("/passengerdetails", async (req, res) => {
    const { tripId, passenger } = req.query;
    rideService.getPassengerDetails(req.query).then(passengerDetails => {
        return res.json(passengerDetails);
    }).catch(err => {
        if (err === 404) {
            return res.status(404).json({ error: "Ride not found" });
        } else {
            return res.status(500).json({ error: "Unexpected server error occured" });
        }
    });
});

app.get("/wallet", async (req, res) => {
    const { uid } = req.query;
    userService.getWallet(req.query).then(walletDetails => {
        return res.json(walletDetails);
    }).catch(err => {
        console.error(err);
        if (err === 404) {
            return res.status(404).json({ error: "User not found" });
        } else {
            return res.status(500).json({ error: "Unexpected server error occured" });
        }
    });
});

app.post("/newcar", async (req, res) => {
    const { uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back } = req.body;

    if (!uid || !brand || !year || !model || !color || !licensePlateLetters ||
        !licensePlateNumbers || !license_front || !license_back) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }
    
    carService.newCar(req.body).then(newCar => {
        res.json({ success: 1 });
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.post("/submitlicense", async (req, res) => {
    const { uid, frontSide, backSide } = req.body;

    userService.submitLicense(req.body).then(license => {
        return res.json({ success: 1 });
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.get("/license", async (req, res) => {
    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.getLicense(req.query).then(license => {
        return res.json(license);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.get("/announcements", async (req, res) => {
    const announcementId = req.query?.id;
    const active = req.query?.active;

    if (announcementId) {
        appService.getAnnouncement(announcementId).then(announcement => {
            return res.json(announcement);
        }).catch(err => {
            if (err === 404) {
                return res.status(404).json({ error: "Not found" });
            } else {
                return res.status(500).json({ error: "Unexpected server error occured" });
            }
        });
    } else {
        appService.getAnnouncements(active).then(announcements => {
            return res.json(announcements);
        }).catch(err => {
            console.error(err);
            return res.status(500).json({ error: "Unexpected server error occured" });
        });
    }
});

app.post("/createcommunity", async (req, res) => {
    const { name, picture, description, private, uid } = req.body;
    communityService.createCommunity(req.body).then(community => {
        return res.json({ success: 1 });
    }).catch(err => {
        return res.status(500).json({ error: "Unexpected server error occured" });
    });

});

app.get("/communities", async (req, res) => {
    // find some way to order recommended communities (maybe fastest growing communities)
    let { page } = req.query;
    if (!page) { req.query.page = 1; }

    communityService.getCommunities(req.query).then(communities => {
        res.json(communities);
    }).catch(error => {
        return res.status(500).json({ error: "Unexpected server error occured" });
    });

});

app.get("/mycommunities", async (req, res) => {
    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    communityService.getUserCommunities(req.query).then(communities => {
        return res.json(communities.Communities);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.get("/communitydetails", async(req, res) => {
    const { communityId, uid } = req.query;
    if (!communityId || !uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    communityService.getCommunityDetails(req.query).then(community => {
        return res.json(community);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.get("/myfeed", async (req, res) => {
    let { uid, page } = req.query;
    if (!page) { req.query.page = 1; }
    if (!uid) {
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    communityService.getUserFeed(req.query).then(feed => {
        return res.json(feed);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    })
});

app.get("/loadchat", async (req, res) => {
    let { receiver } = req.query;
    chatService.loadChat(req.query).then(user => {
        return res.json(user);
    }).catch(err => {
        if (err === 404) {
            return res.status(500).json({ error: "Unexpected server error occured" });
        } else {
            console.error(err);
            return res.status(500).json({ error: "Unexpected server error occured" });
        }
    });
});

// CONTINUE HERE
app.get("/chats", async (req, res) => {
    let { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    chatService.getChats(req.query).then(chats => {
        return res.json(chats);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.get("/chathistory", async (req, res) => {
    let { uid, receiver, page } = req.query; // last = last received message id

    if (!page) { req.query.page = 1 }
    if (!uid || !receiver) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    chatService.getChatHistory(req.query).then(chatHistory => {
        return res.json(chatHistory);
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});

app.get("/newmessages", async (req, res) => {
    console.log("new messages polled");
    let { uid, receiver } = req.query;

    if (!uid || !receiver) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    chatService.getNewMessages(req.query).then(newMessages => {
        return res.json(newMessages);
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});


app.get("/sendmessage", async (req, res) => {
    let { uid, receiver, message } = req.query;

    if (!uid || !receiver || !message) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }
    chatService.sendMessage(req.query).then(sendMessageResult => {
        return res.json({ id: sendMessageResult.id });
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});


app.post("/bankaccount", async (req, res) => {
    let { uid, fullName, bankName, accNumber, swiftCode } = req.body;

    if (!uid || !fullName || !bankName || !accNumber || !swiftCode) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.addBank(req.body).then(addBankResult => {
        return res.json({ id: addBankResult.id });
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});

app.post("/card", async(req, res) => {
    let { uid, cardNumber, cardExpiry, cardholderName } = req.body;
    if (!uid || !cardNumber || !cardExpiry || !cardholderName) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.addNewCard(req.body).then(addCardResult => {
        return res.json({ id: addCardResult.id });
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.get("/banks", async (req, res) => {
    let { uid } = req.query;

    if (!uid) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.getBanks(req.query).then(banks => {
        return res.json(banks);
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});

app.patch("/name", async (req, res) => {
    let { uid, firstName, lastName } = req.body;

    if (!uid || !firstName || !lastName) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.updateName(req.body).then(updateNameResult => {
        return res.json({ success: 1 });
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});


app.patch("/phone", async (req, res) => {
    let { uid, phone } = req.body;

    if (!uid || !phone) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.updatePhone(req.body).then(updatePhoneResult => {
        return res.json({ success: 1 });
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});


app.patch("/email", async (req, res) => {
    let { uid, email } = req.body;

    if (!uid || !email) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }

    userService.updateEmail(req.body).then(updateEmailResult => {
        return res.json({ success: 1 });
    }
    ).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    }
    );
});

app.get("/searchcommunities", async (req, res) => {
    let { name, page } = req.query;
    if(!name) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }
    if(!page) {
        req.query.page = 1;
    }
    communityService.searchCommunities(req.query).then(searchResult => {
        return res.json(searchResult);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});

app.post("/joincommunity", async (req, res) => {
    let { uid, communityId, answer } = req.body;
    if(!uid || !communityId) {
        return res.status(400).json({ error: "Some required fields are missing" });
    }
    communityService.joinCommunity(req.body).then(joinResult => {
        return res.json({ success: 1 });
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ error: "Unexpected server error occured" });
    });
});


app.listen(config.app.port, () => {
    console.log(`API listening at http://localhost:${config.app.port}`);
});