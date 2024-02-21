const express = require('express');
const router = express.Router();
const { default: rateLimit } = require('express-rate-limit');
const _ = require('underscore');
const crypto = require('crypto');
const { stringify } = require('querystring');
const { validateBooking } = require('../../services/rideService');

const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);


router.post("/webhook", async (req, res, next) => {
    res.status(200).json({});
    const { data, event } = req.body;

    if (event !== 'pay') return;

    data.signatureKeys.sort();
    const objectSignaturePayload = _.pick(data, data.signatureKeys);
    const signaturePayload = stringify(objectSignaturePayload);
    const signature = crypto
        .createHmac('sha256', process.env.KASHIERAPIKEY)
        .update(signaturePayload)
        .digest('hex');
    const kashierSignature = req.header('x-kashier-signature');
    if (kashierSignature === signature) {
        // Valid Signature
        const passengerId = data.metaData.passengerId;
        /*
    "kashierOrderId": "efb3d440-e3bf-4c86-b98e-c7bb1cbbcca1",
    "orderReference": "TEST-ORD-33581",
    "transactionId": "TX-249893122",
        */
        const reference = JSON.stringify({
            kashierOrderId: data.kashierOrderId,
            orderReference: data.orderReference,
            transactionId: data.transactionId,
            sourceOfFunds: data.sourceOfFunds
        });

        validateBooking(passengerId, reference);
    }
});

router.post("/settlewebhook", async (req, res, next) => {
    res.status(200).json({});
    const { data, event } = req.body;

    if (event !== 'pay') return;

    data.signatureKeys.sort();
    const objectSignaturePayload = _.pick(data, data.signatureKeys);
    const signaturePayload = stringify(objectSignaturePayload);
    const signature = crypto
        .createHmac('sha256', process.env.KASHIERAPIKEY)
        .update(signaturePayload)
        .digest('hex');
    const kashierSignature = req.header('x-kashier-signature');
    if (kashierSignature === signature) {
        // Valid Signature
        const passengerId = data.metaData.passengerId;
        /*
    "kashierOrderId": "efb3d440-e3bf-4c86-b98e-c7bb1cbbcca1",
    "orderReference": "TEST-ORD-33581",
    "transactionId": "TX-249893122",
        */
        const reference = JSON.stringify({
            kashierOrderId: data.kashierOrderId,
            orderReference: data.orderReference,
            transactionId: data.transactionId,
            sourceOfFunds: data.sourceOfFunds
        });

        validateBooking(passengerId, reference);
    }
});

module.exports = router;
