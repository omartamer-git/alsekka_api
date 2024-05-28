const { Op } = require("sequelize");
const { UnauthorizedError, NotFoundError, BadRequestError, InternalServerError } = require("../errors/Errors");
const { Staff, User, License, Car, Announcement, Ride, Community, Passenger } = require("../models");
const bcrypt = require("bcrypt");
const { sendNotificationToUser } = require("./appService");

async function staffLogin({ username, password }) {
    let userAccount;
    userAccount = await Staff.scope('auth').findOne({ where: { username: username } });
    if (!userAccount) {
        throw new UnauthorizedError("Invalid username and/or password. Please try again.", "اسم مستخدم أو كلمة مرور غير صحيحة. حاول مرة اخرى.");
    }

    const result = await bcrypt.compare(password, userAccount.password);
    if (result) {
        return userAccount;
    } else {
        throw new UnauthorizedError("Invalid username and/or password. Please try again.", "اسم مستخدم أو كلمة مرور غير صحيحة. حاول مرة اخرى.");
    }
};

async function findUser({ phone }) {
    const userAccount = await User.findOne({
        where: {
            phone: phone
        }
    });

    if (userAccount === null) {
        throw new NotFoundError();
    }
    return userAccount;
}

async function customerLicenses({ uid }) {
    const licenses = await License.findAll({
        where: {
            UserId: uid
        }
    });

    return licenses;
}

async function updateUser({ id, firstName, lastName, phone, email, profilePicture, gender }) {
    const userAccount = await User.findByPk(id);
    if (!userAccount) {
        throw new NotFoundError();
    }
    userAccount.firstName = firstName || userAccount.firstName;
    userAccount.lastName = lastName || userAccount.lastName;
    userAccount.phone = phone || userAccount.phone;
    userAccount.email = email || userAccount.email;
    userAccount.profilePicture = profilePicture || userAccount.profilePicture;
    userAccount.gender = gender || userAccount.gender;

    userAccount.save();

    return userAccount;
}

async function updateLicense({ id, licensenumber, issuedate, expirydate, nationalid, status }) {
    const license = await License.findByPk(id);
    if (!license) {
        throw new NotFoundError();
    }

    license.licensenumber = licensenumber || license.licensenumber;
    license.nationalid = nationalid || license.nationalid;
    license.status = status || license.status;
    license.issuedate = issuedate || license.issuedate;
    license.expirydate = expirydate || license.expirydate;

    await license.save();
    if(status === 'APPROVED') {
        sendNotificationToUser('License Verified', 'Congratulations! Your identity has been successfully verified. You can now host rides on Seaats. Welcome aboard!', license.UserId, null, null, "تهانينا! لقد تم التحقق من هويتك بنجاح. يمكنك الآن استضافة الرحلات على Seaats.")
    }
    return license;
}

async function getPendingLicenses() {
    const licenses = await License.findAll({
        where: {
            status: 'PENDING'
        },
        limit: 10
    });

    return licenses;
}

async function updateCar({ id, brand, year, model, color, issuedate, expirydate, licensePlateLetters, licensePlateNumbers, status }) {
    const car = await Car.findByPk(id);
    if (!car) {
        throw new NotFoundError();
    }

    car.brand = brand || car.brand;
    car.year = year || car.year;
    car.model = model || car.model;
    car.color = color || car.color;
    car.licensePlateLetters = licensePlateLetters || car.licensePlateLetters;
    car.licensePlateNumbers = licensePlateNumbers || car.licensePlateNumbers;
    car.status = status || car.status;
    car.issuedate = issuedate || car.issuedate;
    car.expirydate = expirydate || car.expirydate;

    if(status === 'APPROVED') {
        sendNotificationToUser('License Verified', 'Congratulations! Your vehicle license has been successfully verified.', car.UserId, null, null, "مبروك! تم التحقق من رخصة سيارتك بنجاح!")
    }

    car.save();

    return car;
}

async function getPendingCars() {
    const cars = await Car.scope('staff').findAll({
        where: {
            status: 'PENDING'
        },
        limit: 10
    });

    return cars;
}

async function getMembers() {
    const members = await Staff.findAll();
    return members;
}

async function createStaffMember({ username, password, phone, role }) {
    password = await bcrypt.hash(password, 10);
    const member = await Staff.create({ username, password, phone, role });

    return true;
}

async function getStaffMember({ id }) {
    const member = await Staff.findByPk(id);

    return member;
}

async function editStaffMember({ id, username, password, role, phone }) {
    const member = await Staff.findByPk(id);

    member.username = username || member.username;
    member.password = password ? await bcrypt.hash(password, 10) : member.password;
    member.role = role || member.role;
    member.phone = phone || member.phone;

    member.save();

    return true;
}

async function getAllAnnouncements() {
    const announcements = await Announcement.findAll({
        where: {
            [Op.or]: {
                from: { [Op.gte]: new Date() },
                to: { [Op.gte]: new Date() }
            }
        }
    });

    return announcements;
}

async function updateAnnouncement({id, title_en, text_en, title_ar, text_ar, from, to, active}) {
    const announcement = await Announcement.findByPk(id);

    announcement.title_en = title_en || announcement.title_en;
    announcement.title_ar = title_ar || announcement.title_ar;
    announcement.text_en = text_en || announcement.text_en;
    announcement.text_ar = text_ar || announcement.text_ar;

    announcement.from = from || announcement.from;
    announcement.to = to || announcement.to;
    announcement.active = active || announcement.active;

    announcement.save();
    return true;
}

async function createAnnouncement({title_en, title_ar, text_en, text_ar, from, to, active}) {
    await Announcement.create({title_en, title_ar, text_en, text_ar, from, to, active});
    return true;
}

async function getFullRide({id}) {
    const rideDetails = Ride.findByPk(id, {
        include: [
            {
                model: User,
                as: 'Driver',
            },
            {
                model: Passenger,
                include: [
                    {
                        model: User
                    }
                ]
            },
            {
                model: Car
            },
            {
                model: Community
            }
        ]
    });

    return rideDetails;
};

async function cancelRide({id}) {
    const ride = await Ride.findByPk(id);
    if(ride.status === "SCHEDULED") {
        ride.status = "CANCELLED";
        ride.save();
    } else {
        throw new BadRequestError();
    }

    return true;
}

module.exports = {
    staffLogin,
    findUser,
    updateUser,
    customerLicenses,
    updateLicense,
    getPendingLicenses,
    updateCar,
    getPendingCars,
    getMembers,
    createStaffMember,
    getStaffMember,
    editStaffMember,
    getAllAnnouncements,
    updateAnnouncement,
    createAnnouncement,
    getFullRide,
    cancelRide
};