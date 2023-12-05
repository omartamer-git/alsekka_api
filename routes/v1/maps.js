const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const mapService = require("../../services/googleMapsService");

router.get("/getPredictions", authenticateToken, async (req, res, next) => {
    const text = req.query.text;
    const lat = req.query.lat;
    const lng = req.query.lng;

    if (!text) {
        return next(new BadRequestError());
    }

    mapService.getPredictions(text, lat, lng).then(result => {
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