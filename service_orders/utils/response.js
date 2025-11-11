export const sendSuccess = (res, statusCode, data) => {
    res.status(statusCode).json({
        success: true,
        data: data,
    });
};

export const sendError = (res, statusCode, code, message) => {
    res.status(statusCode).json({
        success: false,
        error: {
            code: code,
            message: message,
        },
    });
};