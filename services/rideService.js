const { Sequelize, Op, literal } = require('sequelize');
const { Ride, Passenger, User, sequelize, License, Car, Voucher, Invoice } = require('../models');
const { NotFoundError, InternalServerError, BadRequestError, UnauthorizedError, GoneError, ForbiddenError } = require("../errors/Errors");
const { DRIVER_FEE, PASSENGER_FEE } = require('../config/seaats.config');
const { SNS, SNSClient, CreateTopicCommand } = require("@aws-sdk/client-sns");
const { getDirections, geocode, getLocationFromPlaceId } = require('./googleMapsService');
const { isFloat } = require('../util/util');
const { subtractDates } = require('../helper');
const geolib = require('geolib');

const { sendNotificationToUser, sendNotificationToRide } = require('./appService');
const { createInvoice, cancelPassengerInvoice, checkOutRide, cancelRideInvoices } = require('./paymentsService');
const { checkUserInCommunity } = require('./communityService');
const redis = require('ioredis');
const { generateKashierOrderHash } = require('./kashierService');
const { default: axios } = require('axios');
const redisClient = new redis();
const sns = new SNSClient({ region: 'eu-central-1' })


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
    const t = await sequelize.transaction();

    try {
        const passengers = await Passenger.findAll({
            where: {
                RideId: rideId,
                status: {
                    [Op.or]: ["CONFIRMED", "AWAITING_PAYMENT"]
                }
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
        let pickupAddition = 0;

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

        if ((pickupLocationLat || pickupLocationLng) && ride.pickupEnabled == 0) {
            throw new BadRequestError();
        }

        if (pickupLocationLat && pickupLocationLng) {
            pickupAddition = ride.pickupPrice;
        }


        let newPassenger;
        let oldPassenger;
        let invoice;

        if (prevPassenger.length === 0) {
            newPassenger = await Passenger.create({
                UserId: uid,
                RideId: rideId,
                paymentMethod: paymentMethod,
                status: paymentMethod === 'CASH' ? 'CONFIRMED' : 'AWAITING_PAYMENT',
                seats: seats || 1,
                CardId: cardId || null,
                VoucherId: voucherId || null,
                passengerFee: PASSENGER_FEE,
                pickupLocationLat,
                pickupLocationLng
            }, { transaction: t });

            invoice = await createInvoice(uid, seats, paymentMethod, ride, voucher, newPassenger.id, pickupAddition, t);
        } else {
            oldPassenger = prevPassenger[0];
            if (oldPassenger.seats > seats) {
                throw new BadRequestError();
            }

            if (oldPassenger.VoucherId) {
                voucher = await Voucher.findByPk(oldPassenger.VoucherId);
            }

            oldPassenger.seats = seats;
            if (pickupLocationLat && pickupLocationLng) {
                oldPassenger.pickupLocationLat = pickupLocationLat;
                oldPassenger.pickupLocationLng = pickupLocationLng;
            }

            if (oldPassenger.paymentMethod !== 'CASH') {
                oldPassenger.status = 'AWAITING_PAYMENT';
            }

            await oldPassenger.save({ transaction: t });

            invoice = await createInvoice(uid, seats, paymentMethod, ride, voucher, oldPassenger.id, pickupAddition, t, true);
        }

        await t.commit();

        sendNotificationToUser("New Passenger", 'A passenger has booked a ride with you to ' + ride.mainTextTo, ride.DriverId).catch((e) => {
            console.log(e);
        });

        let passengerJSON = newPassenger ? newPassenger.toJSON() : oldPassenger.toJSON();
        passengerJSON.hash = generateKashierOrderHash(passengerJSON.id, uid, invoice.grandTotal);
        return {
            passenger: passengerJSON,
            invoice: invoice.toJSON()
        }
    } catch (err) {
        console.error(err);

        await t.rollback();
        throw new NotFoundError("Ride not found");
    }

}

async function postRide({ fromLatitude, fromLongitude, toLatitude, toLongitude, placeIdFrom, placeIdTo, pricePerSeat, driver, datetime, car, community, gender, seatsAvailable, pickupEnabled, pickupPrice }) {
    try {
        if (community) {
            const userInCommunity = await checkUserInCommunity(driver, community);
            if (!userInCommunity) throw new UnauthorizedError();
        }

        const { polyline, duration } = await getDirections(fromLatitude, fromLongitude, toLatitude, toLongitude);
        const SRID = 4326;

        const topicName = crypto.randomUUID();
        const params = {
            Name: topicName
        }

        const topicCommand = new CreateTopicCommand(params);
        const topicData = await sns.send(topicCommand);
        const topicArn = topicData.TopicArn;

        let mainTextFrom;
        let mainTextTo;

        if (placeIdFrom) {
            mainTextFrom = (await getLocationFromPlaceId(placeIdFrom)).name;
        } else {
            const geocodeResult = await geocode(fromLatitude, fromLongitude);
            for (const addressComponent of geocodeResult.address_components) {
                if (!addressComponent.types.includes("plus_code")) {
                    mainTextFrom = addressComponent.long_name;
                    break;
                } else {
                    mainTextFrom = addressComponent.short_name;
                }
            }
        }

        if (placeIdTo) {
            mainTextTo = (await getLocationFromPlaceId(placeIdTo)).name;
        } else {
            const geocodeResult = await geocode(toLatitude, toLongitude);
            for (const addressComponent of geocodeResult.address_components) {
                if (!addressComponent.types.includes("plus_code")) {
                    mainTextTo = addressComponent.long_name;
                    break;
                } else {
                    mainTextTo = addressComponent.short_name;
                }
            }
        }


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

function getSuggestedPrice({ fromLatitude, fromLongitude, toLatitude, toLongitude }) {
    // dist is the distance in kilometers / 100
    // warning: straight line distance, actual distance is inflated
    //          which is why the factor of 1.5 is added
    const dist = geolib.getDistance(
        { latitude: fromLatitude, longitude: fromLongitude },
        { latitude: toLatitude, longitude: toLongitude }
    ) / (1000 * 100) * 1.5;

    const litrePer100km = 10;

    // Price of fuel
    const pricePerLitre = 12.5;

    // return (
    //     Math.ceil(
    //         (((dist * costPerKilometer) * (1 + DRIVER_FEE)) / riders) / 5
    //     ) * 5
    // );

    return (
        Math.ceil(
            ((dist * litrePer100km * pricePerLitre * (1 + DRIVER_FEE)) / 4)
        )
    )
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
        order: [['datetime', 'DESC']],
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
                RideId: tripId,
                status: {
                    [Op.ne]: 'CANCELLED'
                }
            },
            include: [
                {
                    model: User,
                    attributes: ['firstName', 'lastName', 'phone', 'rating', 'profilePicture']
                }
            ]
        });
        tripDetails.setDataValue('passengers', passengersDetails);
    } else {
        const passengerDetails = await Passenger.findOne({
            where: {
                UserId: uid,
                RideId: tripId
            }
        });

        tripDetails.setDataValue('passenger', passengerDetails);
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
        try {
            await cancelRideInvoices(ride, t);

            ride.status = "CANCELLED";
            await ride.save({ transaction: t });
            await t.commit();
            sendNotificationToRide("Ride Cancelled", "Your ride to " + ride.mainTextTo + " has been cancelled by the driver. We apologize for the inconvenience.", null, ride.topicArn).then(() => {
                // notification sent
            }).catch((e) => {
                console.log(e);
            });
            return true;
        } catch (e) {
            await t.rollback();
            throw new InternalServerError();
        }
    } else {
        throw new BadRequestError();
    }
}

