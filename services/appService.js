const { Announcement, DriverEnrollment, Device, User, Ride, MailingList } = require("../models")
const { NotFoundError } = require("../errors/Errors")


const { SNSClient, CreatePlatformEndpointCommand, SubscribeCommand, PublishCommand } = require("@aws-sdk/client-sns");
const { IOS_ARN, ANDROID_ARN } = require("../config/seaats.config");

const sns = new SNSClient({ region: 'eu-central-1' })

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

async function registerDevice({ token, platform, language }) {
    let PlatformApplicationArn = platform === 'ios' ? IOS_ARN : ANDROID_ARN

    const paramsEndpoint = {
        PlatformApplicationArn: PlatformApplicationArn,
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

    const command = new CreatePlatformEndpointCommand(paramsEndpoint);



    sns.send(command).then(async (data) => {
        const paramsSubscribe = {
            Protocol: 'application',
            TopicArn: language === 'EN' ? 'arn:aws:sns:eu-central-1:872912343417:seaats-marketing' : 'arn:aws:sns:eu-central-1:872912343417:seaats-marketing-arabic',
            Endpoint: data.EndpointArn
        }

        await Device.create({
            deviceToken: token,
            platformEndpoint: data.EndpointArn,
            platform: platform,
            language: language || 'EN'
        });

        const subscribeCommand = new SubscribeCommand(paramsSubscribe);

        sns.send(subscribeCommand).then(() => {
            // successful sub
        }).catch(err => {
            console.log(err);
        })
    }).catch(err => console.log(err));
}

async function addEnrolledDriver({ fullName, phoneNumber, carDescription }) {
    const enrolled = await DriverEnrollment.create({ fullName, phoneNumber, carDescription });
    return true;
}

async function addToMailingList({ name, phone, gender, car }) {
    await MailingList.create({ name, phone, gender, car });
    return true;
}

async function sendNotificationToUser(title, message, userId = null, targetArn = null, deviceId = null, message_ar=null) {
    let targetArn_ = targetArn;
    let device;
    if (!targetArn_ && !deviceId) {
        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Device
                }
            ]
        });
        device = user.Device;
        targetArn_ = device.platformEndpoint;
    } else if (!targetArn && deviceId) {
        device = await Device.findByPk(deviceId);
        targetArn_ = device.platformEndpoint;
    }

    // Construct the FCM payload
    const fcmPayload = JSON.stringify({
        notification: {
            title: title,
            body: (message_ar && device.language === 'AR') ? message_ar : message,
            icon: "ic_notification"  // Ensure this icon name matches the one in your Android drawable resources
        },
        data: {
            // Additional data payload can go here
        }
    });


    const params = {
        MessageStructure: 'json',
        Message: JSON.stringify({
            default: message,
            GCM: fcmPayload
        }),
        Subject: title,
        TargetArn: targetArn_
    };

    const publishCommand = new PublishCommand(params);

    sns.send(publishCommand).then(data => {

    }).catch(err => {
        console.log(err);
    })
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

    const publishCommand = new PublishCommand(params);

    sns.send(publishCommand).catch((e) => {
        console.log(e);
    })
}

module.exports = {
    getAnnouncement,
    getAnnouncements,
    addEnrolledDriver,
    registerDevice,
    addToMailingList,
    sendNotificationToUser,
    sendNotificationToRide
}