const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const mapService = require("../../services/googleMapsService");
const { default: rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);

router.get("/getPredictions", authenticateToken, async (req, res, next) => {
    const text = req.query.text;
    const lat = req.query.lat;
    const lng = req.query.lng;
    const city = req.query.city;

    if (!text) {
        return next(new BadRequestError());
    }

    mapService.getPredictions(text, lat, lng, city).then(result => {
        return res.json(result);
    }).catch(next);
});

router.get("/geocode", authenticateToken, async (req, res, next) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        return next(new BadRequestError());
    }

    mapService.geocode(latitude, longitude).then(result => {
        return res.json(result);
    }).catch(next);
});

router.get("/getLocationFromPlaceId", authenticateToken, async (req, res, next) => {
    const { place_id } = req.query;

    if (!place_id) {
        return next(new BadRequestError());
    }

    mapService.getLocationFromPlaceId(place_id).then(result => {
        return res.json(result);
    }).catch(next);
});

router.get("/getOptimalPath", authenticateToken, async (req, res, next) => {
    const { tripId } = req.query;
    if (!tripId) {
        return next(new BadRequestError());
    }
    const uid = req.user.userId;

    mapService.getOptimalPath(req.query, uid).then(list => res.json(list)).catch(next);
});


module.exports = router;