async function getDriverLocation({ rideId }, userId) {
    const ride = await Ride.findByPk(rideId, {
        attributes: ["id", "DriverId"]
    });
    if (!ride) throw new NotFoundError();

    const passenger = await Passenger.findOne({
        attributes: ["id"],
        where: {
            UserId: userId,
            RideId: rideId,
            status: {
                [Op.or]: ["CONFIRMED", "ENROUTE"]
            }
        }
    });

    if (!passenger) throw new UnauthorizedError();

    const cachedData = await redisClient.get(`driverLocation:${ride.DriverId}`);

    if (cachedData) {
        return JSON.parse(cachedData);
    } else {
        return { "stop": 1 };
    }
}

async function forceCancelPassenger(passengerId, userId, invoiceId) {
    const passengerPromise = Passenger.findByPk(passengerId);
    const invoicePromise = Invoice.findByPk(invoiceId);

    const [passenger, invoice] = await Promise.all([passengerPromise, invoicePromise]);

    if(passenger.UserId === userId && invoice.PassengerId !== passengerId) {
        throw new ForbiddenError();
    }

    if(passenger.status !== "AWAITING_PAYMENT") {
        throw new BadRequestError();
    }

    // TODO: Add reason
    passenger.status = "CANCELLED";
    invoice.paymentStatus = "REVERSED";

    await Promise.all([passenger.save(), invoice.save()]);

    return true;
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
        try {
            const driver = await ride.getDriver();

            await cancelPassengerInvoice(passenger, ride, driver, t);


            passenger.status = "CANCELLED";
            await passenger.save({ transaction: t });
            await t.commit();

            sendNotificationToUser("Passenger Cancelled", `One of the passengers in your trip to ${ride.mainTextTo} has cancelled their seat, you will be compensated if they cancelled outside of the free cancellation window. We apologize for the inconvenience.`, null, null, driver.DeviceId).then(() => {
                // notification sent
            }).catch((e) => {
                console.log(e);
            })

            return true;
        } catch (e) {
            await t.rollback();
            throw new InternalServerError();
        }
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

        sendNotificationToRide("Ride Started", `Your ride to ${ride.mainTextTo} has started!`, null, ride.topicArn).then(() => {
            // notification sent
        }).catch((e) => {
            console.log(e);
        })

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

    sendNotificationToUser("Welcome aboard!", `Welcome aboard this Seaats ride!`, passenger);

    return true;
}

