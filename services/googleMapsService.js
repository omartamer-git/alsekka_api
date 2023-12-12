const { default: axios } = require("axios");
const { Ride, Passenger } = require("../models");
const { NotFoundError, UnauthorizedError } = require("../errors/Errors");
const { calculateDistance, findOptimalPath } = require("../util/util");
const redis = require('ioredis');

// const googleKey = "AIzaSyDUNz5SYhR1nrdfk9TW4gh3CDpLcDMKwuw";
const googleKey = "AIzaSyDgtya731fBmhzsGJGmcJq9fVwkUQ45e1c";
const redisClient = new redis();

async function getPredictions(text, lat, lng) {
    // cairo LATLNG: 30.059482,31.2172648
    if (!lat || !lng) {
        lat = 30.059482;
        lng = 31.2172648;
    }

    const cachedData = await redisClient.get(`pred:${text}`);

    if (cachedData) {
        return {
            data: JSON.parse(cachedData)
        }
    }

    let pred = [];
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = {
        input: text,
        key: googleKey,
        region: 'eg',
        language: 'en',
        locationbias: `circle:100000@${lat},${lng}`,
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    for (let i = 0; i < data.predictions.length; i++) {
        pred.push([data.predictions[i].description, data.predictions[i].place_id]);
    }

    // cache for 1hr
    redisClient.set(`pred:${text}`, JSON.stringify(pred), 'EX', 60 * 60)

    return {
        data: pred
    };
};

async function geocode(latitude, longitude) {
    const cachedData = await redisClient.get(`geocode:${latitude},${longitude}`);

    if (cachedData) {
        return JSON.parse(cachedData);
    }

    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
        latlng: `${latitude},${longitude}`,
        key: googleKey,
        result_type: 'street_address|route|intersection|political|colloquial_area|neighborhood|premise|subpremise|airport|park|point_of_interest'
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    const returnResult = data.results[0];

    // cache for 2 weeks
    redisClient.set(`geocode:${latitude},${longitude}`, JSON.stringify(returnResult), 'EX', 14 * 60 * 60 * 24)

    return returnResult;
};

async function getLocationFromPlaceId(place_id) {
    const cachedData = await redisClient.get(`placeid:${place_id}`);

    if(cachedData) {
        return JSON.parse(cachedData);
    }

    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = {
        place_id: place_id,
        key: googleKey,
    };
    const result = await axios.get(url, { params });
    const data = result.data;

    const locationData = data.result.geometry.location;

    const returnResult = { ...locationData, name: data.result.name };

    // cache for 2 weeks
    redisClient.set(`placeid:${place_id}`, JSON.stringify(returnResult), 'EX', 14 * 60 * 60 * 24)

    return returnResult;
};

async function getOptimalPath({ tripId }, uid) {
    const ride = await Ride.findByPk(tripId);
    if (!ride) {
        throw new NotFoundError("Ride not found");
    }

    if (ride.DriverId !== uid) {
        throw new UnauthorizedError();
    }

    const passengers = await Passenger.findAll({
        where: {
            status: 'CONFIRMED',
            RideId: tripId
        }
    });


    const startingPoint = {
        passengerId: 'start',
        point: {
            latitude: ride.fromLocation.coordinates[0],
            longitude: ride.fromLocation.coordinates[1]
        }
    };

    const intermediatePoints = [];

    if (ride.pickupEnabled == 1) {
        for (const passenger of passengers) {
            if (passenger.pickupLocationLat && passenger.pickupLocationLng) {
                intermediatePoints.push({
                    passengerId: passenger.UserId,
                    point: {
                        latitude: passenger.pickupLocationLat,
                        longitude: passenger.pickupLocationLng
                    }
                });
            }
        }
    }

    const result = findOptimalPath(startingPoint, intermediatePoints);
    return result;
}

async function getDirections(startLat, startLng, endLat, endLng) {
    const cachedData = await redisClient.get(`directions:${startLat},${startLng},${endLat},${endLng}`);

    if(cachedData) {
        return JSON.parse(cachedData);
    }
    

    const url = 'https://maps.googleapis.com/maps/api/directions/json';
    const params = {
        origin: `${startLat},${startLng}`,
        destination: `${endLat},${endLng}`,
        key: googleKey
    }

    const result = await axios.get(url, { params });
    const data = result.data;

    const polyline = data.routes[0]["overview_polyline"].points;
    const duration = data.routes[0].legs[0].duration.value;

    const returnResult = { polyline, duration };

    redisClient.set(`directions:${startLat},${startLng},${endLat},${endLng}`, JSON.stringify(returnResult), 'EX', 6 * 60 * 60 * 24);

    return returnResult;
}


module.exports = {
    getPredictions,
    geocode,
    getLocationFromPlaceId,
    getOptimalPath,
    getDirections
}