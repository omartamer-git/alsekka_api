const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const mapService = require("../../services/googleMapsService");
const redis = require('ioredis');
const { getDriverLocation } = require('../../services/rideService');
const redisClient = new redis();

router.post("/updatelocation", authenticateToken, async(req, res, next) => {
    const {lat, lng, timestamp} = req.body;
    const uid = req.user.userId;

    redisClient.set(`driverLocation:${uid}`, JSON.stringify(req.body), 'EX', 60 * 60);

    res.status(200).send();
});

router.get("/driverlocation", authenticateToken, async(req, res, next) => {
    const {rideId} = req.query;
    const uid = req.user.userId;

    if(!rideId) {
        return next(new BadRequestError());
    }

    getDriverLocation(req.query, uid).then(response => {
        res.json(response);
    }).catch(next);
});

module.exports = router;