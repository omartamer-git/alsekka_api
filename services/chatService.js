const { User, ChatMessage, CustomerServiceConversation, CustomerServiceChat } = require("../models");
const { Sequelize, Op, literal } = require('sequelize');
const { NotFoundError } = require("../errors/Errors");
const { sendNotificationToUser } = require("./appService");

async function loadChat({ receiver }) {
    const user = await User.findByPk(receiver, {
        attributes: ['firstName', 'lastName', 'profilePicture']
    });
    if (user === null) {
        throw new NotFoundError();
    }
    return user;
}

async function getChats({ uid }) {
    const rawQuery = `
    SELECT t1.SenderId, t1.ReceiverId, t1.createdAt, t1.messageread
    FROM chatmessages t1
    JOIN (
        SELECT MAX(createdAt) AS latestCreatedAt, SenderId, ReceiverId
        FROM chatmessages
        WHERE SenderId = :uid OR ReceiverId = :uid
        GROUP BY SenderId, ReceiverId
    ) t2
    ON t1.createdAt = t2.latestCreatedAt AND t1.SenderId = t2.SenderId AND t1.ReceiverId = t2.ReceiverId;
    `;

    const chats = await sequelize.query(rawQuery, {
        replacements: { uid },
        type: sequelize.QueryTypes.SELECT
    });


    return chats;
}



async function getChatHistory({ uid, receiver, page }) {
    const chatHistory = await ChatMessage.findAll({
        where: {
            [Op.or]: [
                {
                    senderId: uid,
                    receiverId: receiver
                },
                {
                    senderId: receiver,
                    receiverId: uid
                }
            ]
        },
        attributes: ['id', 'senderId', 'receiverId', 'message', 'messageread', 'createdAt'],
        limit: 10,
        offset: (page - 1) * 10,
        order: [['createdAt', 'DESC']]
    });

    for (const message of chatHistory) {
        if (message.messageread !== 1) {
            message.messageread = 1;
            message.save();
        }
    }
    return chatHistory;
}

async function getCSChatHistory({ uid, page }) {
    const convo = await CustomerServiceConversation.findOne({
        where: {
            UserId: uid,
            active: 1
        }
    });

    if (convo !== null) {
        const chatHistory = await CustomerServiceChat.findAll({
            where: {
                CustomerServiceConversationId: convo.id,
            },
            attributes: ['id', 'message', 'messageread', 'sentByUser', 'createdAt'],
            limit: 10,
            offset: (page - 1) * 10,
            order: [['createdAt', 'DESC']]
        });

        for (const message of chatHistory) {
            if (MessageChannel.messageread !== 1) {
                message.messageread = 1;
                message.save();
            }
        }

        return chatHistory;
    }

    return [];
}

async function getNewCSMessages({ uid }) {
    let convo = await CustomerServiceConversation.findOne({
        where: {
            UserId: uid,
            active: 1
        }
    });

    const newMessages = await CustomerServiceChat.findAll({
        where: {
            sentByUser: false,
            CustomerServiceConversationId: convo.id,
            messageread: 0
        },
        attributes: ['id', 'message', 'messageread', 'createdAt'],
        order: [['createdAt', 'DESC']]
    });

    for (const message of newMessages) {
        if (message.messageread !== 1) {
            message.messageread = 1;
            message.save();
        }
    }
    return newMessages;
}

async function getNewMessages({ uid, receiver }) {
    const newMessages = await ChatMessage.findAll({
        where: {
            senderId: receiver,
            receiverId: uid,
            messageread: 0
        },
        attributes: ['id', 'senderId', 'messageread', 'receiverId', 'message', 'createdAt'],
        order: [['createdAt', 'DESC']]
    });

    for (const message of newMessages) {
        if (message.messageread !== 1) {
            message.messageread = 1;
            message.save();
        }
    }
    return newMessages;
}

async function sendCSMessage({ uid, message }) {
    let convo = await CustomerServiceConversation.findOne({
        where: {
            UserId: uid,
            active: 1
        }
    });

    if (convo === null) {
        convo = await CustomerServiceConversation.create({
            active: 1,
            UserId: uid
        });
    }

    const newMessage = await CustomerServiceChat.create({
        message: message,
        CustomerServiceConversationId: convo.id,
        sentByUser: 1
    });

    return newMessage;
}

async function sendMessage({ uid, receiver, message }) {
    try {
        const newMessage = await ChatMessage.create({
            SenderId: uid,
            ReceiverId: receiver,
            message: message
        });

        const user = await User.findByPk(uid);


        sendNotificationToUser(user.firstName, `${user.firstName}: ${message.substring(0, 30)}${message.length > 30 ? "..." : ""}`, receiver);

        return newMessage;
    } catch (err) {
        throw new NotFoundError();
    }

}

module.exports = {
    loadChat,
    sendMessage,
    getChats,
    getChatHistory,
    getNewMessages,
    getCSChatHistory,
    getNewCSMessages,
    sendCSMessage
};