const { default: axios } = require("axios");
const { Ride, Passenger } = require("../models");
const { NotFoundError, UnauthorizedError } = require("../errors/Errors");
const { calculateDistance, findOptimalPath } = require("../util/util");

// const googleKey = "AIzaSyDUNz5SYhR1nrdfk9TW4gh3CDpLcDMKwuw";
const googleKey = "AIzaSyDgtya731fBmhzsGJGmcJq9fVwkUQ45e1c";
async function getPredictions(text, lat, lng) {
    // cairo LATLNG: 30.059482,31.2172648
    if(!lat || !lng) {
        lat = 30.059482;
        lng = 31.2172648;
    }
    const sessiontoken = crypto.randomUUID();
    let pred = [];
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = {
        input: text,
        key: googleKey,
        region: 'eg',
        language: 'en',
        locationbias: `circle:100000@${lat},${lng}`,
        sessiontoken: sessiontoken
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    for (let i = 0; i < data.predictions.length; i++) {
        pred.push([data.predictions[i].description, data.predictions[i].place_id]);
    }

    return {
        sessiontoken: sessiontoken,
        data: pred
    };
};

async function geocode(latitude, longitude) {
    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
        latlng: `${latitude},${longitude}`,
        key: googleKey
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    return data.results[0];
};

async function getLocationFromPlaceId(place_id) {
    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = {
        place_id: place_id,
        key: googleKey
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    return data.result.geometry.location;
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
    const url = 'https://maps.googleapis.com/maps/api/directions/json';
    const params = {
        origin: `${startLat},${startLng}`,
        destination: `${endLat},${endLng}`,
        key: googleKey
    }

    const result = await axios.get(url, {params});
    const data = result.data;

    const polyline = data.routes[0]["overview_polyline"].points;
    const duration = data.routes[0].legs[0].duration.value;
    
    return {polyline, duration};
}


module.exports = {
    getPredictions,
    geocode,
    getLocationFromPlaceId,
    getOptimalPath,
    getDirections
}