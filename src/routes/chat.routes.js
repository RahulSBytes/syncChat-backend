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
  deleteForMe,
  deleteForEveryone,
  clearChat,
  blockChat,
  unblockChat,
  markMessagesAsDelivered,
  markMessagesAsRead,
  markAllMessagesAsDelivered,
  getUnreadCounts,
} from "../controllers/chat.controller.js";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { attachmentFiles, singleAvatar } from "../middleware/multer.js";
import { asyncWrapper } from "../middleware/error.js";
import { checkIfChatBlockedMiddleware } from "../middleware/checkBlocked.js";
const router = express.Router();

router.use(isAuthenticated);

router.put("/mark-all-delivered", markAllMessagesAsDelivered);
router.post("/", singleAvatar, createGroupChat);
router.get("/", getMyChats);
router.get("/findUser", asyncWrapper(findUsers));
router.patch("/removemember", removeMember);
router.patch("/leavegroup", leaveGroup);
router.delete("/deletegroup", deleteGroup);
router.post("/sendMessage/:chatId",checkIfChatBlockedMiddleware, attachmentFiles, sendMessage);
router.delete("/:messageId/delete-for-everyone", deleteForEveryone);
router.patch("/renamegroup", renameGroup);
router.get("/getchatdetail", getChatDetail);
router.delete("/deletechat", deleteChat);
router.get("/getmsgs/:id", getAllMessagesOfAchat);
router.patch("/addmember", addMembers);
router.delete("/:messageId/delete-for-me", deleteForMe);
router.delete("/:chatId/clear-chat", clearChat);
router.post("/:chatId/block", blockChat);
router.post("/:chatId/unblock", unblockChat);
router.put("/delivered/:chatId", markMessagesAsDelivered);
router.put("/read/:chatId", markMessagesAsRead);
router.get("/unread-counts", getUnreadCounts);


export default router;
