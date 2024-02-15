//Copy and paste this code in your Backend
let crypto = require('crypto');
function generateKashierOrderHash(passengerId, userId, grandTotal) {
    console.log(passengerId);
    console.log(userId);
    console.log(grandTotal);
    console.log(hash);
    const secret = process.env.KASHIERAPIKEY;
    const path = `/?payment=${process.env.KASHIER_ID}.${passengerId}.${grandTotal}.EGP${userId ? ('.' + userId) : null}`;

    const hash = crypto.createHmac('sha256', secret).update(path).digest('hex');
    return hash;
}

module.exports = {
    generateKashierOrderHash
}