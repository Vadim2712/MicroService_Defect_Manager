export const sendError = (res, statusCode, code, message) => {
    res.status(statusCode).json({
        success: false,
        error: {
            code: code,
            message: message,
        },
    });
};