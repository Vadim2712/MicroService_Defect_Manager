import express from 'express';
import * as UserController from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { adminUpdateUserSchema } from '../validations/user.validation.js';

const router = express.Router();

router.use(protect, authorize(['admin']));

router.get('/users', UserController.listUsers);
router.get('/users/:id', UserController.getUserById);
router.put('/users/:id', validate(adminUpdateUserSchema), UserController.updateUser);

export default router;