import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as UserRepository from '../models/user.repository.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

export const registerUser = async (email, password, name) => {
    const existingUser = await UserRepository.findUserByEmail(email);
    if (existingUser) {
        logger.warn({ email }, 'Register failed: User already exists');
        throw new Error('user_exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await UserRepository.createUser(email, passwordHash, name);
    const { password_hash, ...userResponse } = newUser;
    return userResponse;
};

export const loginUser = async (email, password) => {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
        logger.warn({ email }, 'Login failed: User not found');
        throw new Error('invalid_credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        logger.warn({ email }, 'Login failed: Password mismatch');
        throw new Error('invalid_credentials');
    }

    const payload = {
        id: user.id,
        email: user.email,
        roles: user.roles,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { password_hash, ...userResponse } = user;

    return { token, user: userResponse };
};

export const getUserById = async (id) => {
    const user = await UserRepository.findUserById(id);
    if (!user) {
        throw new Error('not_found');
    }
    return user;
};

export const updateUserProfile = async (id, name, email) => {
    const user = await UserRepository.findUserById(id);
    if (!user) {
        throw new Error('not_found');
    }

    const updatedUser = await UserRepository.updateUser(id, name, email, user.roles);
    return updatedUser;
};

export const adminGetUsers = async (limit, offset, filter) => {
    const { users, total } = await UserRepository.findAllUsers(limit, offset, filter);
    return { users, total };
};

export const adminUpdateUser = async (id, name, email, roles) => {
    const user = await UserRepository.findUserById(id);
    if (!user) {
        throw new Error('not_found');
    }

    const newRoles = roles || user.roles;
    const updatedUser = await UserRepository.updateUser(id, name, email, newRoles);
    return updatedUser;
};