async function checkOut({ tripId, uid }) {

    const ride = await Ride.findByPk(tripId);

    if (ride.DriverId !== uid) {
        throw new UnauthorizedError();
    }

    const t = await sequelize.transaction();
    try {
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

        redisClient.set(`driverLocation:${ride.DriverId}`, JSON.stringify({ "stop": 1 }), 'EX', 60 * 60);
        sendNotificationToRide("Farewell!", `Thank you for using Seaats! Feel free to leave a rating for this ride within the app!`, null, ride.topicArn).catch(e => console.log(e));
    } catch (e) {
        await t.rollback();
        throw new InternalServerError();
    }
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

async function validateBooking(passengerId, reference) {
    const t = await sequelize.transaction();

    try {
        const passenger = await Passenger.findByPk(passengerId);
        const invoice = await Invoice.findOne({
            where: {
                PassengerId: passengerId
            }
        });

        passenger.status = 'CONFIRMED';
        invoice.paymentStatus = 'PAID';
        invoice.reference = reference;

        await Promise.all([passenger.save({ transaction: t }), invoice.save({ transaction: t })])
        await t.commit();
    } catch (err) {
        console.log(err);
        // TODO: Properly handle refund
        const body = {
            "apiOperation": "REFUND",
            "reason": "Customer booking failed to process due to server error",
            "transaction": {
                "amount": 3,
            }
        }
        axios.put(`${process.env.KASHIER_REFUNDURL}/${reference.kashierOrderId}`, body);
        await t.rollback();
    }
}

module.exports = {
    getNearbyRides,
    getRideDetails,
    bookRide,
    postRide,
    getUpcomingRides,
    validateBooking,
    getSuggestedPrice,
    getPastRides,
    getDriverRides,
    getTripDetails,
    cancelRide,
    cancelPassenger,
    forceCancelPassenger,
    startRide,
    checkIn,
    checkOut,
    getTripTotals,
    noShow,
    getPassengerDetails,
    verifyVoucher,
    submitDriverRatings,
    getDriverLocation
};