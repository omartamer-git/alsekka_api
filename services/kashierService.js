//Copy and paste this code in your Backend
let crypto = require('crypto');
function generateKashierOrderHash(passengerId, userId, grandTotal) {
    const secret = process.env.KASHIERAPIKEY;
    const path = `/?payment=${process.env.KASHIER_ID}.${passengerId}.${Math.ceil(grandTotal/100)}.EGP${userId ? ('.' + userId) : null}`;

    const hash = crypto.createHmac('sha256', secret).update(path).digest('hex');
    return hash;
}

function generateKashierDriverSettlementHash(userId, grandTotal) {
    const secret = process.env.KASHIERAPIKEY;
    const path = `/?payment=${process.env.KASHIER_ID}.${userId}.${Math.ceil(grandTotal/100)}.EGP${userId ? ('.' + userId) : null}`;

    const hash = crypto.createHmac('sha256', secret).update(path).digest('hex');
    return hash;
}

module.exports = {
    generateKashierOrderHash,
    generateKashierDriverSettlementHash
}