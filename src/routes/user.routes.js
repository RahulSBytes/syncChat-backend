import express from "express";
import { respondFriendRequest, getMyProfile, searchUser, sendFriendRequest, notifications, getAllFriendRequest } from "../controllers/user.controller.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

const routes = express.Router();

routes.use(isAuthenticated)
routes.get("/getmyprofile", getMyProfile);
routes.get("/searchUser", searchUser);
routes.post("/sendfriendrequest", sendFriendRequest);
routes.post("/respondfriendrequest", respondFriendRequest);
routes.post("/getallfriendrequest", getAllFriendRequest);
routes.get("/notifications", notifications);

export default routes;
