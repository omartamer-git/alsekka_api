const express = require('express');
const router = express.Router();
const { default: rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);


router.post("/webhook", async (req, res, next) => {
    console.log(req.body);
    res.json({});
});


module.exports = router;
