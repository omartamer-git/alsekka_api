const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const carService = require("../../services/carService");
const { default: rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);


router.get("/cars", authenticateToken, async (req, res, next) => {
    const { approved } = req.query;
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    carService.getCars({ uid, ...req.query }).then(cars => {
        return res.json(cars);
    }).catch(next);
});

router.post("/newcar", authenticateToken, async (req, res, next) => {
    const { brand, year, model, color, licensePlateLetters, licensePlateNumbers } = req.body;
    const uid = req.user.userId;
    const license_front = req.files[0];
    const license_back = req.files[1];

    if (!uid || !brand || !year || !model || !color || !licensePlateLetters ||
        !licensePlateNumbers || !license_front || !license_back) {
        return next(new BadRequestError());
    }

    carService.newCar({ uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back }).then(newCar => {
        res.json(newCar);
    }).catch(next);
});

module.exports = router;
