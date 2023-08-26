const { Op } = require("sequelize");
const { Community, User, Ride, sequelize, RideCommunity, CommunityMember } = require("../models");
const { BadRequestError, NotAcceptableError, NotFoundError, ConflictError, UnauthorizedError } = require("../errors/Errors");
const { uploadImage } = require("../helper");

async function createCommunity({ name, description, private, joinQuestion }, picture, uid) {
    const duplicateCommunity = await Community.findOne({
        where: {
            name: name
        }
    });

    if (duplicateCommunity !== null) {
        throw new ConflictError("Community with this name already exists.");
        return;
    }

    const imageUrl = await uploadImage(picture);
    const t = await sequelize.transaction();

    const community = await Community.create({
        name: name,
        picture: imageUrl,
        description: description,
        private: private,
        joinQuestion: joinQuestion || null,
        OwnerId: uid
    }, { transaction: t });

    const member = await CommunityMember.create({
        joinAnswer: 'Founder',
        joinStatus: 'APPROVED',
        UserId: uid,
        CommunityId: community.id
    }, { transaction: t });

    await t.commit();

    return community;
}

async function updateCommunity({ communityId, description, private, joinQuestion }, picture, uid) {
    const community = await Community.findByPk(communityId);

    if (community.OwnerId !== uid) {
        throw new UnauthorizedError();
    }

    let imageUrl = community.picture;

    if (picture) {
        imageUrl = await uploadImage(picture);
    }

    community.description = description;
    community.private = private;
    community.joinQuestion = private === 1 ? joinQuestion : null;
    community.picture = imageUrl;

    community.save();

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
                as: 'Communities',
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
        attributes: ['OwnerId', 'joinQuestion'],
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

    if (communityDetails === null) {
        throw new NotFoundError("Community not found");
    }

    return communityDetails;
}

async function getUserFeed({ uid, communityId, page }) {
    const feed = await
        Ride.findAll({
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
                [sequelize.literal('(SELECT SUM(seats) FROM passengers WHERE RideId = Ride.id AND status != "CANCELLED")'), 'seatsOccupied']
            ],
            include: [{
                model: Community,
                required: true,
                attributes: [['name', 'community_name']],
                include: [{
                    model: User,
                    required: true,
                    as: 'Member',
                    attributes: [],
                    where: {
                        id: uid
                    }
                }]
            },
            {
                model: User,
                as: 'Driver',
                required: true,
                attributes: ['firstName', 'lastName'],
            }
            ],
            order: [['datetime', 'DESC']],
            limit: 3,
            offset: (page - 1) * 3
        });


    return feed;
}

async function leaveCommunity({ communityId }, uid) {
    const member = await CommunityMember.findOne({
        where: {
            CommunityId: communityId,
            UserId: uid,
            joinStatus: 'APPROVED'
        }
    });

    if (!member) {
        throw new UnauthorizedError();
    }

    member.destroy();
}

async function getCommunityMembers({ communityId }, uid) {
    try {
        const community = await Community.findByPk(communityId);

        if (community.OwnerId !== uid) {
            throw new UnauthorizedError();
        }
        console.log(community);
        const members = await CommunityMember.findAll({
            attributes: ['id', 'joinAnswer'],
            where: {
                CommunityId: communityId,
                joinStatus: 'PENDING'
            },
            include: {
                model: User,
                attributes: ['firstName', 'lastName', 'profilePicture']
            },
            order: [['createdAt', 'DESC']]
        });

        return members;
    } catch (e) {
        console.error(e.stack);
    }
}

async function acceptCommunityMember({ memberId }, uid) {
    const member = await CommunityMember.findByPk(memberId);

    const community = await Community.findByPk(member.CommunityId, {
        attributes: ['OwnerId']
    });

    if (community.OwnerId !== uid) {
        throw new UnauthorizedError();
    }

    member.joinStatus = 'APPROVED';
    member.save();
}

async function rejectCommunityMember({ memberId }, uid) {
    const member = await CommunityMember.findByPk(memberId);

    const community = await Community.findByPk(member.CommunityId, {
        attributes: ['OwnerId']
    });

    if (community.OwnerId !== uid) {
        throw new UnauthorizedError();
    }

    member.joinStatus = 'REJECTED';
    member.save();
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
    if (community === null) {
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
    joinCommunity,
    updateCommunity,
    leaveCommunity,
    getCommunityMembers,
    acceptCommunityMember,
    rejectCommunityMember
};