const { Sequelize, Op, literal } = require('sequelize');
const { Ride, Passenger, User, sequelize, License } = require('../models');
const { NotFoundError, InternalServerError, BadRequestError, UnauthorizedError } = require("../errors/Errors")

async function getNearbyRides(uid, { startLng, startLat, endLng, endLat, date, gender, maxDistance }) {
    let values = [startLat, startLng, startLat, endLat, endLng, endLat, uid, date, gender];
    let rideQuery = `SELECT *, 
  ( 6371 * acos( cos( radians(?) ) * cos( radians( fromLatitude ) ) * cos( radians( fromLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( fromLatitude ) ) ) ) AS distanceStart,
  ( 6371 * acos( cos( radians(?) ) * cos( radians( toLatitude ) ) * cos( radians( toLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( toLatitude ) ) ) ) AS distanceEnd 
  FROM rides WHERE (CommunityID IN (SELECT CommunityId FROM CommunityMembers WHERE UserId=? AND joinStatus='APPROVED') OR CommunityID=null) AND datetime >= ? AND gender=? HAVING distanceStart <= 50 AND distanceEnd <= 50 ORDER BY datetime, distanceStart, distanceEnd`;

    const rideResult = await sequelize.query(rideQuery, {
        replacements: values,
        type: Sequelize.QueryTypes.SELECT,
        model: Ride,
        mapToModel: true,
    });

    let result = [];
    for (const ride of rideResult) {
        const countSeatsOccupied = await Passenger.count({
            where: { RideId: ride.id }
        });
        result.push({
            "id": ride.id,
            "mainTextFrom": ride.mainTextFrom,
            "mainTextTo": ride.mainTextTo,
            "pricePerSeat": ride.pricePerSeat,
            "datetime": ride.datetime,
            "seatsOccupied": countSeatsOccupied,
        });
    }

    return result;
}

async function getRideDetails({ rideId }) {

    const ride = await Ride.findByPk(rideId,
        {
            attributes: [
                'mainTextFrom',
                'mainTextTo',
                'datetime',
                'pricePerSeat',
                'datetime',
                'fromLatitude',
                'fromLongitude',
                'toLatitude',
                'toLongitude',
                [literal('(SELECT COUNT(*) FROM passengers WHERE RideId = Ride.id)'), 'seatsOccupied']
            ],
            include: [{
                model: User,
                as: 'Driver',
                attributes: ['id', 'firstName', 'lastName', 'profilePicture', 'rating']
            }],
        });
    if (ride === null) {
        throw new NotFoundError("Ride not found");
    }

    return ride;
}

async function bookRide({ uid, rideId, paymentMethod }) {
    try {
        const newPassenger = await Passenger.create({
            UserId: uid,
            RideId: rideId,
            paymentMethod: paymentMethod,
            status: 'REQUESTED'
        });
    } catch(err) {
        throw new NotFoundError("Ride not found");
    }

    return newPassenger;
}

async function postRide({ fromLatitude, fromLongitude, toLatitude, toLongitude, mainTextFrom, mainTextTo, pricePerSeat, driver, datetime, car, community }) {
    try {
        const newRide = await Ride.create({
            fromLatitude: fromLatitude,
            fromLongitude: fromLongitude,
            toLatitude: toLatitude,
            toLongitude: toLongitude,
            mainTextFrom: mainTextFrom,
            mainTextTo: mainTextTo,
            pricePerSeat: pricePerSeat,
            DriverId: driver,
            datetime: datetime,
            CarId: car,
            CommunityId: community
        });

        return newRide;
    } catch(err) {
        throw new BadRequestError();
    }
}

async function getUpcomingRides({ uid, limit }) {
    const upcomingRides = await getPastRides({ uid, limit }, true);
    return upcomingRides;
}

async function getPastRides({ uid, limit, after }, upcoming = false) {
    const passengerFinderQuery = await Passenger.findAll({
        where: { UserId: uid },
        attributes: ['RideId'],
        raw: true
    });
    const rideIdsWherePassenger = passengerFinderQuery.map((ride) => { return ride.RideId });
    console.log(passengerFinderQuery);
    // console.log(passengerFinderQuery);
    const rideAttributeList = [
        'id',
        'mainTextFrom',
        'mainTextTo',
        'pricePerSeat',
        'datetime',
        [literal('(SELECT COUNT(*) FROM passengers WHERE RideId = Ride.id)'), 'seatsOccupied']
    ];
    const whereClauseRide = {
        [Op.or]: [
            { DriverId: uid },
            { id: { [Op.in]: rideIdsWherePassenger } }
        ]
    };
    if (upcoming) {
        whereClauseRide.status = { [Op.or]: ['SCHEDULED', 'ONGOING'] };
    }
    if (after) {
        whereClauseRide.datetime = { [Op.lt]: after };
    }

    const upcomingRides = await Ride.findAll({
        where: whereClauseRide,
        attributes: rideAttributeList,
        order: [['status', 'DESC'], ['datetime', 'ASC']],
        ...(limit && { limit: limit }),
    });

    return upcomingRides;
}

async function getDriverRides({ uid, limit }) {
    const userLicense = License.findOne({
        where: {
            status: 'APPROVED',
            UserId: uid
        }
    });
    if (userLicense === null) {
        return [{ driver: '0' }];
    }

    const driverRides = await Ride.findAll({
        where: { driverId: uid },
        ...(limit && { limit: limit }),
    });

    return driverRides;
}

