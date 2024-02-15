//Copy and paste this code in your Backend
let crypto = require('crypto');
function generateKashierOrderHash(passengerId, userId, grandTotal) {
    const mid = 'MID-123-123'; //your merchant id
    // const CustomerReference = '1'; //your customer id to save card

    // const amount = order.amount; //eg: 22.00
    // const currency = order.currency; //eg: "EGP"
    // const orderId = order.merchantOrderId; //eg: 99
    const secret = process.env.KASHIERSECRET;
    const path = `/?payment=${process.env.KASHIER_ID}.${passengerId}.${grandTotal}.EGP${userId ? ('.' + userId) : null}`;

    const hash = crypto.createHmac('sha256', secret).update(path).digest('hex');
    return hash;
}
//The Result Hash for /?payment=mid-0-1.99.20.EGP with secret 11111 should result 606a8a1307d64caf4e2e9bb724738f115a8972c27eccb2a8acd9194c357e4bec

module.exports = {
    generateKashierOrderHash
}