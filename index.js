const express = require("express");
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
*/

app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    })
);



app.get("/accountavailable", async (req, res) => {
    const { phone, email } = req.query;
    if (phone) {
        const phoneQuery = 'SELECT COUNT(*) as count FROM users WHERE phone = ?';
        const phoneResult = await pool.query(phoneQuery, [phone]);

        if (phoneResult[0][0].count == 0) {
            res.json({ success: '1' });
        } else {
            res.json({ success: '0' });
        }
    } else if (email) {
        const emailQuery = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
        const emailResult = await pool.query(emailQuery, [email]);
        if (emailResult[0][0].count == 0) {
            res.json({ success: '1' });
        } else {
            res.json({ success: '0' });
        }
    } else {
        res.status(400).json(errors.missinginfo);
    }
});


app.get("/createaccount", async (req, res) => {
    let { fname, lname, phone, email, password, gender } = req.query;

    email = email.toLowerCase();
    if (phone && email && password) {
        if (helper.isValidEmail(email)) {
            try {
                const emailQuery = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
                const phoneQuery = 'SELECT COUNT(*) as count FROM users WHERE phone = ?';

                const emailResult = await pool.query(emailQuery, [email]);
                const phoneResult = await pool.query(phoneQuery, [phone]);
                if (emailResult[0][0].count > 0) {
                    res.status(400).json(errors.emailinuse);
                } else if (phoneResult[0][0].count > 0) {
                    res.status(400).json(errors.phoneinuse);
                } else {
                    bcrypt.hash(password, 10, async (err, hash) => {
                        if (err) {
                            res.status(500);
                        } else {
                            const [result] = await pool.query('INSERT INTO users (firstname, lastname, phone, email, password, gender) VALUES (?, ?, ?, ?, ?, ?)', [fname, lname, phone, email, hash, gender]);
                            res.json({ success: 1 });
                        }
                    });

                }

            } catch (err) {
                res.json(err);
            }
        } else {
            res.json(errors.invalidemail);
        }
    } else {
        res.status(400).json(errors.missinginfo);
    }
});

app.get("/login", async (req, res) => {
    const { phone, email, password } = req.query;
    if (phone) {
        const phoneQuery = 'SELECT id, password FROM users WHERE phone = ?';

        const phoneResult = await pool.query(phoneQuery, [phone]);

        if (phoneResult[0][0] === undefined) {
            res.json(errors.incorrectlogin);
        } else {
            const hashedPassword = phoneResult[0][0].password;
            const uid = phoneResult[0][0].id;


            bcrypt.compare(password, hashedPassword, (err, result) => {
                if (err) {
                    res.status(500);
                } else if (result) {
                    res.json({ success: 1, id: uid });
                } else {
                    res.json(errors.incorrectlogin);
                }
            });
        }

    } else if (email) {
        const emailQuery = 'SELECT id, password FROM users WHERE email = ?';

        const emailResult = await pool.query(emailQuery, [email]);
        if (emailResult[0][0] === undefined) {
            res.json(errors.incorrectlogin);
        } else {
            const hashedPassword = emailResult[0][0].password;
            const uid = emailResult[0][0].id;


            bcrypt.compare(password, hashedPassword, (err, result) => {
                if (err) {
                    res.status(500);
                } else if (result) {
                    res.json({ id: uid });
                } else {
                    res.json(errors.incorrectlogin);
                }
            });
        }
    } else {
        res.status(400).json(errors.missinginfo);
    }
});

app.get("/nearbyrides", async (req, res) => {
    const maxDistance = 20000;
    const { startLng, startLat, endLng, endLat, date } = req.query;
    if (startLng && startLat && endLng && endLat) {
        const rideQuery = `SELECT *, 
        ( 6371 * acos( cos( radians(?) ) * cos( radians( fromLatitude ) ) * cos( radians( fromLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( fromLatitude ) ) ) ) AS distanceStart,
        ( 6371 * acos( cos( radians(?) ) * cos( radians( toLatitude ) ) * cos( radians( toLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( toLatitude ) ) ) ) AS distanceEnd 
        FROM rides HAVING distanceStart <= 50 AND distanceEnd <= 50  AND datetime >= ? ORDER BY datetime, distanceStart, distanceEnd`;
        const rideResult = await pool.query(rideQuery, [startLat, startLng, startLat, endLat, endLng, endLat, date]);
        let result = [];
        for (const ride of rideResult[0]) {
            const seatsQuery = `SELECT COUNT(*) as count FROM passengers WHERE ride=?`;
            const seatsResult = await pool.query(seatsQuery, [ride.id]);
            const countSeatsOccupied = seatsResult[0][0].count;
            result.push({
                "id": ride.id,
                "mainTextFrom": ride.mainTextFrom,
                "mainTextTo": ride.mainTextTo,
                "pricePerSeat": ride.pricePerSeat,
                "datetime": ride.datetime,
                "seatsOccupied": countSeatsOccupied,
            });
        }
        res.json(result);

    } else {
        res.status(409);
    }
});

