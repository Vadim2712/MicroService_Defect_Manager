import express from 'express';
import * as UserController from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateProfileSchema } from '../validations/user.validation.js';

const router = express.Router();

router.use(protect);

router.get('/profile', UserController.getProfile);
router.put('/profile', validate(updateProfileSchema), UserController.updateProfile);

export default router;