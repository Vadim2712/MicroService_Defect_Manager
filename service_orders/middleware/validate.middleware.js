import { sendError } from '../utils/response.js';

export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (e) {
        const errorMessages = e.errors.map((err) => err.message).join(', ');
        sendError(res, 400, 'validation_error', errorMessages);
    }
};