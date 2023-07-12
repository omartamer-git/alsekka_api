const { default: axios } = require("axios");

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
    console.log(data);
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


module.exports = {
    getPredictions,
    geocode,
    getLocationFromPlaceId
}