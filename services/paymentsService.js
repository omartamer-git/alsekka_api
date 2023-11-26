const { PASSENGER_FEE } = require("../config/seaats.config");
const { User, Invoice, DriverInvoice } = require("../models");
const { dateDiffInDays } = require("../util/util");

async function createInvoice(uid, seats, ride, voucher, passengerId, t) {
    const user = await User.findByPk(uid, {
        attributes: ['balance']
    });

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
            PassengerId: passengerId,
        }, { transaction: t });
    }
}

async function cancelPassengerInvoice(passengerId, ride, t) {
    const invoice = await Invoice.findOne({
        where: {
            PassengerId: passengerId
        }
    });

    const currDate = new Date().getTime();
    const tripDate = new Date(ride.datetime).getTime();
    const timeToTrip = tripDate - currDate;
    const driver = await ride.getDriver();

    if (timeToTrip < 1000 * 60 * 60 * 12) {
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
            passenger.User.balance = passenger.User.balance - invoice.balanceDue;
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

        const invoice = passenger.Invoice;

        if (!invoice) {
            throw new InternalServerError();
        }

        if (invoice.paymentMethod === 'CARD') {
            driver.balance = driver.balance + invoice.totalAmount - invoice.driverFeeTotal;
        } else {
            driver.balance = driver.balance - invoice.grandTotal + (invoice.totalAmount - invoice.driverFeeTotal);
        }

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

    const currDate = new Date();
    const tripDate = new Date(ride.datetime);
    console.log(dateDiffInDays(tripDate, currDate));
    if (dateDiffInDays(tripDate, currDate) <= 1.5) {
        const driver = await User.findByPk(ride.DriverId);

        // charge driver to re-allocate passengers
        const deduction = - (ride.pricePerSeat * passengers.length);
        driver.balance = driver.balance + deduction;
        await DriverInvoice.create({
            amount: deduction,
            transactionType: 'LATE_CANCELLATION',
            status: "BALANCE_DEDUCTED"
        }, { transaction: t });
    }

    for (const passenger of passengers) {
        passenger.Invoice.paymentStatus = "REVERSED";
        passenger.status = "DRIVER_CANCELLED";

        if (passenger.Invoice.paymentMethod === "CARD") {
            passenger.balance += passenger.Invoice.totalAmount;
        }

        await passenger.Invoice.save({ transaction: t });
        await passenger.save({ transaction: t });
    }
}

module.exports = {
    createInvoice,
    cancelPassengerInvoice,
    checkOutRide,
    cancelRideInvoices
}