app.get("/ridedetails", async (req, res) => {
    const { rideId } = req.query;
    const rideQuery = "SELECT rides.id, fromLatitude, fromLongitude, toLatitude, toLongitude, mainTextFrom, mainTextTo, pricePerSeat, rides.datetime, users.firstName, users.lastName, users.rating, users.profilePicture FROM rides, users WHERE rides.id=? AND users.id=rides.driver";
    const rideResult = await pool.query(rideQuery, [rideId]);

    const seatsQuery = `SELECT COUNT(*) as count FROM passengers WHERE ride=?`;
    const seatsResult = await pool.query(seatsQuery, [rideId]);
    const countSeatsOccupied = seatsResult[0][0].count;

    rideResult[0][0].seatsOccupied = countSeatsOccupied;

    res.json(rideResult[0][0]);
});

app.get("/bookride", async (req, res) => {
    const { uid, rideId, paymentMethod } = req.query;
    const bookQuery = "INSERT INTO passengers (passenger, ride, paymentMethod) VALUES (?, ?, ?)";
    const bookResult = await pool.query(bookQuery, [uid, rideId, paymentMethod]);
    res.json(bookResult);
});

app.post("/postride", async (req, res) => {
    // consider not getting all the data from the query and instead only taking the latitude figures? Could cost an extra API call
    // check that driver doesn't already have a ride scheduled within 1-2 (?) hours/duration of this ride
    const { fromLatitude, fromLongitude, toLatitude,
        toLongitude, mainTextFrom,
        mainTextTo, pricePerSeat,
        driver, datetime, car } = req.body;
    const postQuery = "INSERT INTO rides (fromLatitude, fromLongitude, toLatitude, toLongitude, mainTextFrom, mainTextTo, pricePerSeat, driver, datetime, car) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const postResult = await pool.query(postQuery, [fromLatitude, fromLongitude, toLatitude, toLongitude, mainTextFrom, mainTextTo, pricePerSeat, driver, datetime, car]);
    res.json(postResult);
});

app.get("/userinfo", async (req, res) => {
    const { uid } = req.query;
    const userQuery = `SELECT firstName, lastName, phone, email, balance, rating, profilePicture, gender FROM users WHERE id=?`;
    let userResult = await pool.query(userQuery, [uid]);

    userResult[0][0].driver = 0;
    const licenseQuery = 'SELECT status FROM licenses WHERE driver=? AND expirydate > CURDATE()';
    const licenseResult = await pool.query(licenseQuery, [uid]);
    if (licenseResult[0].length === 1) {
        userResult[0][0].driver = licenseResult[0][0].status;
    }

    res.json(userResult[0][0]);
});

app.get("/upcomingrides", async (req, res) => {
    const uid = req.query.uid;
    const limit = req.query.limit;
    let after = req.query.after;

    const passengerQuery = "SELECT DISTINCT R.id, R.mainTextFrom, R.mainTextTo, R.pricePerSeat, R.datetime FROM passengers AS P, rides AS R WHERE (R.datetime >= CURRENT_TIMESTAMP AND R.status!=4 AND R.status != 2) AND ((P.passenger=? AND P.ride=R.id AND (P.status!=2 AND P.status!=4 AND P.status!=-1)) OR (R.driver=?))" + (after ? " AND R.datetime>? " : " ") + "ORDER BY R.status DESC, R.datetime ASC" + (limit ? ` LIMIT ?` : '');;
    let passengerResult = null;
    if (after) {
        after = new Date(parseInt(after)).toISOString();
        console.log(after);
    }

    if (after && limit) {
        passengerResult = await pool.query(passengerQuery, [uid, uid, after, parseInt(limit)]);
    } else if (after) {
        passengerResult = await pool.query(passengerQuery, [uid, uid, after]);
    } else if (limit) {
        passengerResult = await pool.query(passengerQuery, [uid, uid, parseInt(limit)]);
    } else {
        passengerResult = await pool.query(passengerQuery, [uid, uid]);
    }

    let result = [];
    for (const ridePassenger of passengerResult[0]) {
        const seatsQuery = `SELECT COUNT(*) as count FROM passengers WHERE ride=?`;
        const seatsResult = await pool.query(seatsQuery, [ridePassenger.id]);
        const countSeatsOccupied = seatsResult[0][0].count;

        result.push({
            "id": ridePassenger.id,
            "mainTextFrom": ridePassenger.mainTextFrom,
            "mainTextTo": ridePassenger.mainTextTo,
            "pricePerSeat": ridePassenger.pricePerSeat,
            "datetime": ridePassenger.datetime,
            "seatsOccupied": countSeatsOccupied,
        });
    }

    res.json(result);
});

