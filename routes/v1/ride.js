const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError, NotAcceptableError } = require('../../errors/Errors');
const router = express.Router();
const rideService = require("../../services/rideService");

router.get("/nearbyrides", authenticateToken, async (req, res, next) => {
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

router.get("/ridedetails", authenticateToken, async (req, res, next) => {
    const { rideId } = req.query;
    if (!rideId) {
        return next(new BadRequestError());
    }

    rideService.getRideDetails(req.user.userId, req.query).then(
        ride => {
            res.status(200).json(ride);
        }
    ).catch(next);
});

router.get("/suggestedprice", authenticateToken, async(req, res, next) => {
    const {fromLatitude, fromLongitude, toLatitude, toLongitude} = req.query;

    if(!fromLatitude || !fromLongitude || !toLatitude || !toLongitude) {
        return next(new BadRequestError());
    }

    const suggestedPrice = rideService.getSuggestedPrice(req.query);

    res.json({suggestedPrice: suggestedPrice});
});

router.get("/bookride", authenticateToken, async (req, res, next) => {
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

router.post("/postride", authenticateToken, async (req, res, next) => {
    // consider not getting all the data from the query and instead only taking the latitude figures? Could cost an extra API call
    // check that driver doesn't already have a ride scheduled within 1-2 (?) hours/duration of this ride
    // mainTextFrom/mainTextTo probably needs to be fetched from google api instead to prevent malicious use
    const { fromLatitude, fromLongitude, toLatitude,
        toLongitude, pricePerSeat, pickupEnabled, pickupPrice,
        datetime, car, community, gender, seatsAvailable, placeIdFrom, placeIdTo } = req.body;
    const driver = req.user.userId;

    if (!fromLatitude || !fromLongitude || !toLatitude || !toLongitude || !pricePerSeat || !driver || !car ||
        !datetime || !gender || !seatsAvailable
    ) {
        return next(new BadRequestError());
    }

    rideService.postRide({
        fromLatitude, fromLongitude, toLatitude,
        toLongitude, pickupPrice, pickupEnabled, pricePerSeat,
        driver, datetime, car, community, gender, seatsAvailable, placeIdFrom, placeIdTo
    }).then(ride => {
        res.json(ride);
    }).catch(next);
});

router.get("/upcomingrides", authenticateToken, async (req, res, next) => {
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

router.get("/pastrides", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;
    let limit = req.query.limit;

    if (limit) {
        req.query.limit = parseInt(limit);
    }

    rideService.getPastRides({ uid, ...req.query })
        .then(result => res.json(result))
        .catch(next);
});

router.get("/driverrides", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;
    let limit = req.query.limit;
    if (limit) {
        req.query.limit = parseInt(limit);
    }

    rideService.getDriverRides({ uid, ...req.query })
        .then(driverRides => res.json(driverRides))
        .catch(next);
});

router.get("/tripdetails", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;
    const uid = req.user.userId;

    rideService.getTripDetails({ uid, tripId })
        .then(tripResult => {
            res.json(tripResult);
        })
        .catch(next);
});

router.get("/cancelride", authenticateToken, async (req, res, next) => {
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

router.get("/cancelpassenger", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;

    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.cancelPassenger(req.query, req.user.userId).then(status => {
        res.json({ success: 1 });
    }).catch(next);
});

router.get("/startride", authenticateToken, async (req, res, next) => {
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

router.get("/checkin", authenticateToken, async (req, res, next) => {
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

router.post("/checkout", authenticateToken, async (req, res, next) => {
    let { tripId } = req.body;
    const uid = req.user.userId;

    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.checkOut({ tripId, uid }).then(response => {
        return res.json({ success: 1 });
    }).catch(next);
});

router.get("/triptotals", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;
    if (!tripId) {
        return next(new BadRequestError());
    }

    rideService.getTripTotals(req.query).then(totals => {
        return res.json(totals);
    }).catch(next);
});

router.get("/noshow", authenticateToken, async (req, res, next) => {
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

router.post("/submitdriverratings", authenticateToken, async (req, res, next) => {
    const { tripId, ratings } = req.body;

    if (!tripId || !ratings) {
        return next(new BadRequestError());
    }

    const uid = req.user.userId;

    rideService.submitDriverRatings(req.body, uid).then(response => {
        res.json({ success: 1 });
    }).catch(next);
});

router.get("/passengerdetails", authenticateToken, async (req, res, next) => {
    const { tripId, passenger } = req.query;
    const uid = req.user.userId;

    if (!tripId || !passenger || !uid) {
        return next(new BadRequestError());
    }

    rideService.getPassengerDetails({ tripId, passenger, uid, ...req.query }).then(passengerDetails => {
        return res.json(passengerDetails);
    }).catch(next);
});

router.get("/verifyvoucher", authenticateToken, async (req, res, next) => {
    const { code } = req.query;

    if (!code) {
        throw new BadRequestError("Voucher code is required");
    }

    const uid = req.user.userId;

    rideService.verifyVoucher(req.query, uid).then(voucher => {
        res.json(voucher);
    }).catch(next);
});


router.get("/driverlocation", authenticateToken, async(req, res, next) => {
    const {rideId} = req.query;
    const uid = req.user.userId;

    if(!rideId) {
        return next(new BadRequestError());
    }

    rideService.getDriverLocation(req.query, uid).then(response => {
        res.json(response);
    }).catch(next);
});


module.exports = router;