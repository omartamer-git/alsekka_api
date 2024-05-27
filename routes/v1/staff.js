const express = require('express');
const { authenticateToken, sessionChecker } = require('../../middleware/authenticateToken');
const { BadRequestError } = require('../../errors/Errors');
const router = express.Router();
const staffService = require("../../services/staffService");
const rideService = require("../../services/rideService");

router.post("/login", async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return next(new BadRequestError());
    }

    staffService.staffLogin(req.body).then(response => {
        req.session.profile = { loggedIn: true };
        res.send("{}");
    }).catch(next);
});

router.get("/session", sessionChecker, async (req, res, next) => {
    res.json({ success: 1 });
});

router.get("/searchuser", sessionChecker, async (req, res, next) => {
    const { phone } = req.query;

    if (!phone) {
        return next(new BadRequestError());
    }

    staffService.findUser(req.query).then(user => {
        res.json(user);
    }).catch(next);
});

router.get("/userrides", sessionChecker, async (req, res, next) => {
    let { uid, page } = req.query;

    if (!uid) {
        return next(new BadRequestError());
    }

    if (!page) {
        page = 1;
    }

    const limit = 8;
    const offset = (page - 1) * limit;
    const after = null;
    rideService.getPastRides({ uid, limit, after, offset }).then(rides => {
        res.json(rides);
    }).catch(next);
});

router.post("/updateuser", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    staffService.updateUser(req.body).then(newUser => res.json(newUser)).catch(next);
});

router.get("/userlicenses", sessionChecker, async (req, res, next) => {
    if (!req.query.uid) {
        return next(new BadRequestError());
    }

    staffService.customerLicenses(req.query).then(licenses => {
        res.json(licenses);
    }).catch(next);
});

router.post("/updatelicense", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    staffService.updateLicense(req.body).then(license => {
        res.json(license);
    }).catch(next);
});

router.get("/pendinglicenses", sessionChecker, async (req, res, next) => {
    staffService.getPendingLicenses().then(licenses => {
        res.json(licenses);
    }).catch(next);
});

router.post("/updatecar", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    staffService.updateCar(req.body).then(car => {
        res.json(car);
    }).catch(next);
});

router.get("/pendingcars", sessionChecker, async (req, res, next) => {
    staffService.getPendingCars().then(cars => {
        res.json(cars);
    }).catch(next);
});

router.get("/members", sessionChecker, async (req, res, next) => {
    staffService.getMembers().then(members =>
        res.json(members)
    ).catch(next);
});

router.post("/createuser", sessionChecker, async (req, res, next) => {
    const { username, password, phone, role } = req.body;
    if (!username || !password || !phone || !role) {
        return next(new BadRequestError());
    }

    staffService.createStaffMember(req.body).then(() => {
        res.json({ success: true });
    }).catch((err) => {
        console.error(err);
    });
});

router.get("/memberdetails", sessionChecker, async (req, res, next) => {
    const { id } = req.query;
    if (!id) {
        next(new BadRequestError());
    }

    staffService.getStaffMember(req.query).then(member => {
        res.json(member);
    }).catch(next);
});

router.post("/editmember", sessionChecker, async (req, res, next) => {
    if (!req.body.id) {
        return next(new BadRequestError());
    }

    staffService.editStaffMember(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

router.get("/announcements", sessionChecker, async (req, res, next) => {
    staffService.getAllAnnouncements().then(ann => {
        res.json(ann);
    }).catch(next);
});

router.post("/updateannouncement", sessionChecker, async (req, res, next) => {
    const { id } = req.body;
    if (!id) {
        return next(new BadRequestError());
    }

    staffService.updateAnnouncement(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

router.post("/createannouncement", sessionChecker, async (req, res, next) => {
    const { title_en, title_ar, text_en, text_ar, from, to, active } = req.body;

    if (!title_en || !title_ar || !text_en || !text_ar || !from || !to || !active) {
        next(new BadRequestError());
    }

    staffService.createAnnouncement(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

router.get("/ride", sessionChecker, async (req, res, next) => {
    if (!req.query.id) {
        return next(new BadRequestError());
    }

    staffService.getFullRide(req.query).then(ride => {
        res.json(ride);
    }).catch(next);
});

router.post("/cancelride", sessionChecker, async (req, res, next) => {
    const { id } = req.body;
    if (!id) {
        return next(new BadRequestError());
    }

    staffService.cancelRide(req.body).then(() => {
        res.json({ success: 1 });
    }).catch(next);
});

module.exports = router;
