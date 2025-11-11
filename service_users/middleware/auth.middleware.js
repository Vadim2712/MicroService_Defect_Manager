import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const requestId = req.id;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn({ requestId }, 'Auth middleware: Missing or invalid Bearer token');
        return sendError(res, 401, 'unauthorized', 'Missing or invalid Bearer token');
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        logger.info({ requestId, userId: decoded.id, roles: decoded.roles }, 'Auth middleware: Token verified');
        next();
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Auth middleware: Invalid token');
        return sendError(res, 401, 'unauthorized', 'Invalid token');
    }
};

export const authorize = (allowedRoles) => (req, res, next) => {
    const requestId = req.id;
    if (!req.user || !req.user.roles) {
        logger.warn({ requestId }, 'Auth middleware: No user roles found for authorization');
        return sendError(res, 403, 'forbidden', 'Access denied. No roles found.');
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));

    if (!hasRole) {
        logger.warn({ requestId, userId: req.user.id, userRoles: req.user.roles, requiredRoles: allowedRoles }, 'Auth middleware: Insufficient permissions');
        return sendError(res, 403, 'forbidden', 'Access denied. Insufficient permissions.');
    }

    logger.info({ requestId, userId: req.user.id, roles: req.user.roles }, 'Auth middleware: Authorization successful');
    next();
};