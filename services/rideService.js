const { Sequelize, Op, literal } = require('sequelize');
const { Ride, Passenger, User, sequelize, License, Car, Voucher, Invoice } = require('../models');
const { NotFoundError, InternalServerError, BadRequestError, UnauthorizedError, GoneError } = require("../errors/Errors");
const { DRIVER_FEE, PASSENGER_FEE } = require('../config/seaats.config');

async function getNearbyRides(uid, { startLng, startLat, endLng, endLat, date, gender, maxDistance }) {
    let secondGender;
    if (gender == "ANY") {
        const user = await User.findByPk(uid);
        secondGender = user.gender;
    }

    let values = [startLat, startLng, startLat, endLat, endLng, endLat, uid, date, gender];
    let rideQuery = `SELECT *, 
  ( 6371 * acos( cos( radians(?) ) * cos( radians( fromLatitude ) ) * cos( radians( fromLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( fromLatitude ) ) ) ) AS distanceStart,
  ( 6371 * acos( cos( radians(?) ) * cos( radians( toLatitude ) ) * cos( radians( toLongitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( toLatitude ) ) ) ) AS distanceEnd 
  FROM rides WHERE (CommunityID IN (SELECT CommunityId FROM CommunityMembers WHERE UserId=? AND joinStatus='APPROVED') OR CommunityID IS NULL) AND datetime >= ? AND (gender=? ${!secondGender ? "" : `OR gender='${secondGender}'`}) HAVING distanceStart <= 50 AND distanceEnd <= 50 ORDER BY datetime, distanceStart, distanceEnd`;

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
                'seatsAvailable',
                'pickupEnabled',
                'pickupPrice',
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

    return ride;
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
        const passengerCount = await Passenger.count({
            where: {
                RideId: rideId,
                status: "CONFIRMED"
            }
        });

        const ride = await Ride.findByPk(rideId);

        if (passengerCount >= ride.seatsAvailable) {
            throw new GoneError("Ride is full!");
        }

        if (ride.status != "SCHEDULED" || new Date(ride.datetime) < new Date()) {
            throw new GoneError("Ride no longer available.");
        }

        let voucher;
        if (voucherId) {
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

        if((pickupLocationLat || pickupLocationLng) && ride.pickupEnabled == 0) {
            throw new BadRequestError();
        }


        const newPassenger = await Passenger.create({
            UserId: uid,
            RideId: rideId,
            paymentMethod: paymentMethod,
            status: 'REQUESTED',
            seats: seats || 1,
            CardId: cardId || null,
            VoucherId: voucherId || null,
            passengerFee: PASSENGER_FEE,
            pickupLocationLat,
            pickupLocationLng
        }, { transaction: t });

        const user = await User.findByPk(uid);

        const totalAmount = seats * ride.pricePerSeat;
        const driverFeeTotal = ride.driverFee * totalAmount;
        const passengerFeeTotal = PASSENGER_FEE * totalAmount;
        const balanceDue = -1 * user.balance;
        let discountAmount = 0;
        if (voucher) {
            const discount = voucher.type === 'PERCENTAGE' ? ((voucher.value / 100) * totalAmount) : voucher.value
            discountAmount = Math.min(voucher.maxValue, discount);
        }
        const grandTotal = totalAmount + driverFeeTotal + passengerFeeTotal + balanceDue - discountAmount;
        const dueDate = ride.datetime;

        if (paymentMethod === 'CARD') {
            // card handling logic here
            // Take grandTotal from card
        } else {
            await Invoice.create({
                totalAmount,
                balanceDue,
                discountAmount,
                grandTotal,
                driverFeeTotal,
                passengerFeeTotal,
                dueDate,
                paymentMethod,
                PassengerId: newPassenger.id,
            }, { transaction: t });
        }



        await t.commit();

        return newPassenger;
    } catch (err) {
        console.error(err);
        throw new NotFoundError("Ride not found");
    }

}

async function postRide({ fromLatitude, fromLongitude, toLatitude, toLongitude, mainTextFrom, mainTextTo, pricePerSeat, driver, datetime, car, community, gender, seatsAvailable, pickupEnabled, pickupPrice }) {
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
            CommunityId: community,
            pickupEnabled: pickupEnabled,
            pickupPrice: pickupPrice || 0,
            gender: gender,
            seatsAvailable: seatsAvailable,
            driverFee: DRIVER_FEE,
        });

        return newRide;
    } catch (err) {
        throw new BadRequestError();
    }
}

async function getUpcomingRides({ uid, limit }) {
    const upcomingRides = await getPastRides({ uid, limit }, true);
    return upcomingRides;
}

