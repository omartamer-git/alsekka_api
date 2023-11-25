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
const { REFERRALS_DISABLED, ALLOWED_EMAILS } = require("./config/seaats.config");
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
const userRoutes = require('./routes/v1/user');
const { default: rateLimit } = require("express-rate-limit");

const limiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 6015 minutes
	max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);

// v1 API
app.use('/v1/car', carRoutes);
app.use('/v1/chat', chatRoutes);
app.use('/v1/community', communityRoutes);
app.use('/v1/map', mapsRoutes);
app.use('/v1/ride', rideRoutes);
app.use('/v1/staff', staffRoutes);
app.use('/v1/user', userRoutes);


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

app.get("/allowedemails", async(req, res, next) => {
    res.status(200).send(ALLOWED_EMAILS);
});


app.get("/otpcallback", async (req, res, next) => {
    if (req.query.Secret !== "13053a5e941fd14089aa0fe0138fddbedefcce22168e1d01f2da199ad09e8d38") {
        return next(new InternalServerError("Invalid Request"));
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


app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        error: {
            message: err.message,
        },
    });
});

app.listen(config.app.port, () => {
    console.log(`API listening at http://localhost:${config.app.port}`);
});