app.get("/pastrides", async (req, res) => {
    const uid = req.query.uid;
    const limit = req.query.limit;
    let after = req.query.after;

    const passengerQuery = "SELECT DISTINCT R.id, R.mainTextFrom, R.mainTextTo, R.pricePerSeat, R.datetime FROM passengers AS P, rides AS R WHERE ((P.passenger=? AND P.ride=R.id) OR (R.driver=?))" + (after ? " AND R.datetime<? " : " ") + "ORDER BY R.datetime DESC" + (limit ? ` LIMIT ?` : '');;
    let passengerResult = null;
    if (after) {
        after = new Date(parseInt(after)).toISOString();
        console.log(after);
    }

    if (after && limit) {
        passengerResult = await pool.query(passengerQuery, [uid, uid, after, parseInt(limit)]);
    } else if (after) {
        passengerResult = await pool.query(passengerQuery, [uid, uid, after]);
    } else if (limit) {
        passengerResult = await pool.query(passengerQuery, [uid, uid, parseInt(limit)]);
    } else {
        passengerResult = await pool.query(passengerQuery, [uid, uid]);
    }

    let result = [];


    for (const ridePassenger of passengerResult[0]) {
        const seatsQuery = `SELECT COUNT(*) as count FROM passengers WHERE ride=?`;
        const seatsResult = await pool.query(seatsQuery, [ridePassenger.id]);
        const countSeatsOccupied = seatsResult[0][0].count;

        result.push({
            "id": ridePassenger.id,
            "mainTextFrom": ridePassenger.mainTextFrom,
            "mainTextTo": ridePassenger.mainTextTo,
            "pricePerSeat": ridePassenger.pricePerSeat,
            "datetime": ridePassenger.datetime,
            "seatsOccupied": countSeatsOccupied,
        });
    }

    res.json(result);
});

app.get("/driverrides", async (req, res) => {
    const uid = req.query.uid;
    const limit = req.query.limit;
    const isDriverQuery = "SELECT COUNT(*) as count FROM licenses WHERE status=1 AND driver=?";
    const isDriverResult = await pool.query(isDriverQuery, [uid]);

    if (isDriverResult[0][0].count > 0) {
        const rideQuery = "SELECT * FROM rides WHERE driver=? " + (limit ? ` LIMIT ${limit}` : '');
        const rideResult = await pool.query(rideQuery, [uid]);

        res.json(rideResult[0]);
    } else {
        res.json([{ 'driver': '0' }]);
    }
});

app.get("/tripdetails", async (req, res) => {
    const { uid, tripId } = req.query;

    const tripQuery = "SELECT (R.driver=?) as isDriver, R.fromLatitude, R.fromLongitude, R.toLatitude, R.toLongitude, R.mainTextFrom, R.mainTextTo, R.pricePerSeat, R.datetime, R.status, U.id, U.firstName, U.lastName, U.phone, U.rating, U.profilePicture FROM rides as R, users as U WHERE R.driver=U.id AND R.id=?";
    let tripResult = await pool.query(tripQuery, [uid, tripId]);
    tripResult = tripResult[0][0];

    let countSeatsOccupied = 0;
    if (tripResult.isDriver === 1) {
        const seatsQuery = `SELECT P.passenger AS id, P.paymentMethod, P.status, U.firstName, U.lastName, U.phone, U.rating, U.profilePicture FROM passengers as P, users as U WHERE P.ride=? AND U.id=P.passenger`;
        const seatsResult = await pool.query(seatsQuery, [tripId]);

        countSeatsOccupied = seatsResult[0].length;
        tripResult.passengers = seatsResult[0];
    } else {
        const seatsQuery = `SELECT COUNT(*) as count FROM passengers WHERE ride=?`;
        const seatsResult = await pool.query(seatsQuery, [tripId]);
        countSeatsOccupied = seatsResult[0][0].count;
    }


    tripResult.seatsOccupied = countSeatsOccupied;

    res.json(tripResult);
});

