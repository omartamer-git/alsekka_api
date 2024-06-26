const express = require('express');
const { BadRequestError, InternalServerError } = require('../../errors/Errors');
const router = express.Router();
const { UserPreference } = require("../../models/index");
const { default: rateLimit } = require('express-rate-limit');
const { findPreferences, updateUserPreferences, createUserPreferences } = require('../../services/preferencesService');
const { authenticateToken } = require('../../middleware/authenticateToken');
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 6015 minutes
  max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);

router.get('/:UserId', authenticateToken, async (req, res, next) => {
  try {
    const { UserId } = req.params;
    if (!UserId) {
      return next(new BadRequestError());
    }

    let preferences = await findPreferences(UserId);
    if (!preferences) {
      try {
        preferences = await createUserPreferences(UserId);
      } catch (error) {
        return next(new BadRequestError());
      }
    }

    return res.json(preferences);
  } catch (err) {
    return next(new InternalServerError())
  }
});

router.put('/', authenticateToken, async (req, res, next) => {
  try {
    const UserId = req.user.userId;
    const { smoking, chattiness, music, rest_stop } = req.body;

    const preferences = await updateUserPreferences(preferences, smoking, chattiness, music, rest_stop)

    return res.json(preferences);
  } catch (error) {
    next(new InternalServerError());
  }
});

module.exports = router;