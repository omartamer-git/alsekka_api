const express = require('express');
const { authenticateToken } = require('../../middleware/authenticateToken');
const { BadRequestError, NotFoundError, InternalServerError } = require('../../errors/Errors');
const router = express.Router();
const { UserPreference } = require("../../models/index");
const { default: rateLimit } = require('express-rate-limit');
const userpreferences = require('../../models/userpreferences');
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 6015 minutes
    max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);

router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return next(new BadRequestError());
    }
  
    const preferences = await UserPreference.findOne({ where: {userId}});
    if(!preferences) {
      return next(new NotFoundError());
    }
    return res.status(200).json(preferences);
  } catch (err) {
    return next(new InternalServerError())
  }
});

router.post('/:userId', async (req, res, next) => {
    try {
    const { userId } = req.params;
    const { smoking, chattiness, music, rest_stop } = req.body;

    let preferences = await UserPreference.findOne({ where: { userId } });
    if (!preferences) {
      preferences = await UserPreference.create({ userId, smoking, chattiness, music, rest_stop });
    } else {
      preferences.smoking = smoking;
      preferences.chattiness = chattiness;
      preferences.music = music;
      preferences.rest_stop = rest_stop;
      await preferences.save();
    }

    res.json(preferences);
  } catch (error) {
    next(new InternalServerError());
  }
});

module.exports = router;