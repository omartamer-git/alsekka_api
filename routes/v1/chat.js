const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const chatService = require("../../services/chatService");

router.get("/loadchat", authenticateToken, async (req, res, next) => {
    let { receiver } = req.query;
    const uid = req.user.userId;

    chatService.loadChat({ receiver, uid, ...req.query }).then(user => {
        return res.json(user);
    }).catch(err => {
        if (err === 404) {
            return next(err);
        } else {
            console.error(err);
            return next(err);
        }
    });
});

router.get("/chats", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    chatService.getChats({ uid, ...req.query }).then(chats => {
        return res.json(chats);
    }).catch(next);
});

router.get("/chathistory", authenticateToken, async (req, res, next) => {
    let { receiver, page } = req.query; // last = last received message id

    if (!page) {
        req.query.page = 1;
    }

    const uid = req.user.userId;

    if (!uid || !receiver) {
        return next(new BadRequestError());
    }

    chatService.getChatHistory({ uid, receiver, ...req.query }).then(chatHistory => {
        return res.json(chatHistory);
    }).catch(next);
});

router.get("/newmessages", authenticateToken, async (req, res, next) => {
    const { receiver } = req.query;
    const uid = req.user.userId;

    if (!uid || !receiver) {
        return next(new BadRequestError());
    }

    chatService.getNewMessages({ uid, receiver, ...req.query }).then(newMessages => {
        return res.json(newMessages);
    }).catch(next);
});

router.get("/sendmessage", authenticateToken, async (req, res, next) => {
    const { receiver, message } = req.query;
    const uid = req.user.userId;

    if (!uid || !receiver || !message) {
        return next(new BadRequestError());
    }

    chatService.sendMessage({ uid, receiver, message, ...req.query }).then(sendMessageResult => {
        return res.json({ id: sendMessageResult.id });
    }).catch(next);
});

router.get("/cschathistory", authenticateToken, async (req, res, next) => {
    let { page } = req.query;

    if (!page) {
        page = 1;
    }

    const uid = req.user.userId;

    chatService.getCSChatHistory({ uid, page }).then(chatHistory => {
        res.json(chatHistory);
    }).catch(next);
});

router.get("/newcsmessages", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    chatService.getNewCSMessages({ uid }).then(newMessages => {
        res.json(newMessages);
    }).catch(next);
});

router.get("/sendcsmessage", authenticateToken, async (req, res, next) => {
    const { message } = req.query;
    const uid = req.user.userId;

    chatService.sendCSMessage({ uid, message }).then(newMessage => {
        res.json(newMessage);
    }).catch(next);
});





module.exports = router;
