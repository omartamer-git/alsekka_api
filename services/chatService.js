const { User, ChatMessage } = require("../models");
const { Sequelize, Op, literal } = require('sequelize');
const { NotFoundError } = require("../errors/Errors")

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
    // make this query get a distinct list of users
    const chats = await ChatMessage.findAll({
        where: {
            [Op.or]: [
                { senderId: uid },
                { receiverId: uid }
            ]
        },
        attributes: [
            'senderId',
            'receiverId', 
        ],
        include: [
            {
                model: User,
                as: 'Sender',
                attributes: ['firstName', 'lastName', 'profilePicture'],
                required: false,
                where: {
                    id: {
                        [Op.ne]: uid
                    }
                }
            },
            {
                model: User,
                as: 'Receiver',
                attributes: ['firstName', 'lastName', 'profilePicture'],
                required: false,
                where: {
                    id: {
                        [Op.ne]: uid
                    }
                }
            }
        ],
    });
    let pairs = [];
    let newChats = [];
    for (let chat of chats) {
        let pair = chat.dataValues.senderId + chat.dataValues.receiverId;

        if (pairs.includes(pair)) {
            continue;
        }
        newChats.push(chat);
        pairs.push(pair);
    }
    return newChats;
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
        attributes: ['id', 'senderId', 'receiverId', 'message', 'createdAt'],
        limit: 10,
        offset: (page - 1) * 10,
        order: [['createdAt', 'DESC']]
    });

    for (const message of chatHistory) {
        if(message.messageread !== 1) {
            message.messageread = 1;
            message.save();
        }
    }
    return chatHistory;
}

async function getNewMessages({ uid, receiver }) {
    const newMessages = await ChatMessage.findAll({
        where: {
            senderId: receiver,
            receiverId: uid,
            messageread: 0
        },
        attributes: ['id', 'senderId', 'receiverId', 'message', 'createdAt'],
        order: [['createdAt', 'DESC']]
    });

    for (const message of newMessages) {
        if(message.messageread !== 1) {
            message.messageread = 1;
            message.save();    
        }
    }
    return newMessages;
}

async function sendMessage({ uid, receiver, message }) {
    try {
        const newMessage = await ChatMessage.create({
            SenderId: uid,
            ReceiverId: receiver,
            message: message
        });
    } catch(err) {
        throw new NotFoundError();
    }


    return newMessage;
}

module.exports = {
    loadChat,
    sendMessage,
    getChats,
    getChatHistory,
    getNewMessages
};