async function getPastRides({ uid, limit, after, offset }, upcoming = false) {
    const passengerFinderQuery = await Passenger.findAll({
        where: { UserId: uid },
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
        'DriverId',
        [literal('(SELECT SUM(seats) FROM passengers WHERE RideId = Ride.id AND status != "CANCELLED")'), 'seatsOccupied']
    ];
    const whereClauseRide = {
        [Op.or]: [
            { DriverId: uid },
            { id: { [Op.in]: rideIdsWherePassenger } }
        ]
    };
    if (upcoming && after) {
        whereClauseRide.status = { [Op.or]: ['SCHEDULED', 'ONGOING'] };
        whereClauseRide.datetime = {
            [Op.and]: [
                { [Op.gte]: new Date() },
                { [Op.lt]: after }
            ]
        };
    } else if (upcoming) {
        whereClauseRide.status = { [Op.or]: ['SCHEDULED', 'ONGOING'] };
        whereClauseRide.datetime = { [Op.gte]: new Date() };
    } else if (after) {
        whereClauseRide.datetime = { [Op.lt]: after };
    }



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
                [Op.and] : {
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
            'fromLatitude',
            'fromLongitude',
            'toLatitude',
            'toLongitude',
            'mainTextFrom',
            'mainTextTo',
            'pricePerSeat',
            'datetime',
            'status',
            'seatsAvailable',
            'pickupEnabled',
            'DriverId'
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

    return tripDetails;
}

async function cancelRide({ tripId }) {
    const ride = await Ride.findByPk(tripId);
    if (ride === null) {
        throw new NotFoundError();
    }
    if (ride.status === "SCHEDULED") {
        const currDate = new Date().getTime();
        const tripDate = new Date(ride.datetime).getTime();
        const timeToTrip = tripDate - currDate;
        if (timeToTrip < 1000 * 60 * 60 * 12) {
            throw new BadRequestError();
        }
        ride.status = "CANCELLED";
        ride.save();
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
        const invoice = await Invoice.findOne({
            where: {
                PassengerId: passenger.id
            }
        });

        const currDate = new Date().getTime();
        const tripDate = new Date(ride.datetime).getTime();
        const timeToTrip = tripDate - currDate;
        const t = await sequelize.transaction();
        if (timeToTrip < 1000 * 60 * 60 * 12) {
            // late cancel
            if (invoice.paymentMethod === 'CARD') {
                const driver = await ride.getDriver();
                driver.balance = driver.balance + invoice.totalAmount - invoice.driverFeeTotal;
                await driver.save({ transaction: t });
            } else {
                // handle late cancel cash
                const driver = await ride.getDriver();
                driver.balance = driver.balance + invoice.totalAmount - invoide.driverFeeTotal;
                await driver.save({ transaction: t });

                passenger.User.balance = passenger.User.balance - invoice.grandTotal;
                await passenger.User.save({ transaction: t });
            }
        } else {
            if (invoice.paymentMethod === 'CARD') {
                passenger.User.balance = passenger.User.balance + (invoice.grandTotal - invoice.balanceDue);
            } else {
                passenger.User.balance = passenger.User.balance - invoice.balanceDue;
            }
            invoice.paymentStatus = 'REVERSED';
            await invoice.save({ transaction: t });
            await passenger.User.save({ transaction: t });
        }

        passenger.status = "CANCELLED";
        await passenger.save({ transaction: t });
        await t.commit();

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

    for(const passenger of passengers) {
        ret.push({
            id: passenger.UserId,
            grandTotal: passenger.Invoice.grandTotal
        })
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
    const ride = await Ride.findByPk(passengerDetails.RideId);

    if (passengerDetails === null) {
        throw new NotFoundError("Ride/Passenger not found");
    }
    let balance = passengerDetails.User.balance;
    const pricePerSeat = ride.pricePerSeat;
    const numSeats = passengerDetails.seats;

    const invoice = await Invoice.findOne({
        where: {
            PassengerId: passengerDetails.id
        }
    });

    if (!invoice) {
        throw new InternalServerError();
    }

    const t = await sequelize.transaction();
    const driver = await ride.getDriver();

    if (invoice.paymentMethod === 'CARD') {
        driver.balance = driver.balance + invoice.totalAmount - invoice.driverFeeTotal;
    } else {
        driver.balance = driver.balance - invoice.driverFeeTotal - invoice.passengerFeeTotal;
    }

    const passengers = await Passenger.findAll({
        where: {
            UserId: passenger,
            status: 'CONFIRMED'
        },
        include: [{
            model: Invoice
        }]
    });

    for(let p of passengers) {
        p.Invoice.grandTotal -= invoice.balanceDue;
        p.Invoice.balanceDue -= invoice.balanceDue;
        await p.save({transaction: t});
    }

    await driver.save({ transaction: t });


    passengerDetails.User.rating = newRating;
    passengerDetails.User.numRatings = passengerDetails.User.numRatings + 1;
    await passengerDetails.User.save({ transaction: t });

    await t.commit();
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
    verifyVoucher
};