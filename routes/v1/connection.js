const express = require('express');
const router = express.Router();
const { default: rateLimit } = require('express-rate-limit');
const { authenticateToken } = require('../../middleware/authenticateToken')
const { findSecondDegreeConnections  } = require('../../services/connectionService');
const { InternalServerError, BadRequestError } = require('../../errors/Errors');
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 6015 minutes
  max: 450, // Limit each IP to 450 requests per `window` (here, per 60 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(limiter);

router.get('/second-degree-connections', authenticateToken ,async (req, res, next) => {
  const { user1Id, user2Id } = req.query;

  try {
    if (!user1Id || !user2Id) {
      return next(new BadRequestError("user1Id and user2Id query parameters are required", "معلمات استعلام للمستخدم الأول و الثاني مطلوبة"))
    }
    console.log('users data here', user1Id, user2Id)
    const response = await findSecondDegreeConnections(user1Id, user2Id);
    return res.json(response);
  } catch (error) {
    return next(new InternalServerError())
  }
});

module.exports = router;