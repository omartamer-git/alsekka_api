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

async function addToMailingList({email}) {
    await MailingList.create({email});
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