app.get("/cars", async (req, res) => {
    const { uid, approved } = req.query;
    let carsQuery = "SELECT id,brand,year,model,color,licensePlateLetters,licensePlateNumbers,approved FROM cars WHERE driver=?";
    values = [uid];
    if (approved) {
        carsQuery += " AND approved=1";
    }
    const carsResult = await pool.query(carsQuery, values);
    res.json(carsResult[0]);
});

app.get("/cancelride", async (req, res) => {
    const { tripId } = req.query;

    const tripQuery = "SELECT status, datetime FROM rides WHERE id=?";
    const tripResult = await pool.query(tripQuery, [tripId]);
    if (tripResult[0].length === 1 && tripResult[0][0].status === 0) {
        const currDate = new Date().getTime();
        const tripDate = new Date(tripResult[0][0].datetime).getTime();

        const timeToTrip = tripDate - currDate;
        if (timeToTrip >= 1000 * 60 * 60 * 12) {
            const cancelQuery = "UPDATE rides SET status=4 WHERE id=?";
            const cancelResult = await pool.query(cancelQuery, [tripId]);
            if (cancelResult[0].affectedRows === 1) {
                res.json({ success: 1 });
            } else {
                res.json({ error: 0 });
            }
        } else {
            // handle this better
            res.json({ tt: "insufficient" });
        }
    } else {
        res.json(tripResult[0][0]);
    }
});

app.get("/startride", async (req, res) => {
    const { tripId } = req.query;

    const tripQuery = "SELECT status, datetime FROM rides WHERE id=?";
    const tripResult = await pool.query(tripQuery, [tripId]);
    if (tripResult[0].length === 1 && tripResult[0][0].status === 0) {
        const currDate = new Date().getTime();
        const tripDate = new Date(tripResult[0][0].datetime).getTime();

        const timeToTrip = tripDate - currDate;

        if (timeToTrip <= 1000 * 60 * 60 * 1) {
            const startQuery = "UPDATE rides SET status=1 WHERE id=?";
            const startResult = await pool.query(startQuery, [tripId]);
            if (startResult[0].affectedRows === 1) {
                res.json({ success: 1 });
            } else {
                res.json({ error: 0 });
            }
        } else {
            // handle this better
            res.json({ tt: "insufficient" });
        }
    } else {
        res.json(tripResult[0][0]);
    }
});

app.get("/checkin", async (req, res) => {
    const { tripId, passenger } = req.query;
    const checkInQuery = "UPDATE passengers SET status=1 WHERE id=? AND ride=?";
    const checkInResult = await pool.query(checkInQuery, [passenger, tripId]);

    if (checkInResult[0].affectedRows === 1) {
        res.json({ success: 1 });
    } else {
        res.json({ error: 0 });
    }
});

app.get("/checkout", async (req, res) => {
    let { tripId, passenger, amountPaid, rating } = req.query;
    amountPaid = parseFloat(amountPaid);
    const balanceQuery = "SELECT U.id, U.rating, U.numRatings, balance, pricePerSeat FROM users AS U, passengers AS P, rides as R WHERE u.id = P.passenger AND P.id=? AND R.id=?";
    const balanceResult = await pool.query(balanceQuery, [passenger, tripId]);

    if (balanceResult[0][0]) {
        const result = balanceResult[0][0];
        const uid = result.id;
        let balance = result.balance;
        const pricePerSeat = result.pricePerSeat;

        let amountDue = 0;
        if (balance < pricePerSeat) {
            amountDue = pricePerSeat - balance;
        }


        if (amountPaid >= amountDue) {
            // new balance = current balance - amount due + amount paid
            const newBalance = balance - amountDue + amountPaid;
            const newRating = ((result.rating * result.numRatings) + parseFloat(rating)) / (result.numRatings + 1)
            console.log(newRating);
            const updateBalanceQuery = "UPDATE users SET balance=?, rating=?, numRatings=numRatings+1 WHERE id=?";
            const updateBalanceResult = await pool.query(updateBalanceQuery, [newBalance, newRating, uid]);

            const checkInQuery = "UPDATE passengers SET status=2 WHERE id=? AND ride=?";
            const checkInResult = await pool.query(checkInQuery, [passenger, tripId]);




            if (checkInResult[0].affectedRows === 1) {
                res.json({ success: 1 });
            } else {
                res.json({ error: 0 });
            }
        } else {
            // ??? error
        }
    }
});

