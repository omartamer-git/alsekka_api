const { Announcement, DriverEnrollment, Device, User, Ride } = require("../models")
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
    if (platform === 'ios') {
        const paramsEndpoint = {
            PlatformApplicationArn: 'arn:aws:sns:eu-central-1:872912343417:app/APNS_SANDBOX/seaats-app-dev',
            Token: token
        };

        const existingDevice = await Device.findOne({
            where: {
                deviceToken: token
            }
        });

        if (existingDevice !== null) {
            return;
        }



        sns.createPlatformEndpoint(paramsEndpoint, (err, data) => {
            if (err) {
                console.error(err);
            } else {
                const paramsSubscribe = {
                    Protocol: 'application',
                    TopicArn: 'arn:aws:sns:eu-central-1:872912343417:seaats-marketing',
                    Endpoint: data.EndpointArn
                }

                await Device.create({
                    deviceToken: token,
                    platformEndpoint: data.EndpointArn,
                    platform: platform
                });

                sns.subscribe(paramsSubscribe, (err, data) => {
                    if (err) {
                        console.error('Error subscribing device to SNS: ', err);
                    } else {
                        console.log('Device successfully subscribed to SNS: ', data);
                    }
                });

            }
        })

    } else {
        const paramsEndpoint = {
            PlatformApplicationArn: 'arn:aws:sns:eu-central-1:872912343417:app/GCM/android-seaats',
            Token: token
        };

        const existingDevice = await Device.findOne({
            where: {
                deviceToken: token
            }
        });

        if (existingDevice !== null) {
            return;
        }



        sns.createPlatformEndpoint(paramsEndpoint, (err, data) => {
            if (err) {
                console.error(err);
            } else {
                const paramsSubscribe = {
                    Protocol: 'application',
                    TopicArn: 'arn:aws:sns:eu-central-1:872912343417:seaats-marketing',
                    Endpoint: data.EndpointArn
                }

                Device.create({
                    deviceToken: token,
                    platformEndpoint: data.EndpointArn,
                    platform: platform
                });

                sns.subscribe(paramsSubscribe, (err, data) => {
                    if (err) {
                        console.error('Error subscribing device to SNS: ', err);
                    } else {
                        console.log('Device successfully subscribed to SNS: ', data);
                    }
                });

            }
        })
    }
}

async function addEnrolledDriver({ fullName, phoneNumber, carDescription }) {
    const enrolled = await DriverEnrollment.create({ fullName, phoneNumber, carDescription });
    return true;
}

async function sendNotificationToUser(title, message, userId = null, targetArn = null, deviceId = null) {
    let targetArn_ = targetArn;
    if (!targetArn_ && !deviceId) {
        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Device
                }
            ]
        });
        targetArn_ = user.Device.platformEndpoint;
    } else if (!targetArn && deviceId) {
        const device = await Device.findByPk(deviceId);
        targetArn_ = device.platformEndpoint;
    }

    const params = {
        Message: message,
        Subject: title,
        TargetArn: targetArn_
    };

    sns.publish(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log(data);           // successful response
        }
    });
}

async function sendNotificationToRide(title, message, rideId = null, topicArn = null) {
    let targetArn_ = topicArn;
    if (!targetArn_) {
        const ride = await Ride.findByPk(rideId);
        targetArn_ = ride.topicArn;
    }

    const params = {
        Message: message,
        Subject: title,
        TopicArn: targetArn_
    };

    sns.publish(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log(data);           // successful response
        }
    });
}

module.exports = {
    getAnnouncement,
    getAnnouncements,
    addEnrolledDriver,
    registerDevice,
    sendNotificationToUser,
    sendNotificationToRide
}