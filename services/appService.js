const { Announcement, DriverEnrollment } = require("../models")
const { NotFoundError } = require("../errors/Errors")

async function getAnnouncement(announcementId) {
    const announcement = await Announcement.findByPk(announcementId);
    if(announcement === null) {
        throw new NotFoundError();
    }
    return announcement;
}

async function getAnnouncements(active) {
    const announcements = await Announcement.findAll({
        where: {
            ...(active && { active: 1 }),
        }
    });

    return announcements;
}

async function addEnrolledDriver({fullName, phoneNumber, carDescription}) {
    const enrolled = await DriverEnrollment.create({fullName, phoneNumber, carDescription});
    return true;
}

module.exports = {
    getAnnouncement,
    getAnnouncements,
    addEnrolledDriver
}