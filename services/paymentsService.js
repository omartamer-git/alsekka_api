const { PASSENGER_FEE } = require("../config/seaats.config");
const { User, Invoice, DriverInvoice, Passenger } = require("../models");
const { sendNotificationToRide } = require("./appService");

async function createInvoice(uid, seats, paymentMethod, ride, voucher, passengerId, pickupAddition, t, update = false) {
    const user = await User.findByPk(uid, {
        attributes: ['balance']
    });

    const totalAmount = (seats * ride.pricePerSeat);
    const driverFeeTotal = Math.floor(ride.driverFee * totalAmount);
    const passengerFeeTotal = Math.floor(PASSENGER_FEE * totalAmount);

    const totalServiceProvided = totalAmount + passengerFeeTotal + pickupAddition;


    const userBalance = user.balance;
    let discountAmount = 0;
    if (voucher) {
        const discount = voucher.type === 'PERCENTAGE' ? ((voucher.value / 100) * totalAmount) : voucher.value
        discountAmount = Math.min(voucher.maxValue, discount);
        discountAmount = Math.floor(discountAmount);
        discountAmount = Math.min(discountAmount, totalServiceProvided);
    }

    const grandTotal = totalServiceProvided - discountAmount - userBalance;
    // const grandTotal = totalAmount + pickupAddition + passengerFeeTotal + balanceDue - discountAmount;
    const dueDate = ride.datetime;

    let invoice;

    if (!update) {
        invoice = await Invoice.create({
            totalAmount,
            balanceDue: -1 * userBalance,
            discountAmount,
            grandTotal,
            driverFeeTotal,
            pickupAddition,
            passengerFeeTotal,
            dueDate,
            paymentMethod,
            PassengerId: passengerId,
        }, { transaction: t });
    } else {
        invoice = await Invoice.update({
            totalAmount,
            balanceDue: -1 * userBalance,
            discountAmount,
            grandTotal,
            pickupAddition,
            driverFeeTotal,
            passengerFeeTotal,
            dueDate,
        }, {
            where: {
                PassengerId: passengerId
            },
            transaction: t
        })
    }

    return invoice;
}

async function cancelPassengerInvoice(passenger, ride, driver, t) {
    const passengerId = passenger.id;
    const invoice = await Invoice.findOne({
        where: {
            PassengerId: passengerId
        }
    });

    const currDate = new Date().getTime();
    const tripDate = new Date(ride.datetime).getTime();
    const creationDate = new Date(passenger.createdAt).getTime();


    const timeToTrip = tripDate - currDate;
    const timeFromCreation = currDate - creationDate;

    if (timeToTrip <= 1000 * 60 * 60 * 24 && timeFromCreation >= 1000 * 60 * 15) {
        // late cancel
        if (invoice.paymentMethod === 'CARD') {
            driver.balance = driver.balance + invoice.totalAmount - invoice.driverFeeTotal;
            await driver.save({ transaction: t });
        } else {
            // handle late cancel cash
            driver.balance = driver.balance + invoice.totalAmount - invoice.driverFeeTotal;
            await driver.save({ transaction: t });

            passenger.User.balance = passenger.User.balance - invoice.grandTotal;
            await passenger.User.save({ transaction: t });
        }
    } else {
        if (invoice.paymentMethod === 'CARD') {
            passenger.User.balance = passenger.User.balance + (invoice.grandTotal - invoice.balanceDue);
        } else {
            // TODO: Check that this is actually wrong, I commented it because it doesn't make sense. The passenger's balance should presumably stay the same after the ride
            // passenger.User.balance = passenger.User.balance - invoice.balanceDue;
        }
        invoice.paymentStatus = 'REVERSED';
        await invoice.save({ transaction: t });
        await passenger.User.save({ transaction: t });
    }
}

async function checkOutRide(ride, passengers, t) {
    const driver = await ride.getDriver();

    for (let passenger of passengers) {

        // invoicing
        const user = await User.findByPk(passenger.UserId);
        const invoice = passenger.Invoice;

        if (!invoice) {
            throw new InternalServerError();
        }
        let userBalance = parseFloat(user.balance);

        userBalance += invoice.grandTotal;
        userBalance -= invoice.totalAmount;
        userBalance += invoice.discountAmount;
        userBalance -= invoice.pickupAddition;
        userBalance -= invoice.passengerFeeTotal;

        user.balance = userBalance;

        await user.save({ transaction: t });

        if (invoice.paymentMethod === 'CARD') {
            driver.balance = parseFloat(driver.balance) + invoice.totalAmount + invoice.pickupAddition - invoice.driverFeeTotal;
        } else {
            let driverBalance = parseFloat(driver.balance);

            driverBalance -= invoice.grandTotal;
            driverBalance += invoice.totalAmount; // Price/Seat * Number of Seats
            driverBalance -= invoice.driverFeeTotal;
            driverBalance += invoice.pickupAddition;

            driver.balance = driverBalance;
        }

        invoice.paymentStatus = 'PAID';
        await invoice.save({ transaction: t });

        // removing due balance from other rides

        const passengersOtherRides = await Passenger.findAll({
            where: {
                UserId: passenger.UserId,
                status: 'CONFIRMED'
            },
            include: [{
                model: Invoice
            }]
        });

        for (let p of passengersOtherRides) {
            p.Invoice.grandTotal -= invoice.balanceDue;
            p.Invoice.balanceDue -= invoice.balanceDue;
            await p.Invoice.save({ transaction: t });
        }
    }

    await driver.save({ transaction: t });
}

async function cancelRideInvoices(ride, t) {
    const passengers = await ride.getPassengers({
        include: [
            {
                model: Invoice,
            }
        ],
        where: {
            status: 'CONFIRMED'
        }
    });

    const currDate = new Date().getTime();
    const tripDate = new Date(ride.datetime).getTime();
    const tripCreatedAt = new Date(ride.createdAt).getTime();
    const timeToTrip = tripDate - currDate;
    const timeFromCreation = currDate - tripCreatedAt;
    if (timeToTrip <= 1000 * 60 * 60 * 48 && timeFromCreation >= 1000 * 60 * 30) {
        const driver = await User.findByPk(ride.DriverId);

        // charge driver to re-allocate passengers
        let deduction = 0;
        if (passengers.length > 0) {
            deduction = -10000;
        }
        driver.balance = (1 * driver.balance) + (1 * deduction);
        await DriverInvoice.create({
            amount: deduction,
            transactionType: 'PENALTY',
            reason: "LATE_CANCELLATION_NOSHOW",
            DriverId: ride.DriverId,
            RideId: ride.id
        }, { transaction: t });
        await driver.save({ transaction: t });
    }

    for (const passenger of passengers) {
        passenger.Invoice.paymentStatus = "REVERSED";
        // TODO: Add cancellation reason
        passenger.status = "CANCELLED";

        if (passenger.Invoice.paymentMethod === "CARD") {
            passenger.balance += passenger.Invoice.totalAmount;
        }

        await passenger.Invoice.save({ transaction: t });
        await passenger.save({ transaction: t });
    }

    sendNotificationToRide("Ride Cancelled", `We regret to inform you that your ride to ${ride.mainTextTo} has been cancelled. Rest assured, we are actively working to find you a replacement ride and will be in contact with you shortly!`, ride.topicArn).catch(err => {

    })
}

module.exports = {
    createInvoice,
    cancelPassengerInvoice,
    checkOutRide,
    cancelRideInvoices
}