import express from 'express';
import * as UserController from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { registerSchema, loginSchema } from '../validations/user.validation.js';

const router = express.Router();

router.post('/register', validate(registerSchema), UserController.register);
router.post('/login', validate(loginSchema), UserController.login);

export default router;