import { faker } from "@faker-js/faker";
import {
  ALERT,
  CHAT_CLEARED,
  GROUP_MEMBER_UPDATED,
  MESSAGE_DELETED,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../../constants/events.js";
import { customError } from "../middleware/error.js";
import Chat from "../models/chat.model.js";
import Message from "../models/msg.model.js";
import { modifyMessage, uploadFilesToCloudinary } from "../utils/helpers.js";
import User from "../models/user.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import ChatRequest from "../models/chatrequest.model.js";
import { sendFriendRequest } from "./user.controller.js";
import { attachmentFiles } from "../middleware/multer.js";
import { emitEvent } from "../utils/socketHelpers.js";
import mongoose from "mongoose";

export async function deleteForMe(req, res, next) {
  try {
    const { messageId } = req.params;
    const { messageInfo, members } = req.body;

    if (!messageId || !messageInfo) {
      return next(
        new customError("message id and message info both are required", 404)
      );
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return next(new customError("Message not found", 404));
    }

    if (message.sender.toString() !== req.user) {
      return next(
        new customError("You are not allowed to delete this message", 403)
      );
    }

    if (messageInfo.type === "text") {
      message.textDeletedFor = [
        ...new Set([...message.textDeletedFor, req.user]),
      ];
    } else {
      const attachment = message.attachments.id(messageInfo.attachment._id);
      if (!attachment)
        return next(new customError("Attachment not found", 404));
      attachment.deletedFor = [
        ...new Set([...attachment.deletedFor, req.user]),
      ];
    }

    await message.save();

    // repopulate before returning / emitting
    const populatedMessage = await Message.findById(messageId)
      .populate("sender", "_id fullName avatar username")
      .populate("chat");

    emitEvent(req, MESSAGE_DELETED, members, populatedMessage);

    return res.status(201).json({
      success: true,
      updatedMessage: populatedMessage,
    });
  } catch (error) {
    console.error("Delete-for-me error:", error);
    next(error);
  }
}

export async function deleteForEveryone(req, res, next) {
  try {
    const { messageId } = req.params;
    const { messageInfo, members } = req.body;

    if (!messageId || !messageInfo) {
      return customError("message id and message info both are required", 404);
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return customError("Message not found", 404);
    }

    if (message.sender.toString() != req.user) {
      return next(
        new customError("You are not allowed to delete this message", 403)
      );
    }

    if (messageInfo.type === "text") {
      message.textDeletedForEveryone = true;
      message.text = "";
    } else {
      const attachment = message.attachments.id(messageInfo.attachment._id);
      if (!attachment)
        return next(new customError("Attachment not found", 404));
      const { result } = await cloudinary.uploader.destroy(
        attachment.public_id,
        { invalidate: true }
      );

      if (result == "ok") console.log("error deleting file from cloudinary");
      attachment.deletedForEveryone = true;
      attachment.url = null;
    }

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate("sender", "_id fullName avatar username")
      .populate("chat");

    emitEvent(req, MESSAGE_DELETED, members, populatedMessage);

    return res.status(201).json({
      success: true,
      updatedMessage: populatedMessage,
    });
  } catch (error) {
    console.error("Delete-for-everyone error:", error);
    next(error);
  }
}

export async function getAllMessagesOfAchat(req, res, next) {
  // const { chatId, page = 1 } = req.body;
  const { id: chatId } = req.params;

  if (!chatId) return next(new customError("chatId id required", 400));

  // const resultPerPage = 20;

  // const skip = (page - 1) * resultPerPage;

  const messages = await Message.find({ chat: chatId })
    .populate("sender", "username fullName avatar")
    .lean();

  const modifiedMessage = modifyMessage(messages, req.user);

  return res.status(200).json({
    success: true,
    chat: modifiedMessage,
  });
}

export async function clearChat(req, res, next) {
  try {
    const { chatId } = req.params;
    if (!chatId) return next(new customError("chat id is required", 404));

    const chatDoc = await Chat.findById(chatId).select("members");
    if (!chatDoc) return next(new customError("chat not found", 404));

    const isMember = chatDoc.members.some((m) => m.toString() === req.user);

    if (!isMember) {
      return next(new customError("you are not a member of this chat", 403));
    }

    await Message.updateMany(
      { chat: chatId },
      {
        $addToSet: {
          textDeletedFor: req.user,
          "attachments.$[].deletedFor": req.user,
        },
      }
    );

    emitEvent(req, CHAT_CLEARED, [{ _id: req.user }], { chatId });

    return res.status(200).json({
      success: true,
      message: "Chat cleared for you",
    });
  } catch (err) {
    console.log("error clearing the chat ", err);
    next(err);
  }
}

// ############----- create a chat

export async function createGroupChat(req, res, next) {
  const { name, members, description } = req.body || {};

  if (!name || !members)
    next(new customError("name and members are required", 400));
  const allMembers = [...JSON.parse(members), req.user];

  // console.log("backend data ::", name, members, description, allMembers);

  const cloudres = await uploadFilesToCloudinary([req.file]);

  const group = await Chat.create({
    name,
    members: allMembers,
    groupChat: true,
    description,
    avatar: { public_id: cloudres[0].public_id, url: cloudres[0].url },
    creator: req.user,
  });

  // emitEvent(req, ALERT, allMembers, "welcome to group");
  // emitEvent(req, REFETCH_CHATS, members, "chat list refreshed");

  if (!group) return next(new customError("error creating group", 400));
  return res.status(200).json({
    success: true,
    message: "group successfully created",
    groupData: group,
  });
}

// ############----- Get all chats of a user

export async function getMyChats(req, res, next) {
  const chats = await Chat.find({
    members: { $in: [req.user] },
  })
    .populate("members")
    .populate("creator", "fullName");

  if (!chats) return next(new customError("error fetching chats", 400));

  return res.status(201).json({
    success: true,
    chats: chats,
  });
}

// ############----- add member

export async function findUsers(req, res, next) {
  try {
    const query = req.query.q?.trim();

    // Return empty array for empty queries instead of error
    if (!query) {
      return res.status(200).json([]);
    }

    // Add minimum query length to prevent too broad searches
    if (query.length < 2) {
      return res.status(200).json([]);
    }

    // Add cache control headers to prevent caching issues
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    // Get only one-on-one chats (groupChat: false or not set)
    const oneOnOneChats = await Chat.find(
      {
        members: { $in: [req.user] },
        $or: [{ groupChat: false }, { groupChat: { $exists: false } }],
      },
      "members"
    ).lean(); // Add .lean() for better performance

    // Get pending friend requests we've sent
    const sentFriendRequests = await ChatRequest.find(
      { sender: req.user },
      "receiver"
    ).lean(); // Add .lean() for better performance

    const pendingRequestReceivers = sentFriendRequests.map((el) =>
      el.receiver.toString()
    );

    // Extract user IDs from one-on-one chats only
    const directChatUserIds = oneOnOneChats.flatMap(
      (chat) =>
        chat.members
          .filter((id) => id.toString() !== req.user.toString())
          .map((id) => id.toString()) // Ensure string comparison
    );

    // Exclude: direct chat users, pending request receivers, and current user
    const excludedIds = [
      ...directChatUserIds,
      ...pendingRequestReceivers,
      req.user.toString(), // Ensure string
    ];

    // Build search regex with word boundaries for more precise matching
    const searchRegex = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

    const users = await User.find({
      $and: [
        {
          $or: [
            { username: { $regex: searchRegex } },
            { email: { $regex: searchRegex } },
            { fullName: { $regex: searchRegex } },
          ],
        },
        { _id: { $nin: excludedIds } },
      ],
    })
      .select("username email fullName avatar") // Only select needed fields
      .limit(20) // Limit results to prevent performance issues
      .lean(); // Better performance

    // Always return an array (empty if no results)
    res.status(200).json(users);
  } catch (err) {
    console.error("Error in findUsers:", err);
    // Return empty array on error instead of throwing
    res.status(500).json({ message: "Internal server error" });
  }
}

// ############----- add member

export async function addMembers(req, res, next) {
  const { chatId, username } = req.body;

  if (!chatId || !username) {
    return next(new customError("chatId and userId both are required", 400));
  }

  const [chat, user] = await Promise.all([
    Chat.findById(chatId, "members creator"),
    User.find({ username }),
  ]);

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  if (!user) {
    return next(new customError("User not found", 404));
  }

  if (chat.members.length === 2) {
    return next(new customError("This is not a group chat", 404));
  }

  if (chat.creator.toString() != req.user) {
    return next(new customError("you are not allowed to add members", 404));
  }

  if (chat.members.includes(user[0]._id)) {
    return next(new customError("User is already a member of this group", 400));
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { $addToSet: { members: user[0]._id } },
    { new: true }
  )
    .populate("members")
    .populate("creator", "fullName");

  // console.log("reached backend ::",updatedChat)
  emitEvent(req, GROUP_MEMBER_UPDATED, updatedChat.members, updatedChat);

  return res.status(201).json({
    success: true,
    message: "member added successfully",
  });
}

// ############----- remove member

export async function removeMember(req, res, next) {
  const { chatId, memberId } = req.body;

  if (!chatId || !memberId) {
    return next(new customError("chatId and userId are required", 400));
  }

  const chat = await Chat.findById(chatId)
    .populate("members")
    .populate("creator", "fullName"); // new learning

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  if (chat.creator._id != req.user) {
    return next(new customError("you are not allowed to remove members", 404));
  }

  if (!chat.members.some((member) => member._id == memberId)) {
    return next(new customError("User is not a member of this group", 400));
  }

  if (chat.members.length <= 2) {
    return next(new customError("A group must have atleast 2 members", 400));
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { $pull: { members: memberId } },
    { new: true } // updated doc
  )
    .populate("members")
    .populate("creator", "fullName");

  emitEvent(req, GROUP_MEMBER_UPDATED, updatedChat.members, updatedChat);

  return res.status(200).json({
    success: true,
    message: "Member removed successfully",
  });
}

// ############-----member leave group

export async function leaveGroup(req, res, next) {
  const { chatId, newAdminId = null } = req.body;
  const userId = req.user;

  if (!chatId) {
    return next(new customError("chatId required", 400));
  }

  const chat = await Chat.findById(chatId, "members creator"); // new learning

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  if (!chat.members.includes(userId)) {
    return next(new customError("you're not a group member", 400));
  }

  if (chat.creator == userId) {
    if (!newAdminId || !chat.members.includes(newAdminId)) {
      return next(new customError("something went wrong", 404));
    }

    await Chat.updateOne(
      { _id: chatId },
      {
        $set: { creator: newAdminId }, // update the creator
        $pull: { members: userId }, // remove the member
      }
    );
  }

  await Chat.updateOne({ _id: chatId }, { $pull: { members: userId } });

  emitEvent(req, ALERT, chat.members, `${userId} left the group`);

  return res.status(200).json({
    success: true,
    message: "you left",
  });
}

// ############-----delete group

export async function deleteGroup(req, res, next) {
  const { chatId } = req.body;
  const userId = req.user;

  if (!chatId) {
    return next(new customError("chatId id required", 400));
  }

  const chat = await Chat.findById(chatId, "members creator"); // new learning

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  if (chat.creator != userId) {
    return next(new customError("you aren't admin", 404));
  }

  await Chat.findByIdAndDelete(chatId);

  return res.status(200).json({
    success: true,
    message: "group deleted",
  });
}

// ############-----send attachment

export async function sendMessage(req, res, next) {
  const { chatId } = req.params;
  if (!chatId) return next(new customError("chat id is missing", 404));

  const files = req.files || [];
  const text = req.body.text || "";

  if (files.length < 1 && !text) {
    return next(new customError("please provide something", 404));
  }

  if (files.length > 6) {
    return next(new customError("Files can't be more than 5", 400));
  }

  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "username avatar fullName"),
  ]);

  if (!chat) return next(new customError("Chat not found", 404));
  if (!me) return next(new customError("loggedin user data not found", 404));

  let message = [];
  let messageForDB = null;
  try {
    const attachments = await uploadFilesToCloudinary(files);
    messageForDB = {
      text: text,
      attachments: attachments,
      sender: me._id,
      chat: chatId,
    };

    message = (await Message.create(messageForDB)).toObject();
  } catch (error) {
    console.log("reached here ::", error);
  }

  const messageForRealTime = {
    ...message,
    sender: {
      _id: me._id,
      name: me.username,
      avatar: me.avatar,
      fullName: me.fullName,
    },
  };

  emitEvent(req, NEW_MESSAGE, chat.members, messageForRealTime);

  // emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

  return res.status(200).json({
    success: true,
    message,
  });
}