app.get("/noshow", async (req, res) => {
    const { tripId, passenger } = req.query;
    const checkInQuery = "UPDATE passengers SET status=-1 WHERE id=? AND ride=?";
    const checkInResult = await pool.query(checkInQuery, [passenger, tripId]);

    if (checkInResult[0].affectedRows === 1) {
        res.json({ success: 1 });
    } else {
        res.json({ error: 0 });
    }
});

app.get("/passengerdetails", async (req, res) => {
    const { tripId, passenger } = req.query;
    const passengerQuery = "SELECT U.firstName, U.lastName, P.paymentMethod, R.pricePerSeat, U.balance FROM passengers as P, users as U, rides as R WHERE P.id=? AND ride=? AND P.passenger=U.id AND R.id = ?";
    const passengerResult = await pool.query(passengerQuery, [passenger, tripId, tripId]);

    if (passengerResult[0][0]) {
        const result = passengerResult[0][0];
        let amountDue = 0;
        if (result.balance < result.pricePerSeat) {
            amountDue = result.pricePerSeat - result.balance;
        }
        res.json({
            firstName: result.firstName,
            lastName: result.lastName,
            paymentMethod: result.paymentMethod,
            amountDue: amountDue
        });
    } else {
        res.json({ error: 0 });
    }
});

app.get("/wallet", async (req, res) => {
    const { uid } = req.query;

    const walletQuery = "SELECT balance FROM users WHERE id=?";
    const walletResult = await pool.query(walletQuery, [uid]);

    const cardsQuery = "SELECT cardnumber FROM cards WHERE user=?";
    const cardsResult = await pool.query(cardsQuery, [uid]);

    result = {};
    result.balance = walletResult[0][0].balance;
    result.cards = [];

    for (const card of cardsResult[0]) {
        result.cards.push(helper.getCardDetails(card));
    }

    res.json(result);
});

app.post("/newcar", async (req, res) => {
    const { uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back } = req.body;

    const carQuery = "INSERT INTO cars (driver, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const carResult = await pool.query(carQuery, [uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back]);
    if (carResult) {
        res.json({ success: 1 });
    }
});

app.post("/submitlicense", async (req, res) => {
    const { uid, frontSide, backSide } = req.body;
    const licenseQuery = "INSERT INTO licenses (driver, front, back) VALUES (?,?,?)";
    const licenseResult = await pool.query(licenseQuery, [uid, frontSide, backSide]);
    res.json(licenseResult);
});

app.get("/license", async (req, res) => {
    const { uid } = req.query;
    const licenseQuery = "SELECT expirydate, status FROM licenses WHERE driver=? AND (expirydate IS NULL OR expirydate > CURDATE()) ORDER BY expirydate DESC";
    const licenseResult = await pool.query(licenseQuery, [uid]);

    if (licenseResult[0].length >= 1) {
        res.json(licenseResult[0][0]);
    } else {
        res.status(404).json({ error: "No license on record" })
    }
});

app.get("/announcements", async (req, res) => {
    const announcementId = req.query?.id;
    const active = req.query?.active;

    let result;
    if (announcementId) {
        const query = "SELECT * FROM announcements WHERE id=?";
        result = await pool.query(query, [announcementId]);
    } else if (active) {
        const query = "SELECT * FROM announcements WHERE active=1";
        result = await pool.query(query);
    } else {
        const query = "SELECT * FROM announcements";
        result = await pool.query(query);
    }

    res.json(result[0]);
});

app.post("/createcommunity", async (req, res) => {
    const { name, picture, description, private, uid } = req.body;
    const communityQuery = "INSERT INTO communities (name, picture, description, private, createdBy) VALUES (?, ?, ?, ?, ?)";
    const communityResult = pool.query(communityQuery, [name, picture, description, private, uid]);
    if (communityResult) {
        res.json({ success: 1 });
    } else {
        console.log(communityResult);
        res.json({ error: 1 });
    }
});

app.get("/communities", async (req, res) => {
    // find some way to order recommended communities (maybe fastest growing communities)
    let { page } = req.query;
    if (!page) { page = 1; }
    const pageLimit = 3;
    const communitiesQuery = "SELECT id, name, picture, description, private FROM communities LIMIT " + pageLimit + " OFFSET ?";
    const values = [(page - 1) * pageLimit];

    const communitiesResult = await pool.query(communitiesQuery, values);
    console.log(communitiesResult);
    res.json(communitiesResult[0]);
});

