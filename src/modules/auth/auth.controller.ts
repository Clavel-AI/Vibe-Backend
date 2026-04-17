import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as authService from "./auth.service";

export async function setupProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { phone, name, city } = req.body;

    const { profile, isNew } = await authService.setupProfile({
      userId,
      phone,
      name,
      city,
    });

    if (isNew) {
      // 201 → frontend routes new user to name-setup
      res.status(201).json({ profile });
    } else {
      // 409 → frontend routes returning user directly to tabs
      res.status(409).json({ profile, error: "Profile already exists" });
    }
  } catch (err) {
    console.error("[Auth] Setup profile error:", err);
    res.status(500).json({ error: "Failed to setup profile" });
  }
}

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const profile = await authService.getProfile(req.userId!);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ profile });
  } catch (err) {
    console.error("[Auth] Get profile error:", err);
    res.status(500).json({ error: "Failed to get profile" });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { name, gender, dob, avatarConfig } = req.body;
    const profile = await authService.updateProfile(req.userId!, { name, gender, dob, avatarConfig });
    res.json({ profile });
  } catch (err) {
    console.error("[Auth] Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

// DELETE /api/auth/account
export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    await authService.deleteAccount(req.userId!);
    res.json({ deleted: true });
  } catch (err) {
    console.error("[Auth] Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
}
