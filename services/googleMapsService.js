const { default: axios } = require("axios");
const { Ride, Passenger } = require("../models");
const { NotFoundError, UnauthorizedError } = require("../errors/Errors");
const { calculateDistance, findOptimalPath } = require("../util/util");
const redis = require('ioredis');
const { GOOGLE_KEY, CITIES } = require("../config/seaats.config");

// const googleKey = "AIzaSyDUNz5SYhR1nrdfk9TW4gh3CDpLcDMKwuw";
const googleKey = GOOGLE_KEY;
const redisClient = new redis();

async function getPredictions(text, lat, lng, city) {
    // cairo LATLNG: 30.059482,31.2172648
    if (!lat || !lng) {
        lat = 30.059482;
        lng = 31.2172648;
    }

    const cachedData = await redisClient.get(`pred:${city}:${text}`);

    if (cachedData) {
        return {
            data: JSON.parse(cachedData)
        }
    }


    let cityCenter = `${CITIES[city].longitude},${CITIES[city].latitude}`;
    let radius = CITIES[city].radius;

    let pred = [];
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = {
        input: text,
        key: googleKey,
        //region: 'eg',
        language: 'en',
        //locationbias: `circle:1000@${lat},${lng}`,
        location: cityCenter,
        radius: radius,
        strictbounds: 'true',
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    for (let i = 0; i < data.predictions.length; i++) {
        pred.push([data.predictions[i].description, data.predictions[i].place_id]);
    }

    // cache for 2d
    redisClient.set(`pred:${city}:${text}`, JSON.stringify(pred), 'EX', 60 * 60 * 48)

    return {
        data: pred
    };
};

function getProperResultName(resultArr, j = 0) {
    let goodAddress;
    let i = 0;
    if (resultArr.length - 1 < j) {
        return resultArr[0].formatted_address.split(',')[0];
    }

    const returnResult = resultArr[j];
    for (let addressComponent of returnResult.address_components) {
        const types = addressComponent.types;
        if ('plus_code' in types) {
            i++;
            continue;
        }

        if ('street_number' in types) {
            goodAddress = addressComponent.long_name;
            goodAddress += ' ' + returnResult.address_components[i + 1];
            break;
        } else if ('route' in types) {
            goodAddress = addressComponent.long_name;
            break;
        } else {
            return getProperResultName(resultArr, j + 1);
        }
        i++;
    }

    return goodAddress;
}

async function geocode(latitude, longitude) {
    const cachedData = await redisClient.get(`geocode:${latitude},${longitude}`);

    if (cachedData) {
        return JSON.parse(cachedData);
    }

    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
        latlng: `${latitude},${longitude}`,
        key: googleKey,
        result_type: 'street_address|route|colloquial_area|neighborhood|airport|point_of_interest|park|intersection',
        componentRestrictions: {
            country: 'EG'
        }
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    const returnResult = data.results;

    // cache for 2 weeks
    redisClient.set(`geocode:${latitude},${longitude}`, JSON.stringify(returnResult[0]), 'EX', 14 * 60 * 60 * 24)

    return returnResult[0];
};



async function getLocationFromPlaceId(place_id) {
    const cachedData = await redisClient.get(`placeid:${place_id}`);

    if (cachedData) {
        return JSON.parse(cachedData);
    }

    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
        place_id: `${place_id}`,
        key: googleKey,
        componentRestrictions: {
            country: 'EG'
        }
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    const returnResult = data.results;


    const locationData = returnResult[0].geometry.location;
    const returnRes = { ...locationData, name: getProperResultName(returnResult) };

    // cache for 2 weeks
    redisClient.set(`placeid:${place_id}`, JSON.stringify(returnRes), 'EX', 14 * 60 * 60 * 24)

    return returnRes;

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

    if (cachedData) {
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