import express from "express";
import {
  addMembers,
  createGroupChat,
  deleteChat,
  deleteGroup,
  getMyChats,
  getAllMessagesOfAchat,
  getChatDetail,
  leaveGroup,
  removeMember,
  renameGroup,
  sendMessage,
  findUsers,
} from "../controllers/chat.controller.js";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { chatValidation } from "../middleware/chatvalidation.js";
import { attachmentFiles, singleAvatar } from "../middleware/multer.js";
import { asyncWrapper } from "../middleware/error.js";
const router = express.Router();

router.use(isAuthenticated);

router.post("/", singleAvatar, createGroupChat);
router.get("/", getMyChats);
router.get("/findUser", asyncWrapper(findUsers));
router.patch("/removemember", removeMember);
router.patch("/leavegroup", leaveGroup);
router.delete("/deletegroup", deleteGroup);
router.post("/sendMessage/:chatId", attachmentFiles, sendMessage);
router.patch("/renamegroup", renameGroup);
router.get("/getchatdetail", getChatDetail);
router.delete("/deletechat", deleteChat);
router.get("/getmsgs/:id", getAllMessagesOfAchat);
router.patch("/addmember", addMembers);

export default router;