app.get("/mycommunities", async (req, res) => {
    const { uid } = req.query;
    const communitiesQuery = "SELECT C.id,C.picture,C.name FROM communities as C, communitymembers as M WHERE M.community=C.id AND M.user=?";
    const communitiesResult = await pool.query(communitiesQuery, [uid]);

    res.json(communitiesResult[0]);
});

app.get("/myfeed", async (req, res) => {
    let { uid, page } = req.query;
    if (!page) { page = 1; }
    const pageLimit = 3;
    const feedQuery = "SELECT C.id as community_id, C.name as community_name, R.id as ride_id, R.mainTextFrom, R.mainTextTo, R.pricePerSeat, U.firstName, U.lastName, R.datetime, COUNT(S.id) AS seatsOccupied FROM communities as C, rides as R, communitymembers as M, ridecommunities as RC, passengers as S, users as U WHERE U.id = R.driver AND RC.ride = R.id AND RC.community = C.id AND M.community = C.id AND M.user=? AND R.datetime > CURDATE() AND S.ride = R.id ORDER BY R.datePosted DESC, R.datetime ASC LIMIT " + pageLimit + " OFFSET ?";
    const feedResult = await pool.query(feedQuery, [uid, (page - 1) * pageLimit]);

    res.json(feedResult[0]);
});

app.get("/loadchat", async (req, res) => {
    let { receiver } = req.query;
    const chatLoadQuery = "SELECT U.firstName, U.lastName, U.profilePicture FROM users as U WHERE id=?";
    const values = [receiver];
    const chatLoadResult = await pool.query(chatLoadQuery, values);
    res.json(chatLoadResult[0][0]);
});

app.get("/chats", async (req, res) => {
    let { uid } = req.query;
    const chatsQuery = "SELECT DISTINCT users.id, users.firstName, users.lastName, users.profilePicture FROM chatmessages JOIN users ON(chatmessages.sender = users.id OR chatmessages.receiver = users.id) WHERE(chatmessages.sender = ? OR chatmessages.receiver = ?) AND users.id != ?";
    const chatsResult = await pool.query(chatsQuery, [uid, uid, uid]);
    res.json(chatsResult[0]);
});

app.get("/chathistory", async (req, res) => {
    let { uid, receiver, page } = req.query; // last = last received message id

    if (!page) { page = 1 }
    const pageLimit = 10;

    const chatQuery = "SELECT id, message, datetime, sender, receiver FROM chatmessages WHERE (sender=? AND receiver=?) OR (receiver=? AND sender=?) ORDER BY datetime DESC LIMIT " + pageLimit + " OFFSET ?";
    const chatResult = await pool.query(chatQuery, [uid, receiver, uid, receiver, (page - 1) * pageLimit]);


    if (chatResult[0].length !== 0) {
        const updateQuery = "UPDATE chatmessages SET messageread=1 WHERE sender=? AND receiver=? AND messageread=0";
        const updateResult = await pool.query(updateQuery, [receiver, uid]);
    }

    res.json(chatResult[0]);
});

app.get("/newmessages", async (req, res) => {
    console.log("new messages polled");
    let { uid, receiver } = req.query;


    const newMessageQuery = "SELECT id, message, datetime, sender, receiver FROM chatmessages WHERE (sender=? AND receiver=?) AND messageread=0 ORDER BY datetime DESC";
    const values = [receiver, uid];
    const newMessageResult = await pool.query(newMessageQuery, values);

    if (newMessageResult[0].length !== 0) {
        const updateQuery = "UPDATE chatmessages SET messageread=1 WHERE sender=? AND receiver=? AND messageread=0";
        const updateResult = await pool.query(updateQuery, [receiver, uid]);
    }

    res.json(newMessageResult[0]);
});


app.get("/sendmessage", async (req, res) => {
    let { uid, receiver, message } = req.query;

    const sendMessageQuery = "INSERT INTO chatmessages (message, sender, receiver) VALUES (?,?,?)";
    const sendMessageResult = await pool.query(sendMessageQuery, [message, uid, receiver]);

    res.json({ id: sendMessageResult[0].insertId });
});

app.listen(config.app.port, () => {
    console.log(`API listening at http://localhost:${config.app.port}`);
});