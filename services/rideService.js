const { Sequelize, Op, literal } = require('sequelize');
const { Ride, Passenger, User, sequelize, License, Car, Voucher, Invoice } = require('../models');
const { NotFoundError, InternalServerError, BadRequestError, UnauthorizedError, GoneError } = require("../errors/Errors");
const { DRIVER_FEE, PASSENGER_FEE } = require('../config/seaats.config');
const { getDirections } = require('./googleMapsService');
const { isFloat } = require('../util/util');
const { subtractDates } = require('../helper');

const AWS = require('aws-sdk');
const { sendNotificationToUser, sendNotificationToRide } = require('./appService');
const { createInvoice, cancelPassengerInvoice, checkOutRide, cancelRideInvoices } = require('./paymentsService');
AWS.config.update({
    accessKeyId: 'AKIA4WPNBKF4XUVMTRE4',
    secretAccessKey: 'fx6W1HLoNx/K1y9zrEKW6sGpXaerrYLzmu1iQt6+',
    region: 'eu-central-1',  // e.g., us-west-2
});
const sns = new AWS.SNS();


async function getNearbyRides(uid, { startLng, startLat, endLng, endLat, date, gender, maxDistance }) {
    if (!isFloat(startLat) || !isFloat(startLng) || !isFloat(endLat) || !isFloat(endLng)) {
        throw new BadRequestError();
    }


    let secondGender;
    if (gender == "ANY") {
        const user = await User.findByPk(uid);
        secondGender = user.gender;
    }

    let values = [uid, date, subtractDates(date, -24), gender];
    let rideQuery = `SELECT R.*, ST_Distance_Sphere(fromLocation, ST_GeomFromText('POINT(${startLat} ${startLng})', 4326) ) as distanceStart, ST_Distance_Sphere(toLocation, ST_GeomFromText( 'POINT(${endLat} ${endLng})', 4326 ) ) as distanceEnd, C.brand, C.model FROM rides AS R, cars AS C  WHERE R.status='SCHEDULED' AND (C.UserId = R.DriverId) AND (CommunityID IN (SELECT CommunityId FROM CommunityMembers WHERE UserId=? AND joinStatus='APPROVED') OR CommunityID IS NULL) AND datetime >= ? AND datetime <= ? AND (gender=? ${!secondGender ? "" : `OR gender='${secondGender}'`}) HAVING distanceStart <= 10000 AND distanceEnd <= 10000 ORDER BY datetime, distanceStart, distanceEnd`;

    const rideResult = await sequelize.query(rideQuery, {
        replacements: values,
        type: Sequelize.QueryTypes.SELECT,
        model: Ride,
        mapToModel: true,
    });

    let result = [];
    for (const ride of rideResult) {
        const countSeatsOccupied = await Passenger.sum('seats', {
            where: { RideId: ride.id, status: { [Op.ne]: "CANCELLED" } }
        });
        result.push({
            "id": ride.id,
            "DriverId": ride.DriverId,
            "mainTextFrom": ride.mainTextFrom,
            "mainTextTo": ride.mainTextTo,
            "pricePerSeat": ride.pricePerSeat,
            "datetime": ride.datetime,
            "seatsAvailable": ride.seatsAvailable,
            "duration": ride.duration,
            "model": ride.model,
            "brand": ride.brand,
            "pickupEnabled": ride.pickupEnabled,
            "gender": ride.gender,
            "seatsOccupied": countSeatsOccupied,
        });
    }

    return result;
}

async function getRideDetails(uid, { rideId }) {
    const ride = await Ride.findByPk(rideId,
        {
            attributes: [
                'mainTextFrom',
                'mainTextTo',
                'datetime',
                'pricePerSeat',
                'datetime',
                [sequelize.literal('ST_X(fromLocation)'), 'fromLatitude'],
                [sequelize.literal('ST_Y(fromLocation)'), 'fromLongitude'],
                [sequelize.literal('ST_X(toLocation)'), 'toLatitude'],
                [sequelize.literal('ST_Y(toLocation)'), 'toLongitude'],
                'seatsAvailable',
                'pickupEnabled',
                'pickupPrice',
                'gender',
                'polyline',
                'duration',
                'DriverId',
                [literal('(SELECT SUM(seats) FROM passengers WHERE RideId = Ride.id AND status != "CANCELLED")'), 'seatsOccupied']
            ],
            include: [
                {
                    model: User,
                    as: 'Driver',
                    attributes: ['id', 'firstName', 'lastName', 'profilePicture', 'rating']
                },
                {
                    model: Car,
                }
            ],
        });

    if (ride === null) {
        throw new NotFoundError("Ride not found");
    }

    const rideJSON = ride.toJSON();

    const prevPassenger = await Passenger.findOne({
        where: {
            RideId: rideId,
            UserId: uid
        }
    });

    if (prevPassenger) {
        rideJSON.Passenger = prevPassenger;
    }

    return rideJSON;
}

