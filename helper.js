function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function getCardDetails(card) {
    console.log(card);
    const typeIdentifier = card.cardNumber.charAt(0);
    let type = null;
    if(typeIdentifier == '2' || typeIdentifier == '5') {
        type = 'mastercard';
    } else if(typeIdentifier == '4') {
        type = 'visa';
    } else {
        type = 'other';
    }

    const finalNumbers = card.cardNumber.substring(12);
    const returnResult = {
        type: type,
        number: finalNumbers
    };
    return returnResult;
}

module.exports = {
    isValidEmail,
    getCardDetails,
};

// Status codes
// 100: Ride Complete
// 50: Ride Cancelled