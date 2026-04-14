import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as authService from "./auth.service";

export async function setupProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { phone, name, city } = req.body;

    const profile = await authService.setupProfile({
      userId,
      phone,
      name,
      city,
    });

    res.status(200).json({ profile });
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
    const { name } = req.body;
    const profile = await authService.updateProfile(req.userId!, { name });
    res.json({ profile });
  } catch (err) {
    console.error("[Auth] Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}
