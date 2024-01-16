const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const communityService = require("../../services/communityService");
const { default: rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);

router.post("/createcommunity", authenticateToken, async (req, res, next) => {
    const { name, description, private, joinQuestion } = req.body;
    const file = req.files[0];
    const uid = req.user.userId;

    if (!file || !name || !description || !private || (private === 1 && !joinQuestion)) {
        return next(new BadRequestError());
    }


    communityService.createCommunity({ name, description, private, joinQuestion }, file, uid).then(community => {
        return res.json({ success: 1 });
    }).catch(next);
});

router.patch("/updatecommunity", authenticateToken, async (req, res, next) => {
    const { communityId, description, private, joinQuestion } = req.body;
    const file = req.files[0];
    const uid = req.user.userId;

    if (!communityId || !description || !private || (private == 1 && !joinQuestion)) {
        return next(new BadRequestError());
    }

    communityService.updateCommunity(req.body, file, uid).then(community => {
        return res.json({ success: 1 });
    }).catch(next);
});

router.get("/communities", authenticateToken, async (req, res, next) => {
    communityService.getCommunities().then(communities => {
        res.json(communities);
    }).catch(next);
});

router.patch("/leavecommunity", authenticateToken, async (req, res, next) => {
    const { communityId } = req.body;

    if (!communityId) {
        return next(new BadRequestError());
    }

    const uid = req.user.userId;

    communityService.leaveCommunity(req.body, uid).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

router.get("/mycommunities", authenticateToken, async (req, res, next) => {
    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    communityService.getUserCommunities({ uid, ...req.query }).then(communities => {
        return res.json(communities.Communities);
    }).catch(next);
});

router.get("/communitydetails", authenticateToken, async (req, res, next) => {
    const { communityId } = req.query;
    const uid = req.user.userId;

    if (!communityId || !uid) {
        return next(new BadRequestError());
    }

    communityService.getCommunityDetails({ communityId, uid, ...req.query }).then(community => {
        return res.json(community);
    }).catch(next);
});

router.get("/communitymembers", authenticateToken, async (req, res, next) => {
    const { communityId } = req.query;

    if (!communityId) {
        return next(new BadRequestError());
    }

    communityService.getCommunityMembers(req.query, req.user.userId).then(members => res.json(members)).catch(next);
});

router.patch("/acceptmember", authenticateToken, async (req, res, next) => {
    const { memberId } = req.body;
    if (!memberId) {
        return next(new BadRequestError());
    }

    communityService.acceptCommunityMember(req.body, req.user.userId).then(() => res.json({ success: 1 })).catch(next);
});

router.patch("/rejectmember", authenticateToken, async (req, res, next) => {
    const { memberId } = req.body;
    if (!memberId) {
        return next(new BadRequestError());
    }

    communityService.rejectCommunityMember(req.body, req.user.userId).then(() => res.json({ success: 1 })).catch(next);
});

router.get("/myfeed", authenticateToken, async (req, res, next) => {
    let { page } = req.query;
    if (!page) { req.query.page = 1; }

    const uid = req.user.userId;

    if (!uid) {
        return next(new BadRequestError());
    }

    communityService.getUserFeed({ uid, ...req.query }).then(feed => {
        return res.json(feed);
    }).catch(err => {
        console.error(err);
        return next(err);
    });
});

router.get("/searchcommunities", authenticateToken, async (req, res, next) => {
    const { name, page } = req.query;

    if (!name) {
        return next(new BadRequestError());
    }
    if (!page) {
        req.query.page = 1;
    }

    communityService.searchCommunities({ name, ...req.query }).then(searchResult => {
        return res.json(searchResult);
    }).catch(next);
});

router.post("/joincommunity", authenticateToken, async (req, res, next) => {
    const { communityId, answer } = req.body;
    const uid = req.user.userId;

    if (!uid || !communityId) {
        return next(new BadRequestError());
    }

    communityService.joinCommunity({ uid, communityId, answer, ...req.body }).then(joinResult => {
        return res.json(joinResult);
    }).catch(next);
});


module.exports = router;
