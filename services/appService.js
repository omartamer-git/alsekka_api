const { Announcement, DriverEnrollment } = require("../models")
const { NotFoundError } = require("../errors/Errors")

const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: 'AKIA4WPNBKF4XUVMTRE4',
    secretAccessKey: 'fx6W1HLoNx/K1y9zrEKW6sGpXaerrYLzmu1iQt6+',
    region: 'eu-central-1',  // e.g., us-west-2
});
const sns = new AWS.SNS();

async function getAnnouncement(announcementId) {
    const announcement = await Announcement.findByPk(announcementId);
    if (announcement === null) {
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

async function registerDevice({ token, platform }) {
    if(platform === 'iOS') {
        const params = {
            Protocol: 'application',
            TopicArn: 'arn:aws:sns:eu-central-1:872912343417:seaats-marketing',
            Endpoint: token
        };

        sns.subscribe(params, (err, data) => {
            if(err) {
                console.error('Error subscribing device to SNS: ', err);
            } else {
                console.log('Device successfully subscribed to SNS: ', data);
            }
        })
    }
}

async function addEnrolledDriver({ fullName, phoneNumber, carDescription }) {
    const enrolled = await DriverEnrollment.create({ fullName, phoneNumber, carDescription });
    return true;
}

module.exports = {
    getAnnouncement,
    getAnnouncements,
    addEnrolledDriver,
    registerDevice
}