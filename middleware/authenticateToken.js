const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth.config');
const { UnauthorizedError } = require('../errors/Errors');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next(new UnauthorizedError());
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      next(new UnauthorizedError());
    }

    req.user = user;
    // console.log(user);
    next();
  });
};

module.exports = authenticateToken;