const { Op, Sequelize } = require("sequelize");
const { Community, User, Ride, sequelize, RideCommunity, CommunityMember } = require("../models");
const { BadRequestError, NotAcceptableError, NotFoundError, ConflictError, UnauthorizedError } = require("../errors/Errors");
const { uploadImage } = require("../helper");
const { sendNotificationToUser } = require("./appService");

async function createCommunity({ name, description, private, joinQuestion }, picture, uid) {
    const duplicateCommunity = await Community.findOne({
        where: {
            name: name
        }
    });

    if (duplicateCommunity !== null) {
        throw new ConflictError("Community with this name already exists", "المجتمع بهذا الاسم موجود مسبقاً");
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
    if (private == 0) {
        await CommunityMember.update({ joinStatus: 'APPROVED' }, {
            where: {
                CommunityId: communityId
            }
        });
    }
    community.joinQuestion = private == 1 ? joinQuestion : null;
    community.picture = imageUrl;

    community.save();

    return community;
}
const redis = require('ioredis');
const redisClient = new redis();

async function findTrending(date) {
    const trendingMembers = await CommunityMember.findAll({
        attributes: ['CommunityId'],
        where: {
            createdAt: {
                [Sequelize.Op.gte]: date
            }
        },
        order: [[Sequelize.literal('COUNT(id)'), 'DESC']],
        group: ['CommunityId'],
        limit: 3
    });

    const ids = trendingMembers.map(c => c.CommunityId);

    const coms = await Community.findAll({
        where: {
            id: {
                [Op.in]: ids
            }
        }
    });

    return coms;
}

async function getCommunities() {
    try {
        const cachedData = await redisClient.get(`communities:trending`);
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        const weekAgo = new Date();
        const limit = 3;
        weekAgo.setDate(weekAgo.getDate() - 21);

        let coms = await findTrending(weekAgo);

        if (coms.length < limit) {
            coms = await findTrending(new Date(2023, 1, 1));
        }

        redisClient.set('communities:trending', JSON.stringify(coms), 'EX', 60 * 60 * 24);
        return coms;
    } catch (error) {
        console.error('Error getting recommended communities:', error);
        throw error;
    }
}

async function getUserCommunities({ uid }) {
    const communityMembers = await CommunityMember.findAll({
        where: {
            UserId: uid,
            joinStatus: 'APPROVED'
        }
    });

    const communityIds = communityMembers.map(mem => mem.CommunityId);

    const communities = await Community.findAll({
        where: {
            id: {
                [Op.in]: communityIds
            }
        },
        attributes: ['id', 'picture', 'name']
    })

    return { Communities: communities };
}

async function getCommunityDetails({ communityId, uid }) {
    const communityDetails = await Community.findOne({
        where: {
            id: communityId
        },
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
        throw new NotFoundError("Community not found", "لم يتم العثور على هذا المجتمع");
    }

    return communityDetails;
}

async function getUserFeed({ uid, communityId, page }) {
    const whereCondition = {
        datetime: {
            [Op.gt]: new Date(),
        },
        status: {
            [Op.not]: 'CANCELLED',
        }
    };

    if (communityId !== null) {
        whereCondition.CommunityId = communityId;
    }

    const feed = await Ride.findAll({
        where: whereCondition,
        attributes: [
            ['id', 'ride_id'],
            'mainTextFrom',
            'mainTextTo',
            'pricePerSeat',
            'datetime',
            'duration',
            'DriverId',
            'pickupEnabled',
            'gender',
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

async function checkUserInCommunity(UserId, CommunityId) {
    const cm = await CommunityMember.findOne({
        where: {
            UserId: UserId,
            CommunityId: CommunityId,
            joinStatus: 'APPROVED'
        }
    });

    return cm !== null;
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
        const ownerId = community.OwnerId;

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
    rejectCommunityMember,
    checkUserInCommunity
};