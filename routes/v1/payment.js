const express = require('express');
const router = express.Router();
const { default: rateLimit } = require('express-rate-limit');
const _ = require('underscore');
const crypto = require('crypto');
const queryString = require('query-string');

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
    data.signatureKeys.sort();
    const objectSignaturePayload = _.pick(data, data.signatureKeys);
    const signaturePayload = queryString.stringify(objectSignaturePayload);
    const signature = crypto
      .createHmac('sha256', process.env.KASHIERAPIKEY)
      .update(signaturePayload)
      .digest('hex');
    const kashierSignature = req.header('x-kashier-signature');
    if (kashierSignature === signature) {
      console.log('valid signature');
    } else {
      console.log('invalid signature');
    }
});


module.exports = router;
