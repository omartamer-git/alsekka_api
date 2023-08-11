const { format } = require('url');


function uploadImage(file) {
    const util = require('util');
    const gc = require('./config/googlecloud.config');
    const bucket = gc.bucket('alsekka_profile_pics') // bucket name
    return (
        new Promise((resolve, reject) => {
            const { buffer } = file
            const extHelper = file.originalname.split('.');
            const originalname = crypto.randomUUID() + '.' + extHelper[extHelper.length - 1];

            const blob = bucket.file(originalname)
            const blobStream = blob.createWriteStream({
                resumable: false
            })
            blobStream.on('finish', () => {
                const publicUrl = format(
                    `https://storage.googleapis.com/${bucket.name}/${blob.name}`
                )
                resolve(publicUrl)
            }).on('error', (e) => {
                console.error(e);
                reject(`Unable to upload image, something went wrong`)
            }).end(buffer)
        })
    );
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function checkCardNumber(value) {
    const cardNumber = value.replace(/\s+/g, '').replace(/-/g, '');

    // Convert the card number into an array of digits
    const cardDigits = cardNumber.split('').map(Number);

    // Apply the Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cardDigits.length - 1; i >= 0; i--) {
        let digit = cardDigits[i];

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    // The card number is valid if the sum is divisible by 10
    return sum % 10 === 0;
}

function generateOtp() {
    // Generate a random number between 0 and 9999 (inclusive)
    const randomNumber = Math.floor(Math.random() * 10000);

    // Pad the number with leading zeros if necessary
    const paddedNumber = randomNumber.toString().padStart(4, '0');

    return paddedNumber;
}


function getCardDetails(card) {
    const typeIdentifier = card.cardNumber.charAt(0);
    let type = null;
    if (typeIdentifier == '2' || typeIdentifier == '5') {
        type = 'mastercard';
    } else if (typeIdentifier == '4') {
        type = 'visa';
    } else {
        type = 'other';
    }

    const finalNumbers = card.cardNumber.substring(12);
    const returnResult = {
        id: card.id,
        type: type,
        number: finalNumbers
    };
    return returnResult;
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}


module.exports = {
    isValidEmail,
    getCardDetails,
    checkCardNumber,
    generateOtp,
    addMinutes,
    uploadImage
};