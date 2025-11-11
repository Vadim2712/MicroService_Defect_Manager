import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const requestId = req.id;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn({ requestId }, 'Gateway Auth: Missing or invalid Bearer token');
        return sendError(res, 401, 'unauthorized', 'Missing or invalid Bearer token');
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        logger.info({ requestId, userId: decoded.id }, 'Gateway Auth: Token verified');
        next();
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Gateway Auth: Invalid token');
        return sendError(res, 401, 'unauthorized', 'Invalid token');
    }
};