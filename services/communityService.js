const { Op } = require("sequelize");
const { Community, User, Ride, sequelize, RideCommunity } = require("../models");

async function createCommunity({ name, picture, description, private, uid }) {
    const community = Community.create({
        name: name,
        picture: picture,
        description: description,
        private: private,
        userId: uid
    });

    return community;
}

async function getCommunities({ page }) {
    const communities = await Community.findAll({
        limit: 3,
        offset: (page - 1) * 3
    });

    return communities;
}

async function getUserCommunities({ uid }) {
    const communitiesResult = await User.findByPk(uid, {
        attributes: [],
        include: [
            {
                model: Community,
                attributes: ['id', 'picture', 'name']
            }
        ]
    });
    return communitiesResult;
}

async function getUserFeed({ uid, page }) {
    const feed = await Ride.findAll({
        where: {
            datetime: {
                [Op.gt]: new Date(),
            },
        },
        attributes: [
            ['id', 'ride_id'],
            'mainTextFrom',
            'mainTextTo',
            'pricePerSeat',
            'datetime',
            [sequelize.literal('(SELECT COUNT(*) FROM passengers WHERE RideId = Ride.id)'), 'seatsOccupied']
        ],
        include: [
            {
                model: Community,
                through: {
                    model: RideCommunity,
                },
                attributes: [['name', 'community_name']],
                include: [
                    {
                        model: User,
                        where: {
                            id: uid,
                        },
                    },
                ],
            },
            {
                model: User,
                attributes: ['firstName', 'lastName'],
                as: 'Driver',
            },
        ],
        order: [['datetime', 'DESC']],
        limit: 3,
        offset: (page - 1) * 3
    })
    return feed;
}
module.exports = {
    createCommunity,
    getCommunities,
    getUserCommunities,
    getUserFeed
};