import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as authController from "./auth.controller";
import { z } from "zod/v4";

const router = Router();

const setupProfileSchema = z.object({
  phone: z.string().min(10),
  name: z.string().max(20).optional(),
  city: z.string().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().max(20).min(1),
});

// POST /api/auth/setup-profile — called after Supabase OTP verification
router.post(
  "/setup-profile",
  authMiddleware,
  validate(setupProfileSchema),
  authController.setupProfile
);

// GET /api/auth/profile — get current user's profile
router.get("/profile", authMiddleware, authController.getProfile);

// PUT /api/auth/profile — update name
router.put(
  "/profile",
  authMiddleware,
  validate(updateProfileSchema),
  authController.updateProfile
);

export default router;
