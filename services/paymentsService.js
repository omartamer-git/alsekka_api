const { PASSENGER_FEE } = require("../config/seaats.config");
const { User, Invoice, DriverInvoice, Passenger } = require("../models");

async function createInvoice(uid, seats, paymentMethod, ride, voucher, passengerId, pickupAddition, t, update = false) {
    const user = await User.findByPk(uid, {
        attributes: ['balance']
    });

    const totalAmount = (seats * ride.pricePerSeat);
    const driverFeeTotal = ride.driverFee * totalAmount;
    const passengerFeeTotal = PASSENGER_FEE * totalAmount;
    const balanceDue = -1 * user.balance;
    let discountAmount = 0;
    if (voucher) {
        const discount = voucher.type === 'PERCENTAGE' ? ((voucher.value / 100) * totalAmount) : voucher.value
        discountAmount = Math.min(voucher.maxValue, discount);
    }
    const grandTotal = totalAmount + pickupAddition + driverFeeTotal + passengerFeeTotal + balanceDue - discountAmount;
    const dueDate = ride.datetime;


    if (!update) {
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
                pickupAddition,
                passengerFeeTotal,
                dueDate,
                paymentMethod,
                PassengerId: passengerId,
            }, { transaction: t });
        }
    } else {
        if (paymentMethod === 'CARD') {

        } else {
            await Invoice.update({
                totalAmount,
                balanceDue,
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
    }
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
    const timeToTrip = tripDate - currDate;

    if (timeToTrip < 1000 * 60 * 60 * 24) {
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
        const user = await User.findByPk(passenger.UserId);
        const invoice = passenger.Invoice;

        if (!invoice) {
            throw new InternalServerError();
        }
        let userBalance = parseFloat(user.balance);

        userBalance += invoice.grandTotal; // -100 += 300 = 200
        userBalance -= invoice.totalAmount; // 200 -= 200 = 0
        userBalance -= invoice.pickupAddition; // 0 -=  0 = 0
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
        await invoice.save({transaction: t});

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
    const timeToTrip = tripDate - currDate;
    if (timeToTrip <= 1000 * 60 * 60 * 36) {
        const driver = await User.findByPk(ride.DriverId);

        // charge driver to re-allocate passengers
        const deduction = -1.0 * (ride.pricePerSeat * passengers.length);
        driver.balance = (1 * driver.balance) + (1 * deduction);
        await DriverInvoice.create({
            amount: deduction,
            transactionType: 'LATE_CANCELLATION',
            status: "BALANCE_DEDUCTED",
            DriverId: ride.DriverId,
            RideId: ride.id
        }, { transaction: t });
        await driver.save({ transaction: t });
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