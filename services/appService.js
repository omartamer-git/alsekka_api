const { Announcement } = require("../models")
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

module.exports = {
    getAnnouncement,
    getAnnouncements
}