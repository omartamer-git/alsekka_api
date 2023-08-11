const { Sequelize, Op, literal } = require('sequelize');
const { Car, User, License } = require('../models');


async function getCars({uid, approved}) {
    const carsQuery = await Car.findAll({
        where: {
            UserId: uid,
            ...(approved && { status: 'APPROVED' }),
        },
    });

    return carsQuery;
}

async function newCar({uid, brand, year, model, color, licensePlateLetters, licensePlateNumbers, license_front, license_back}) {
    const newCar = await Car.create({
        UserId: uid,
        brand: brand,
        year: year,
        model: model,
        color: color,
        licensePlateLetters: licensePlateLetters,
        licensePlateNumbers: licensePlateNumbers,
        license_front: license_front,
        license_back: license_back
    });

    return newCar;
}

module.exports = {
    getCars,
    newCar
};