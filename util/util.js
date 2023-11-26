const geolib = require('geolib');

function calculateDistance(pointA, pointB) {
    return geolib.getDistance(pointA, pointB);
}

function calculateTotalDistance(points) {
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const pointA = points[i].point;
        const pointB = points[i + 1].point;
        totalDistance += calculateDistance(pointA, pointB);
    }

    return totalDistance;
}

function generatePermutations(arr) {
    const permutations = [];

    function permute(arr, m = []) {
        if (arr.length === 0) {
            permutations.push(m);
        } else {
            for (let i = 0; i < arr.length; i++) {
                const curr = arr.slice();
                const next = curr.splice(i, 1);
                permute(curr.slice(), m.concat(next));
            }
        }
    }

    permute(arr);
    return permutations;
}

function findOptimalPath(startingPoint, destinationPoints) {
    const allPermutations = generatePermutations(destinationPoints);

    let optimalPath = [];
    let minDistance = Infinity;

    for (const permutation of allPermutations) {
        const orderedPoints = [startingPoint, ...permutation];
        const currentDistance = calculateTotalDistance(orderedPoints);

        if (currentDistance < minDistance) {
            minDistance = currentDistance;
            optimalPath = permutation.map(point => point.passengerId);
        }
    }

    return optimalPath;
}


function dateDiffInDays(a, b) {
    const _MS_PER_DAY = 1000 * 60 * 60 * 24;
    // Discard the time and time-zone information.
    const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

    return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

function isFloat(value) {
    return (!isNaN(value) && value.toString().indexOf('.') != -1);
}

module.exports = {
    findOptimalPath,
    isFloat,
    dateDiffInDays
}