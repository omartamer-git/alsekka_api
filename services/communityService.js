const { Op } = require("sequelize");
const { Community, User, Ride, sequelize, RideCommunity, CommunityMember } = require("../models");
const { BadRequestError, NotAcceptableError, NotFoundError, ConflictError } = require("../errors/Errors")

async function createCommunity({ name, picture, description, private, uid }) {
    const duplicateCommunity = Community.findOne({
        where: {
            name: name
        }
    });
    if(duplicateCommunity !== null) {
        throw new ConflictError("Community with this name already exists.");
        return;
    }
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

async function getCommunityDetails({ communityId, uid }) {
    const communityDetails = await Community.findOne({
        where: {
            id: communityId
        },
        attributes: ['joinQuestion'],
        include: [
            {
                model: User,
                as: 'Member',
                where: {
                    id: uid
                },
                required: false
            }
        ]
    });

    if(communityDetails === null) {
        throw new NotFoundError("Community not found");
    }

    return communityDetails;
}

async function getUserFeed({ uid, communityId, page }) {
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
                    where: communityId ? { CommunityId: communityId } : undefined
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

async function searchCommunities({ name, page }) {
    const communities = await Community.findAll({
        where: {
            name: {
                [Op.like]: `%${name}%`
            }
        },
        limit: 5,
        offset: (page - 1) * 5
    });

    return communities;
}

async function joinCommunity({ uid, communityId, answer }) {
    const community = await Community.findByPk(communityId);
    if(community === null) {
        throw new NotFoundError();
    }
    if (community.private) {
        if (!answer) {
            throw new BadRequestError();
        }
        const member = await CommunityMember.create({
            joinAnswer: answer,
            joinStatus: 'PENDING',
            UserId: uid,
            CommunityId: communityId
        });
        return member;
    } else {
        const joinRequest = await CommunityMember.create({
            UserId: uid,
            CommunityId: communityId,
            joinStatus: 'APPROVED'
        });
        return joinRequest;
    }
}

module.exports = {
    createCommunity,
    getCommunities,
    getUserCommunities,
    getUserFeed,
    searchCommunities,
    getCommunityDetails,
    joinCommunity
};