// ############-----rename group

export async function renameGroup(req, res, next) {
  const { chatId, name } = req.body;

  if (!chatId) {
    return next(new customError("chatId id required", 400));
  }

  const chat = await Chat.findById(chatId, "members creator"); // new learning

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  if (chat.creator != req.user) {
    return next(new customError("you aren't admin", 404));
  }

  await Chat.updateOne({ _id: chatId }, { name: name });

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: "group name updated",
  });
}

// ############-----get chat details

export async function getChatDetail(req, res, next) {
  const { chatId, populate = false } = req.body;

  if (!chatId) {
    return next(new customError("chatId id required", 400));
  }

  let chat = {};

  if (populate) {
    chat = await Chat.findById(chatId).populate("members");
  } else {
    chat = await Chat.findById(chatId);
  }

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  return res.status(200).json({
    success: true,
    chat: chat,
  });
}

// ############-----deletechat

export async function deleteChat(req, res, next) {
  const { chatId } = req.body;
  if (!chatId) return next(new customError("provide chatId"));

  const [chat, chatmessages] = await Promise.allSettled([
    Chat.findById(chatId),
    Message.find({ chat: chatId }, "attachments"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));
  if (!chatmessages) return next(new customError("chat messages not found"));

  const filePublicIds = chatmessages.map((obj) => {
    return obj.attachments[0].public_id;
  });

  await Promise.all([
    deleteFromCloudinary(filePublicIds, next),
    await Message.deleteMany({ chat: chatId }),
    await Chat.deleteOne({ _id: chatId }),
  ]);

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: "chat deleted successfully",
  });
}