async function getTripDetails({ uid, tripId }) {
    const tripDetails = await Ride.findByPk(tripId, {
        include: [
            {
                model: User,
                as: 'Driver',
                attributes: ['id', 'firstName', 'lastName', 'phone', 'rating', 'profilePicture']
            }
        ],
        attributes: [
            [sequelize.literal(`(Ride.driverId=${uid})`), 'isDriver'],
            [sequelize.literal(`(SELECT COUNT(*) FROM passengers WHERE RideId=Ride.id)`), 'seatsOccupied'],
            'fromLatitude',
            'fromLongitude',
            'toLatitude',
            'toLongitude',
            'mainTextFrom',
            'mainTextTo',
            'pricePerSeat',
            'datetime',
            'status',
        ]
    });

    if (tripDetails === null) {
        throw new NotFoundError("Ride not found");
    }

    if (tripDetails.dataValues.isDriver === 1) {
        console.log("is driver");
        const passengersDetails = await Passenger.findAll({
            attributes: ['UserId', 'paymentMethod', 'status'],
            where: {
                RideId: tripId
            },
            include: [
                {
                    model: User,
                    attributes: ['firstName', 'lastName', 'phone', 'rating', 'profilePicture']
                }
            ]
        });
        tripDetails.setDataValue('passengers', passengersDetails);
    }
    console.log(tripDetails);

    return tripDetails;
}

async function cancelRide({ tripId }) {
    const ride = await Ride.findByPk(tripId);
    if (ride === null) {
        throw new NotFoundError("Ride not found");
    }
    if (ride.status === "SCHEDULED") {
        const currDate = new Date().getTime();
        const tripDate = new Date(ride.datetime).getTime();
        const timeToTrip = tripDate - currDate;
        if (timeToTrip < 1000 * 60 * 60 * 12) {
            return false;
        }
        ride.status = "CANCELLED";
        ride.save();
        return true;
    } else {
        return false;
    }
}

async function startRide({ tripId }) {
    const ride = await Ride.findByPk(tripId);
    if (ride === null) {
        throw new NotFoundError("Ride not found");
    }
    if (ride.status === "SCHEDULED") {
        const currDate = new Date().getTime();
        const tripDate = new Date(ride.datetime).getTime();
        const timeToTrip = tripDate - currDate;
        if (timeToTrip > 1000 * 60 * 60 * 1) {
            throw new UnauthorizedError();
        }
        ride.status = "ONGOING";
        ride.save();
        return true;
    } else {
        return false;
    }
}

async function checkIn({ tripId, passenger }) {
    const passengerDetails = await Passenger.findOne({
        where: {
            UserId: passenger,
            RideId: tripId
        }
    });
    if (passengerDetails === null) {
        throw new NotFoundError("Ride not found");
    }
    passengerDetails.status = "ENROUTE";
    passengerDetails.save();
    return true;
}

async function checkOut({ tripId, passenger, amountPaid, rating }) {
    amountPaid = parseFloat(amountPaid);
    if (!rating) {
        rating = 5;
    }

    const passengerDetails = await Passenger.findOne(
        {
            where: {
                UserId: passenger,
                RideId: tripId
            },
            include: [{
                model: User,
            }]
        });
    if (passengerDetails === null) {
        throw new NotFoundError("Ride/Passenger not found");
    }
    console.log(passengerDetails);
    let balance = passengerDetails.User.balance;
    const pricePerSeat = passengerDetails.pricePerSeat;

    let amountDue = 0;
    if (balance < pricePerSeat) {
        amountDue = pricePerSeat - balance;
    } else if (amountPaid >= amountDue) {
        // new balance = current balance - amount due + amount paid
        const newBalance = balance - amountDue + amountPaid;
        const newRating = ((passengerDetails.User.rating * passengerDetails.User.numRatings) + parseFloat(rating)) / (passengerDetails.User.numRatings + 1)

        passengerDetails.User.balance = newBalance;
        passengerDetails.User.rating = newRating;
        passengerDetails.User.numRatings = passengerDetails.User.numRatings + 1;
        passengerDetails.User.save();

        passengerDetails.status = "ARRIVED";
        passengerDetails.save();

        return true;
    } else {
        throw new InternalServerError();
    }
}

async function noShow({ tripId, passenger }) {
    const passengerDetails = await Passenger.findOne({
        where: {
            UserId: passenger,
            RideId: tripId
        }
    });
    if (passengerDetails === null) {
        throw new NotFoundError("Ride/Passenger not found");
    }
    passengerDetails.status = "NOSHOW";
    passengerDetails.save();
    return true;
}

async function getPassengerDetails({ tripId, passenger }) {
    const passengerDetails = await Passenger.findOne({
        where: {
            UserId: passenger,
            RideId: tripId
        },
        include: [
            {
                model: User,
                attributes: ['firstName', 'lastName', 'balance']
            },
            {
                model: Ride,
                attributes: ['pricePerSeat']
            }
        ],
        attributes: ['paymentMethod']
    });

    if (passengerDetails === null) {
        throw new NotFoundError("Ride/Passenger not found");
    }

    let amountDue = 0;
    if (passengerDetails.User.balance < passengerDetails.Ride.pricePerSeat) {
        amountDue = passengerDetails.Ride.pricePerSeat - passengerDetails.User.balance;
    }

    return {
        firstName: passengerDetails.User.firstName,
        lastName: passengerDetails.User.lastName,
        paymentMethod: passengerDetails.paymentMethod,
        amountDue: amountDue
    };
}

module.exports = {
    getNearbyRides,
    getRideDetails,
    bookRide,
    postRide,
    getUpcomingRides,
    getPastRides,
    getDriverRides,
    getTripDetails,
    cancelRide,
    startRide,
    checkIn,
    checkOut,
    noShow,
    getPassengerDetails
};