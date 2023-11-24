const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const carService = require("../../services/carService");

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
    const { brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back } = req.body;
    const uid = req.user.userId;

    if (!uid || !brand || !year || !model || !color || !licensePlateLetters ||
        !licensePlateNumbers || !license_front || !license_back) {
        return next(new BadRequestError());
    }

    carService.newCar({ uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back }).then(newCar => {
        res.json({ success: 1 });
    }).catch(next);
});

module.exports = router;
