import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
} from "../controllers/auth.controller.js";
import { validateSignin } from "../middleware/auth.middleware.js";
import { singleAvatar } from "../middleware/multer.js";
import { asyncWrapper } from "../middleware/error.js";
// import isAuthenticated from "../middleware/isAuthenticated.js";

const router = express.Router();

router.post(
  "/register",
  singleAvatar,
  validateSignin,
  asyncWrapper(registerUser)
);

router.post("/login", asyncWrapper(loginUser));
router.post("/logout", logoutUser);

export default router;