async function verifyVoucher({ code }, uid) {
    const voucher = await Voucher.findOne({
        where: {
            code: code,
            expiration: {
                [Op.gte]: new Date()
            }
        }
    });

    if (voucher === null) {
        throw new NotFoundError("Voucher code does not exist or may have expired");
    }

    if (voucher.maxUses > voucher.currentUses) {
        if (voucher.singleUse == 1) {
            const passengerQuery = await Passenger.findOne({
                where: {
                    UserId: uid,
                    VoucherId: voucher.id
                }
            });

            if (passengerQuery !== null) {
                throw new GoneError("This voucher code can only be used once");
            }
        }


        return {
            id: voucher.id,
            type: voucher.type,
            value: voucher.value,
            maxValue: voucher.maxValue
        };
    } else {
        throw new GoneError("Voucher is no longer valid or has expired");
    }
}

async function bookRide({ uid, rideId, paymentMethod, cardId, seats, voucherId, pickupLocationLat, pickupLocationLng }) {
    try {
        const passengers = await Passenger.findAll({
            where: {
                RideId: rideId,
                status: "CONFIRMED"
            }
        });



        const passengerCount = passengers.length;

        const ride = await Ride.findByPk(rideId);

        if (passengerCount >= ride.seatsAvailable) {
            throw new GoneError("Ride is full!");
        }

        if (ride.status != "SCHEDULED" || new Date(ride.datetime) < new Date()) {
            throw new GoneError("Ride no longer available.");
        }

        const prevPassenger = passengers.filter(p => p.UserId === uid);

        let voucher;
        if (prevPassenger.length === 0 && voucherId) {
            voucher = await Voucher.findByPk(voucherId);
            if (voucher === null) {
                throw new NotFoundError();
            }

            if (new Date(voucher.expiration) >= new Date() && voucher.maxUses > voucher.currentUses) {
                if (voucher.singleUse == 1) {
                    const passengerQuery = await Passenger.findOne({
                        where: {
                            UserId: uid,
                            VoucherId: voucher.id
                        }
                    });

                    if (passengerQuery !== null) {
                        throw new GoneError("This voucher code can only be used once");
                    }
                }
            } else {
                throw new GoneError("Voucher is no longer valid or has expired");
            }
        }

        const t = await sequelize.transaction();

        if ((pickupLocationLat || pickupLocationLng) && ride.pickupEnabled == 0) {
            throw new BadRequestError();
        }

        if (prevPassenger.length === 0) {
            const newPassenger = await Passenger.create({
                UserId: uid,
                RideId: rideId,
                paymentMethod: paymentMethod,
                status: 'CONFIRMED',
                seats: seats || 1,
                CardId: cardId || null,
                VoucherId: voucherId || null,
                passengerFee: PASSENGER_FEE,
                pickupLocationLat,
                pickupLocationLng
            }, { transaction: t });

            await createInvoice(uid, seats, paymentMethod, ride, voucher, newPassenger.id, t);
            await t.commit();
        } else {
            const oldPassenger = prevPassenger[0];
            if(oldPassenger.seats > seats) {
                throw new BadRequestError();
            }

            if(oldPassenger.VoucherId) {
                voucher = await Voucher.findByPk(oldPassenger.VoucherId);
            }

            oldPassenger.seats = seats;
            oldPassenger.save({transaction: t});

            await createInvoice(uid, seats, paymentMethod, ride, voucher, oldPassenger.id, t, true);
        }

        sendNotificationToUser("New Passenger", 'A passenger has booked a ride with you to ' + ride.mainTextTo, ride.DriverId);


        return newPassenger ? newPassenger : prevPassenger[0];
    } catch (err) {
        console.error(err);
        throw new NotFoundError("Ride not found");
    }

}

