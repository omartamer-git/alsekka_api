const { Announcement } = require("../models")

async function getAnnouncement(announcementId) {
    const announcement = await Announcement.findByPk(announcementId);
    if(announcement === null) {
        throw 404;
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