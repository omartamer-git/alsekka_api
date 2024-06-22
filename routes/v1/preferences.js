const express = require('express');
const { BadRequestError, InternalServerError } = require('../../errors/Errors');
const router = express.Router();
const { UserPreference } = require("../../models/index");
const { default: rateLimit } = require('express-rate-limit');
const { findPreferences, updateUserPreferences, createUserPreferences } = require('../../services/preferencesService');
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

    let preferences = findPreferences(userId);
    if (!preferences) {
      try {
        preferences = await createUserPreferences(userId);
      } catch (error) {
        console.error('Error creating user preferences:', error);
      }
    }

    return res.json(preferences);
  } catch (err) {
    return next(new InternalServerError())
  }
});

router.post('/:userId', async (req, res, next) => {
    try {
    const { userId } = req.params;
    const { smoking, chattiness, music, rest_stop } = req.body;

    let preferences = findPreferences(userId);
    if (!preferences) {
      try {
        preferences = await createUserPreferences(userId);
      } catch (error) {
        console.error('Error creating user preferences:', error);
      }
    } else {
      try {
        preferences = await updateUserPreferences(preferences, smoking, chattiness, music, rest_stop)
      } catch (error) {
        console.error('Error updating user preferences:', error);
      }
    }

    return res.json(preferences);
  } catch (error) {
    next(new InternalServerError());
  }
});

module.exports = router;