async function postRide({ fromLatitude, fromLongitude, toLatitude, toLongitude, mainTextFrom, mainTextTo, pricePerSeat, driver, datetime, car, community, gender, seatsAvailable, pickupEnabled, pickupPrice }) {
    try {
        const { polyline, duration } = await getDirections(fromLatitude, fromLongitude, toLatitude, toLongitude);
        const SRID = 4326;

        const topicName = crypto.randomUUID();
        const params = {
            Name: topicName
        }
        const topicData = await sns.createTopic(params).promise();
        const topicArn = topicData.TopicArn;

        const newRide = await Ride.create({
            fromLocation: sequelize.fn('ST_GeomFromText', `POINT(${fromLatitude} ${fromLongitude})`, SRID),
            toLocation: sequelize.fn('ST_GeomFromText', `POINT(${toLatitude} ${toLongitude})`, SRID),
            mainTextFrom: mainTextFrom,
            mainTextTo: mainTextTo,
            pricePerSeat: pricePerSeat,
            DriverId: driver,
            datetime: datetime,
            CarId: car,
            CommunityId: community,
            pickupEnabled: pickupEnabled,
            pickupPrice: pickupPrice || 0,
            gender: gender,
            seatsAvailable: seatsAvailable,
            driverFee: DRIVER_FEE,
            polyline: polyline,
            duration: duration,
            topicArn: topicArn
        });

        return newRide;
    } catch (err) {
        throw new BadRequestError();
    }
}

async function getUpcomingRides({ uid, limit }) {
    const upcomingRides = await getPastRides({ uid, limit }, true, false);
    return upcomingRides;
}

async function getPastRides({ uid, limit, page }, upcoming = false, cancelled = true) {
    const passengerFinderQuery = await Passenger.findAll({
        where: {
            UserId: uid,
            ...(cancelled ? {} : { status: { [Op.ne]: 'CANCELLED' } })
        },
        attributes: ['RideId'],
        raw: true
    });
    const rideIdsWherePassenger = passengerFinderQuery.map((ride) => { return ride.RideId });
    const rideAttributeList = [
        'id',
        'mainTextFrom',
        'mainTextTo',
        'pricePerSeat',
        'datetime',
        'status',
        'seatsAvailable',
        'duration',
        'DriverId',
        'pickupEnabled',
        'gender',
        [literal('(SELECT SUM(seats) FROM passengers WHERE RideId = Ride.id AND status != "CANCELLED")'), 'seatsOccupied']
    ];
    const whereClauseRide = {
        [Op.or]: [
            { DriverId: uid },
            { id: { [Op.in]: rideIdsWherePassenger } }
        ]
    };

    if (upcoming) {
        whereClauseRide.status = { [Op.or]: ['SCHEDULED', 'ONGOING'] };
        whereClauseRide.datetime = { [Op.gte]: new Date() };
    }

    const offset = (limit && page) ? (page - 1) * limit : 0;


    const upcomingRides = await Ride.findAll({
        where: whereClauseRide,
        attributes: rideAttributeList,
        order: [['status', 'DESC'], ['datetime', 'ASC']],
        ...(limit && { limit: limit }),
        ...(offset && { offset: offset })
    });

    return upcomingRides;
}

