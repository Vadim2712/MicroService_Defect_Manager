import * as UserService from '../services/user.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const register = async (req, res) => {
    const { email, password, name } = req.body;
    const requestId = req.id;
    logger.info({ requestId, email, name }, 'Register attempt started');

    try {
        const newUser = await UserService.registerUser(email, password, name);
        logger.info({ requestId, userId: newUser.id, email }, 'Register successful');
        sendSuccess(res, 201, newUser);
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Register controller error');
        if (error.message === 'user_exists') {
            return sendError(res, 400, 'user_exists', 'User with this email already exists');
        }
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    const requestId = req.id;
    logger.info({ requestId, email }, 'Login attempt started');

    try {
        const { token, user } = await UserService.loginUser(email, password);
        logger.info({ requestId, userId: user.id, email }, 'Login successful');
        sendSuccess(res, 200, { token, user });
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Login controller error');
        if (error.message === 'invalid_credentials') {
            return sendError(res, 401, 'invalid_credentials', 'Invalid email or password');
        }
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const getProfile = async (req, res) => {
    const userId = req.user.id;
    const requestId = req.id;
    logger.info({ requestId, userId }, 'Get profile attempt');

    try {
        const user = await UserService.getUserById(userId);
        logger.info({ requestId, userId }, 'Get profile successful');
        sendSuccess(res, 200, user);
    } catch (error) {
        logger.error({ requestId, userId, error: error.message }, 'Get profile controller error');
        if (error.message === 'not_found') {
            return sendError(res, 404, 'not_found', 'User not found');
        }
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { name, email } = req.body;
    const requestId = req.id;
    logger.info({ requestId, userId, name, email }, 'Update profile attempt');

    try {
        const updatedUser = await UserService.updateUserProfile(userId, name, email);
        logger.info({ requestId, userId }, 'Update profile successful');
        sendSuccess(res, 200, updatedUser);
    } catch (error) {
        logger.error({ requestId, userId, error: error.message }, 'Update profile controller error');
        if (error.code === '23505') {
            return sendError(res, 400, 'email_in_use', 'Email already in use');
        }
        if (error.message === 'not_found') {
            return sendError(res, 404, 'not_found', 'User not found');
        }
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const listUsers = async (req, res) => {
    const requestId = req.id;
    const { page = 1, limit = 10, filter } = req.query;
    const offset = (page - 1) * limit;

    logger.info({ requestId, page, limit, filter }, 'Admin list users attempt');

    try {
        const { users, total } = await UserService.adminGetUsers(limit, offset, filter);
        const totalPages = Math.ceil(total / limit);

        logger.info({ requestId, count: users.length, total }, 'Admin list users successful');
        sendSuccess(res, 200, {
            users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages,
            },
        });
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Admin list users controller error');
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const getUserById = async (req, res) => {
    const { id } = req.params;
    const requestId = req.id;
    logger.info({ requestId, userId: id }, 'Admin get user by ID attempt');

    try {
        const user = await UserService.getUserById(id);
        logger.info({ requestId, userId: id }, 'Admin get user successful');
        sendSuccess(res, 200, user);
    } catch (error) {
        logger.error({ requestId, userId: id, error: error.message }, 'Admin get user error');
        if (error.message === 'not_found') {
            return sendError(res, 404, 'not_found', 'User not found');
        }
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, roles } = req.body;
    const requestId = req.id;
    logger.info({ requestId, userId: id, name, email, roles }, 'Admin update user attempt');

    try {
        const updatedUser = await UserService.adminUpdateUser(id, name, email, roles);
        logger.info({ requestId, userId: id }, 'Admin update user successful');
        sendSuccess(res, 200, updatedUser);
    } catch (error) {
        logger.error({ requestId, userId: id, error: error.message }, 'Admin update user error');
        if (error.code === '23505') {
            return sendError(res, 400, 'email_in_use', 'Email already in use');
        }
        if (error.message === 'not_found') {
            return sendError(res, 404, 'not_found', 'User not found');
        }
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};