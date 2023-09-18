const { default: axios } = require("axios");
const { Ride, Passenger } = require("../models");
const { NotFoundError, UnauthorizedError } = require("../errors/Errors");
const { calculateDistance } = require("../util/util");

const googleKey = "AIzaSyDUNz5SYhR1nrdfk9TW4gh3CDpLcDMKwuw";

async function getPredictions(text) {
    let pred = [];
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = {
        input: text,
        key: googleKey,
        region: 'eg',
        language: 'en',
        locationbias: 'ipbias'
    };
    const result = await axios.get(url, { params });
    const data = result.data;
    for (let i = 0; i < data.predictions.length; i++) {
        pred.push([data.predictions[i].description, data.predictions[i].place_id]);
    }

    return pred;
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
        latitude: ride.fromLatitude,
        longitude: ride.fromLongitude
    };

    const intermediatePoints = [startingPoint];

    if (ride.pickupEnabled == 1) {
        for (const passenger of passengers) {
            if (passenger.pickupLocationLat && passenger.pickupLocationLng) {
                intermediatePoints.push({
                    passengerId: Passenger.UserId,
                    point: {
                        latitude: passenger.pickupLocationLat,
                        longitude: passenger.pickupLocationLng
                    }
                });
            }
        }
    }

    const pointsOrdered = [startingPoint];

    for(let i=0;i<intermediatePoints.length-1;i++) {
        const point = pointsOrdered[i];
        const pointsWithoutOriginalPoint = intermediatePoints.filter((p) => p !== point && !(pointsOrdered.find((e) => e === p)) );
        let minDistance = Number.MAX_SAFE_INTEGER;
        let minPoint = null;
        for(const point2 of pointsWithoutOriginalPoint) {
            const potentialMinDistance = calculateDistance(point.latitude, point.longitude, point2.latitude, point2.longitude);

            if(potentialMinDistance <= minDistance) {
                minDistance = potentialMinDistance;
                minPoint = point2;
            }
        }

        pointsOrdered.push(minPoint);
    }

    pointsOrdered.shift();
    const ordered = pointsOrdered.map(point => {
        return point.passengerId;
    });

    return ordered;
}


module.exports = {
    getPredictions,
    geocode,
    getLocationFromPlaceId,
    getOptimalPath
}