async function getDriverRides({ uid, limit }) {
    const driverRides = await Ride.findAll({
        where: {
            DriverId: uid,
            [Op.or]: {
                datetime: {
                    [Op.gte]: new Date()
                },
                status: 'ONGOING',
                [Op.and]: {
                    datetime: {
                        [Op.lte]: new Date()
                    },
                    status: 'SCHEDULED'
                }
            }
        },
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
            },
            {
                model: Car
            }
        ],
        attributes: [
            [sequelize.literal(`(Ride.driverId=${uid})`), 'isDriver'],
            [sequelize.literal(`(SELECT SUM(seats) FROM passengers WHERE RideId=Ride.id AND status != "CANCELLED")`), 'seatsOccupied'],
            'id',
            [sequelize.literal('ST_X(fromLocation)'), 'fromLatitude'],
            [sequelize.literal('ST_Y(fromLocation)'), 'fromLongitude'],
            [sequelize.literal('ST_X(toLocation)'), 'toLatitude'],
            [sequelize.literal('ST_Y(toLocation)'), 'toLongitude'],
            'mainTextFrom',
            'mainTextTo',
            'pricePerSeat',
            'datetime',
            'status',
            'seatsAvailable',
            'pickupEnabled',
            'gender',
            'DriverId',
            'polyline',
            'duration'
        ]
    });

    if (tripDetails === null) {
        throw new NotFoundError("Ride not found");
    }

    if (tripDetails.dataValues.isDriver === 1) {
        const passengersDetails = await Passenger.findAll({
            attributes: ['UserId', 'paymentMethod', 'status', 'pickupLocationLat', 'pickupLocationLng'],
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

    const timeToTrip = new Date(tripDetails.datetime).getTime() - new Date().getTime();
    if (timeToTrip > 1000 * 60 * 60 * 3) {
        tripDetails.Driver.phone = null;
    }


    return tripDetails;
}

async function cancelRide({ tripId }) {
    const ride = await Ride.findByPk(tripId);
    if (ride === null) {
        throw new NotFoundError();
    }
    if (ride.status === "SCHEDULED") {
        const t = await sequelize.transaction();

        await cancelRideInvoices(ride, t);

        ride.status = "CANCELLED";
        await ride.save({ transaction: t });
        await t.commit();
        sendNotificationToRide("Ride Cancelled", "Your ride to " + ride.mainTextTo + " has been cancelled by the driver. We apologize for the inconvenience.", null, ride.topicArn);
        return true;
    } else {
        throw new BadRequestError();
    }
}

async function cancelPassenger({ tripId }, userId) {
    const passenger = await Passenger.findOne({
        where: {
            RideId: tripId,
            UserId: userId
        },
        include: [
            {
                model: User
            }
        ]
    });
    if (passenger == null) {
        throw new NotFoundError();
    }

    const ride = await passenger.getRide();

    if (ride.status === "SCHEDULED") {
        const t = await sequelize.transaction();

        await cancelPassengerInvoice(passenger.id, ride, t);


        passenger.status = "CANCELLED";
        await passenger.save({ transaction: t });
        await t.commit();

        sendNotificationToUser("Passenger Cancelled", `One of the passengers in your trip to ${ride.mainTextTo} has cancelled their seat, you will be compensated if they cancelled outside of the free cancellation window. We apologize for the inconvenience.`, null, null, driver.DeviceId);

        return true;
    } else {
        throw new BadRequestError();
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

        sendNotificationToRide("Ride Started", `Your ride to ${ride.mainTextTo} has started!`, null, ride.topicArn)

        return true;
    } else {
        return false;
    }
}

async function getTripTotals({ tripId }) {
    const passengers = await Passenger.findAll({
        where: {
            status: 'ENROUTE',
            RideId: tripId
        },
        include: [{
            model: Invoice
        }]
    });

    const ret = [];

    for (const passenger of passengers) {
        ret.push({
            id: passenger.UserId,
            grandTotal: passenger.Invoice.grandTotal
        })
    }

    return ret;
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

    sendNotificationToUser("Welcome aboard!", `Welcome aboard this Seaats ride heading towards ${mainTextTo}!`, passenger);

    return true;
}

async function checkOut({ tripId, uid }) {

    const ride = await Ride.findByPk(tripId);

    if (ride.DriverId !== uid) {
        throw new UnauthorizedError();
    }

    const t = await sequelize.transaction();

    const passengers = await Passenger.findAll({
        where: {
            status: 'ENROUTE',
            RideId: tripId
        },
        include: [{
            model: Invoice
        }]
    });

    // First, gather the UserIds of all passengers
    const passengerIds = passengers.map(passenger => passenger.id);

    // Update all passengers' status in a bulk update
    await Passenger.update({ status: 'ARRIVED' }, {
        where: {
            id: { [Op.in]: passengerIds },
        },
        transaction: t,
    });

    await checkOutRide(ride, passengers, t);

    ride.status = 'COMPLETED';

    await ride.save({ transaction: t });

    await t.commit();

    sendNotificationToUser("Farewell!", `Thank you for using Seaats! Feel free to leave a rating for this ride within the app!`, passenger);
}

async function submitDriverRatings({ tripId, ratings }, uid) {
    const ride = await Ride.findByPk(tripId);
    if (ride.DriverId !== uid) {
        throw new UnauthorizedError();
    }
    if (ride.driverCompletedRatings == 1) {
        throw new BadRequestError();
    }

    ride.driverCompletedRatings = true;
    ride.save();

    for (const rating of ratings) {
        const user = await User.findByPk(rating.id);

        user.rating = ((user.rating * user.numRatings) + rating.stars) / (user.numRatings + 1);
        user.numRatings = user.numRatings + 1;
        user.save();
    }

    return true;
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
    cancelPassenger,
    startRide,
    checkIn,
    checkOut,
    getTripTotals,
    noShow,
    getPassengerDetails,
    verifyVoucher,
    submitDriverRatings
};