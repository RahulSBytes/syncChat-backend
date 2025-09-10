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
  sendAttachment,
  findUsers,
} from "../controllers/chat.controller.js";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { chatValidation } from "../middleware/chatvalidation.js";
import { attachmentFiles } from "../middleware/multer.js";
import { asyncWrapper } from "../middleware/error.js";
const router = express.Router();

router.use(isAuthenticated);

router.post("/", chatValidation, createGroupChat);
router.get("/", getMyChats);
router.get("/findUser", asyncWrapper(findUsers) );
router.patch("/removemember", removeMember);
router.patch("/leavegroup", leaveGroup);
router.delete("/deletegroup", deleteGroup);
router.post("/sendattachment", attachmentFiles, sendAttachment);
router.patch("/renamegroup", renameGroup);
router.get("/getchatdetail", getChatDetail);
router.delete("/deletechat", deleteChat);
router.get("/getmsgs/:id", getAllMessagesOfAchat);


export default router;
