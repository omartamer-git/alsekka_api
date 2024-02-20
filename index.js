const express = require("express");
const config = require("./config");
const multer = require('multer');
const userService = require("./services/userService");
const appService = require("./services/appService");
const cookieParser = require("cookie-parser");
const { authenticateToken } = require("./middleware/authenticateToken");
const session = require("express-session");
const { BadRequestError, NotAcceptableError, InternalServerError } = require("./errors/Errors");
const { default: axios } = require("axios");
const { REFERRALS_DISABLED, ALLOWED_EMAILS, LATEST_APP_VERSION, MINIMUM_APP_VERSION } = require("./config/seaats.config");
const cron = require('node-cron');
require('dotenv').config()

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});


const app = express();
const multerMid = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
})

app.disable('x-powered-by')
app.use(multerMid.any());
app.use(express.json());
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(session({
    secret: 'seschret_password_goes_brazy',
    resave: false,
    saveUninitialized: true,
}));
app.use(
    express.urlencoded({
        extended: true,
    })
);

const carRoutes = require('./routes/v1/car');
const chatRoutes = require('./routes/v1/chat');
const communityRoutes = require('./routes/v1/community');
const mapsRoutes = require('./routes/v1/maps');
const rideRoutes = require('./routes/v1/ride');
const staffRoutes = require('./routes/v1/staff');
const paymentRoutes = require('./routes/v1/payment');
const userRoutes = require('./routes/v1/user');
const locationRoutes = require('./routes/v1/location');
const { default: rateLimit } = require("express-rate-limit");
const { Ride, Passenger } = require("./models");
const { subtractDates } = require("./helper");
const { Op } = require("sequelize");
const { cancelRide } = require("./services/rideService");

const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// v1 API
app.use('/v1/car', carRoutes);
app.use('/v1/chat', chatRoutes);
app.use('/v1/community', communityRoutes);
app.use('/v1/map', mapsRoutes);
app.use('/v1/ride', rideRoutes);
app.use('/v1/staff', staffRoutes);
app.use('/v1/payment', paymentRoutes);
app.use('/v1/user', userRoutes);
app.use('/v1/location', locationRoutes);
app.use('/v1/geojson', express.static('geojsons'));

app.get("/version", async (req, res, next) => {
    res.json({
        current: LATEST_APP_VERSION,
        min: MINIMUM_APP_VERSION
    });
});

app.post("/driverenrollment", async (req, res, next) => {
    const { fullName, phoneNumber, carDescription, token } = req.body;

    if (!fullName || !phoneNumber || !carDescription || !token) {
        return next(new BadRequestError());
    }

    let url = 'https://www.google.com/recaptcha/api/siteverify';
    const body = {
        secret: '',
        response: token,
    }
    const params = new URLSearchParams();
    params.append('secret', '6Ldcm9QnAAAAAAAmQlXVhwQ_R_l3KdY5nCrYDmX5');
    params.append('response', token);

    const { data } = await axios.post(url, params,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );
    if (data.success != true) {
        return next(new NotAcceptableError());
    }

    appService.addEnrolledDriver(req.body).then(() => {
        return res.json({ success: 1 });
    }).catch(next);
});

app.get("/waitinglist", async (req, res, next) => {
    const { email } = req.query;

    if (!email) {
        return next(new BadRequestError());
    }

    appService.addToMailingList(req.query).then(() => {
        return res.status(200).send();
    }).catch(next);
})

app.get("/allowedemails", async (req, res, next) => {
    res.status(200).send(ALLOWED_EMAILS);
});


app.get("/otpcallback", async (req, res, next) => {
    if (req.query.Secret !== "13053a5e941fd14089aa0fe0138fddbedefcce22168e1d01f2da199ad09e8d38") {
        return next(new InternalServerError());
    }

    userService.verifyUser(req.query.Mobile.substring(1));

    res.status(200).json({});
});

app.get("/announcements", authenticateToken, async (req, res, next) => {
    const announcementId = req.query?.id;
    const active = req.query?.active;

    if (!announcementId && !active) {
        return next(new BadRequestError());
    }

    if (announcementId) {
        appService.getAnnouncement(announcementId).then(announcement => {
            return res.json(announcement);
        }).catch(next);
    } else {
        appService.getAnnouncements(active).then(announcements => {
            return res.json(announcements);
        }).catch(next);
    }
});

app.get("/registerdevice", async (req, res, next) => {
    const { token, platform } = req.query;
    if (!token || !platform) {
        return next(new BadRequestError());
    }

    appService.registerDevice(req.query);
    res.status(200).send();
});

cron.schedule('*/5 * * * *', () => {
    const oneHourPrior = subtractDates(new Date(), 1);
    Ride.findAll({
        where: {
            status: 'SCHEDULED',
            datetime: {
                [Op.lte]: oneHourPrior
            }
        }
    }).then(async rides => {
        const rideIds = rides.map(r => r.id);

        for (const rid of rideIds) {
            await cancelRide({ tripId: rid });
        }
    }).catch(err => {
        console.log("[FAIL] FAILED TO RUN CRON JOB\nReason: ", err);
    });

    // Find rides that are 10 minutes late also and alert staff
});

cron.schedule('*/15 * * * *', () => {
    const fifteenMinutesPrior = subtractDates(new Date(), 0.25);
    Passenger.findAll({
        where: {
            status: 'AWAITING_PAYMENT',
            updatedAt: {
                [Op.lte]: fifteenMinutesPrior
            }
        }
    }).then(async passengers => {
        const passengerIds = passengers.map(r => r.id);

        // Need to rollback passenger to previous state instead of cancelling in case of update
        await Passenger.update({ status: 'PAYMENT_FAILED' }, { where: { id: passengerIds } });
    }).catch(err => {
        console.log("[FAIL] FAILED TO RUN CRON JOB\nReason: ", err);
    });

    // Find rides that are 10 minutes late also and alert staff
});


app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        error: {
            message: err.message,
            message_ar: err.message_ar || "حدث خطأ غير متوقع"
        },
    });
});

app.listen(config.app.port, () => {
    console.log(`API listening at http://localhost:${config.app.port}`);
});
