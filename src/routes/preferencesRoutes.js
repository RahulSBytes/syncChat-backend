// routes/preferencesRoutes.js
import express from "express";
import {
  getPreferences,
  updateAppearance,
  updatePrivacy,
  updateGeneralSettings,
  toggleSetting,
  resetPreferences,
  updateMultipleSettings,
  updateProfile,
  updatePassword,
} from "../controllers/preferencesController.js";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { singleAvatar } from "../middleware/multer.js";

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// Get preferences
router.get("/", getPreferences);

// Update specific sections
router.patch('/profile', singleAvatar, updateProfile);
router.patch("/appearance", updateAppearance);
router.patch("/privacy", updatePrivacy);
router.patch("/general", updateGeneralSettings);

router.patch('/password', updatePassword);

router.patch("/toggle", toggleSetting);

router.patch("/bulk", updateMultipleSettings);

router.post("/reset", resetPreferences);

export default router;