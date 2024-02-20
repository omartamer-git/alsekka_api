class BadRequestError extends Error {
    constructor(message = 'Some required fields are missing/corrupt', message_ar = 'بعض المعلومات المطلوبة مفقودة/تالفة') {
        super(message);
        this.message_ar = message_ar;
        this.status = 400;
    }
}

class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized action', message_ar = 'إجراء غير مصرح به') {
        super(message);
        this.message_ar = this.message_ar;
        this.status = 401;
    }
}

class ForbiddenError extends Error {
    constructor(message = 'Forbidden action', message_ar='الإجراء المحظور') {
        super(message);
        this.message_ar = this.message_ar;
        this.status = 403;
    }
}

class NotFoundError extends Error {
    constructor(message = 'Not Found', message_ar='لم يتم العثور على العنصر') {
        super(message);
        this.message_ar = this.message_ar;
        this.status = 404;
    }
}

class InternalServerError extends Error {
    constructor(message = 'Unexpected error occurred, please try again later', message_ar='حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى في وقت لاحق') {
        super(message);
        this.message_ar = this.message_ar;
        this.status = 500;
    }
}

class NotAcceptableError extends Error {
    constructor(message = 'Not Acceptable', message_ar='غير مقبول') {
        super(message);
        this.message_ar = this.message_ar;
        this.status = 406;
    }
}

class ConflictError extends Error {
    constructor(message = 'Already in use', message_ar='قيد الاستخدام بالفعل') {
        super(message);
        this.message_ar = this.message_ar;
        this.status = 409;
    }
}

class GoneError extends Error {
    constructor(message = 'Resource Gone', message_ar='انتهى المورد') {
        super(message);
        this.message_ar = this.message_ar;
        this.status = 410;
    }
}

module.exports = {
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    InternalServerError,
    NotAcceptableError,
    ConflictError,
    GoneError
}