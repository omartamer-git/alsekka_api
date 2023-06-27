class BadRequestError extends Error {
    constructor(message = 'Some required fields are missing/corrupt.') {
        super(message);
        this.status = 400;
    }
}

class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.status = 401;
    }
}

class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.status = 403;
    }
}

class NotFoundError extends Error {
    constructor(message = 'Not Found') {
        super(message);
        this.status = 404;
    }
}

class InternalServerError extends Error {
    constructor(message = 'Unexpected server error occurred. Please try again later.') {
        super(message);
        this.status = 500;
    }
}

class NotAcceptableError extends Error {
    constructor(message = 'Not Acceptable.') {
        super(message);
        this.status = 406;
    }
}

class ConflictError extends Error {
    constructor(message = 'Already in use.') {
        super(message);
        this.status = 409;
    }
}

module.exports = {
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    InternalServerError,
    NotAcceptableError,
    ConflictError
}