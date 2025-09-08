import express from "express";
import {
  addMembers,
  createGroupChat,
  deleteChat,
  deleteGroup,
  getAllChat,
  getAllMessagesOfAchat,
  getChatDetail,
  leaveGroup,
  removeMember,
  renameGroup,
  sendAttachment,
} from "../controllers/chat.controller.js";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { chatValidation } from "../middleware/chatvalidation.js";
import { attachmentFiles } from "../middleware/multer.js";
const router = express.Router();

router.use(isAuthenticated);

router.post("/", chatValidation, createGroupChat);
router.get("/", getAllChat);
router.patch("/addmember", addMembers);
router.patch("/removemember", removeMember);
router.patch("/leavegroup", leaveGroup);
router.delete("/deletegroup", deleteGroup);
router.post("/sendattachment", attachmentFiles, sendAttachment);
router.patch("/renamegroup", renameGroup);
router.get("/getchatdetail", getChatDetail);
router.delete("/deletechat", deleteChat);
router.get("/getmsgs", getAllMessagesOfAchat);


export default router;
