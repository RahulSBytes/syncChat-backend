import {
  ALERT,
  CHAT_CLEARED,
  UPDATE_CHAT,
  MESSAGE_DELETED,
  NEW_CONTACT_ADDED,
  NEW_MESSAGE,
  REFETCH_CHATS,
  UPDATE_LAST_MESSAGE,
  UPDATE_UNREAD_COUNT,
  MESSAGE_DELIVERED,
  MESSAGE_READ,
  UNREAD_COUNT_UPDATED,
} from "../../constants/events.js";
import { customError } from "../middleware/error.js";
import Chat from "../models/chat.model.js";
import Message from "../models/msg.model.js";
import {
  areIdsEqual,
  getLastMessagePreview,
  modifyMessage,
  uploadFilesToCloudinary,
} from "../utils/helpers.js";
import User from "../models/user.model.js";
import UserChat from "../models/UserChat.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import ChatRequest from "../models/chatrequest.model.js";
import { emitEvent } from "../utils/socketHelpers.js";
import mongoose from "mongoose";

// tick features

// controllers/message.controller.js

export async function markMessagesAsDelivered(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user;

    const chat = await Chat.findById(chatId).select("members");
    if (!chat) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const messages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      deliveredTo: { $nin: [userId] },
    }).lean();

    if (messages.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const messageIds = messages.map((m) => m._id);

    // Add to deliveredTo
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { deliveredTo: userId } }
    );

    // Check which messages are fully delivered
    const totalMembers = chat.members.length;
    const requiredCount = totalMembers - 1;

    const updatedMessages = await Message.find({
      _id: { $in: messageIds }
    }).select("deliveredTo sender");

    const fullyDeliveredIds = updatedMessages
      .filter(msg => msg.deliveredTo.length >= requiredCount)
      .map(msg => msg._id);

    // Update status only for fully delivered
    if (fullyDeliveredIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: fullyDeliveredIds } },
        { $set: { status: "delivered" } }
      );
    }

    // ✅ FIX: Only emit for FULLY delivered messages
    if (fullyDeliveredIds.length > 0) {
      const fullyDeliveredMessages = updatedMessages.filter(msg =>
        fullyDeliveredIds.some(id => id.equals(msg._id))
      );

      const senders = [...new Set(fullyDeliveredMessages.map(m => String(m.sender)))].map(
        (id) => ({ _id: id })
      );

      emitEvent(req, MESSAGE_DELIVERED, senders, {
        chatId,
        messageIds: fullyDeliveredIds,  // ✅ Only fully delivered IDs
        deliveredBy: userId,
      });
    }

    return res.status(200).json({
      success: true,
      count: messages.length,
    });
  } catch (error) {
    console.error("❌ Mark delivered error:", error);
    next(error);
  }
}


// controllers/message.controller.js - ADD THIS
export async function markAllMessagesAsDelivered(req, res, next) {
  try {
    const userId = req.user;

    const userChats = await UserChat.find({
      userId: userId,
      isActive: true
    }).select("chatId");

    const chatIds = userChats.map(uc => uc.chatId);

    const chats = await Chat.find({
      _id: { $in: chatIds }
    }).select("_id members");

    const chatMemberCount = {};
    chats.forEach(chat => {
      chatMemberCount[chat._id.toString()] = chat.members.length;
    });

    const messages = await Message.find({
      chat: { $in: chatIds },
      sender: { $ne: userId },
      deliveredTo: { $nin: [userId] }
    }).lean();

    if (messages.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No messages to mark as delivered",
        count: 0
      });
    }

    const messageIds = messages.map(m => m._id);

    // Add to deliveredTo
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { deliveredTo: userId } }
    );

    // Check which are fully delivered
    const updatedMessages = await Message.find({
      _id: { $in: messageIds }
    }).select("chat deliveredTo sender");

    const fullyDeliveredIds = updatedMessages
      .filter(msg => {
        const totalMembers = chatMemberCount[msg.chat.toString()] || 2;
        const requiredCount = totalMembers - 1;
        return msg.deliveredTo.length >= requiredCount;
      })
      .map(msg => msg._id);

    // Update status only for fully delivered
    if (fullyDeliveredIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: fullyDeliveredIds } },
        { $set: { status: "delivered" } }
      );
    }

    // ✅ FIX: Only emit for FULLY delivered messages
    if (fullyDeliveredIds.length > 0) {
      const fullyDeliveredMessages = updatedMessages.filter(msg =>
        fullyDeliveredIds.some(id => id.equals(msg._id))
      );

      const messagesByChatSender = {};

      fullyDeliveredMessages.forEach(msg => {
        const key = `${msg.chat}_${msg.sender}`;
        if (!messagesByChatSender[key]) {
          messagesByChatSender[key] = {
            chatId: msg.chat.toString(),
            senderId: msg.sender.toString(),
            messageIds: []
          };
        }
        messagesByChatSender[key].messageIds.push(msg._id);
      });

      Object.values(messagesByChatSender).forEach(({ chatId, senderId, messageIds }) => {
        emitEvent(req, MESSAGE_DELIVERED, [{ _id: senderId }], {
          chatId,
          messageIds,
          deliveredBy: userId,
          deliveredAt: new Date()
        });
      });
    }

    return res.status(200).json({
      success: true,
      message: "All messages marked as delivered",
      count: messages.length
    });

  } catch (error) {
    console.error("❌ Mark all delivered error:", error);
    next(error);
  }
}

// controllers/message.controller.js   

export async function markMessagesAsRead(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user;

    const chat = await Chat.findById(chatId).select("members");
    if (!chat) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const messages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      readBy: { $nin: [userId] },
    }).lean();

    if (messages.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const messageIds = messages.map((m) => m._id);

    // Add to both arrays
    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $addToSet: {
          deliveredTo: userId,
          readBy: userId,
        }
      }
    );

    // Check which should be updated
    const totalMembers = chat.members.length;
    const requiredCount = totalMembers - 1;

    const updatedMessages = await Message.find({
      _id: { $in: messageIds }
    }).select("readBy deliveredTo status sender");

    const fullyReadIds = [];
    const fullyDeliveredIds = [];

    updatedMessages.forEach(msg => {
      if (msg.readBy.length >= requiredCount) {
        fullyReadIds.push(msg._id);
      } else if (msg.deliveredTo.length >= requiredCount && msg.status === "sent") {
        fullyDeliveredIds.push(msg._id);
      }
    });

    // Update statuses
    if (fullyReadIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: fullyReadIds } },
        { $set: { status: "read" } }
      );
    }

    if (fullyDeliveredIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: fullyDeliveredIds } },
        { $set: { status: "delivered" } }
      );
    }

    // Reset unread count
    await UserChat.findOneAndUpdate(
      { userId, chatId },
      { unreadCount: 0 }
    );

    // ✅ FIX: Only emit MESSAGE_READ for fully read messages
    if (fullyReadIds.length > 0) {
      const fullyReadMessages = updatedMessages.filter(msg =>
        fullyReadIds.some(id => id.equals(msg._id))
      );

      const senders = [...new Set(fullyReadMessages.map(m => String(m.sender)))].map(
        (id) => ({ _id: id })
      );

      emitEvent(req, MESSAGE_READ, senders, {
        chatId,
        messageIds: fullyReadIds,  // ✅ Only fully read IDs
        readBy: userId,
      });
    }

    // ✅ NEW: Emit MESSAGE_DELIVERED for messages that became fully delivered
    if (fullyDeliveredIds.length > 0) {
      const fullyDeliveredMessages = updatedMessages.filter(msg =>
        fullyDeliveredIds.some(id => id.equals(msg._id))
      );

      const senders = [...new Set(fullyDeliveredMessages.map(m => String(m.sender)))].map(
        (id) => ({ _id: id })
      );

      emitEvent(req, MESSAGE_DELIVERED, senders, {
        chatId,
        messageIds: fullyDeliveredIds,
        deliveredBy: userId,
      });
    }

    emitEvent(req, UNREAD_COUNT_UPDATED, [{ _id: userId }], {
      chatId,
      unreadCount: 0,
    });

    return res.status(200).json({
      success: true,
      count: messages.length,
    });
  } catch (error) {
    console.error("❌ Mark read error:", error);
    next(error);
  }
}

// controllers/message.controller.js

export async function getUndeliveredCount(req, res, next) {
  try {
    const userId = req.user;

    const count = await Message.countDocuments({
      sender: { $ne: userId },
      "deliveredTo.userId": { $ne: userId },
    });

    return res.status(200).json({ success: true, count });
  } catch (error) {
    next(error);
  }
}

// controllers/message.controller.js

export async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user;

    // ✅ Get total unread across all chats
    const result = await UserChat.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalUnread: { $sum: "$unreadCount" },
        },
      },
    ]);

    const totalUnread = result[0]?.totalUnread || 0;

    // ✅ Get per-chat unread counts
    const chatUnreads = await UserChat.find({
      userId,
      isActive: true,
      unreadCount: { $gt: 0 },
    }).select("chatId unreadCount");

    return res.status(200).json({
      success: true,
      totalUnread,
      chatUnreads,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    next(error);
  }
}

// blocking feature

// Block a chat (for current user)
export async function blockChat(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user;

    // Check if chat exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(new customError("Chat not found", 404));
    }

    // Check if user is member of this chat
    if (!chat.members.includes(userId)) {
      return next(new customError("You are not a member of this chat", 403));
    }

    // Update UserChat to mark as blocked
    const userChat = await UserChat.findOneAndUpdate(
      { userId, chatId },
      {
        isBlocked: true,
        blockedAt: new Date(),
      },
      { new: true }
    );

    if (!userChat) {
      return next(new customError("Chat relationship not found", 404));
    }

    const { chatId: _id, isBlocked, blockedAt } = userChat;
    emitEvent(req, UPDATE_CHAT, [{ _id: userId }], {
      _id,
      isBlocked,
      blockedAt,
    });

    return res.status(200).json({
      success: true,
      message: "Chat blocked successfully",
      userChat,
    });
  } catch (error) {
    console.error("Block chat error:", error);
    next(error);
  }
}

// Unblock a chat
export async function unblockChat(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user;

    // Check if chat exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(new customError("Chat not found", 404));
    }

    // Check if user is member of this chat
    if (!chat.members.includes(userId)) {
      return next(new customError("You are not a member of this chat", 403));
    }

    const userChat = await UserChat.findOneAndUpdate(
      { userId, chatId },
      {
        isBlocked: false,
        blockedAt: null,
      },
      { new: true }
    );

    if (!userChat) {
      return next(new customError("Chat relationship not found", 404));
    }

    const { chatId: _id, isBlocked, blockedAt } = userChat;
    emitEvent(req, UPDATE_CHAT, [{ _id: userId }], {
      _id,
      isBlocked,
      blockedAt,
    });

    return res.status(200).json({
      success: true,
      message: "Chat unblocked successfully",
      userChat,
    });
  } catch (error) {
    console.error("Unblock chat error:", error);
    next(error);
  }
}

// blocking feature ends

export async function deleteForMe(req, res, next) {
  try {
    const { messageId } = req.params;
    const { messageInfo, chatId } = req.body;

    if (!messageId || !messageInfo) {
      return next(
        new customError("message id and message info both are required", 404)
      );
    }

    const [chat, message, userChat] = await Promise.all([
      Chat.findById(chatId).select("members"),
      Message.findById(messageId)
        .populate("sender", "avatar fullName username")
        .populate("chat"),
      UserChat.findOne({ userId: req.user, chatId: chatId }), // Get user's chat
    ]);

    if (!message) {
      return next(new customError("Message not found", 404));
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

    if (areIdsEqual(message._id, userChat.lastMessage.messageId)) {
      let text = getLastMessagePreview(message, req.user);
      let lastMessageObj;

      if (text) {
        lastMessageObj = { messageId: message._id, message: text };
      } else {
        const prev = await Message.findOne({
          chat: chatId,
          $or: [
            { textDeletedFor: { $nin: [req.user] } },
            {
              attachments: { $elemMatch: { deletedFor: { $nin: [req.user] } } },
            },
          ],
        })
          .sort({ createdAt: -1, _id: -1 })
          .lean();

        if (prev) {
          text = getLastMessagePreview(
            modifyMessage([prev], req.user)[0],
            req.user
          );
          lastMessageObj = { messageId: prev._id, message: text };
        } else {
          lastMessageObj = { messageId: null, message: null };
        }
      }

      await UserChat.findOneAndUpdate(
        { userId: req.user, chatId: chatId },
        { lastMessage: lastMessageObj }
      );

      emitEvent(req, UPDATE_LAST_MESSAGE, [{ _id: req.user }], {
        chatId,
        lastMessageObj,
      });
    }

    emitEvent(
      req,
      MESSAGE_DELETED,
      [{ _id: req.user }],
      modifyMessage([message], req.user)
    );

    return res.status(201).json({
      success: true,
    });
  } catch (error) {
    console.error("Delete-for-me error:", error);
    return next(new customError("error deleting message for me", 400));
  }
}

export async function deleteForEveryone(req, res, next) {
  try {
    const { messageId } = req.params;
    const { messageInfo, chatId } = req.body;

    if (!messageId || !messageInfo) {
      return next(
        new customError("message id and message info both are required", 404)
      );
    }

    const [chat, message] = await Promise.all([
      Chat.findById(chatId).select("members lastMessage"),
      Message.findById(messageId)
        .populate("sender", "avatar fullName username")
        .populate("chat"),
    ]);

    if (!message) {
      return next(new customError("Message not found", 404));
    }
    if (!chat) {
      return next(new customError("chat not found", 404));
    }

    if (areIdsEqual(message.sender, req.user)) {
      return next(
        new customError("You are not allowed to delete this message", 403)
      );
    }

    try {
    } catch (error) {}

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

      if (result !== "ok") console.log("error deleting file from cloudinary");
      attachment.deletedForEveryone = true;
      attachment.url = null;
    }

    await message.save();

    const userChats = await UserChat.find({
      chatId: chatId,
      "lastMessage.messageId": message._id,
    });

    const updatePromises = userChats.map(async (uc) => {
      // Get preview after deletion (will show "This message was deleted")
      const text = getLastMessagePreview(message, uc.userId);

      if (!text) {
        console.error("Error getting preview for delete-for-everyone");
        return;
      }

      return UserChat.findByIdAndUpdate(uc._id, {
        "lastMessage.message": text,
        // Keep same messageId and time
      });
    });

    await Promise.all(updatePromises);

    // Emit to ALL members
    emitEvent(req, UPDATE_LAST_MESSAGE, chat.members, {
      chatId,
      lastMessageObj: {
        messageId: message._id,
        message: "This message was deleted",
      },
    });

    // if (areIdsEqual(message._id, chat.lastMessage.messageId)) {
    //   let text;
    //   text = getLastMessagePreview(message, req.user);
    //   if (!text) return console.log("some error occured deleting for everyone");

    //   chat.lastMessage = { messageId: message._id, message: text };
    //   chat.save();
    //   emitEvent(req, UPDATE_LAST_MESSAGE, chat.members, {
    //     chatId,
    //     lastMessageObj: chat.lastMessage,
    //   });
    // }

    emitEvent(
      req,
      MESSAGE_DELETED,
      chat.members,
      modifyMessage([message], req.user)
    );

    return res.status(201).json({
      success: true,
      updatedMessage: message,
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

    // ✅ Check membership via UserChat (more accurate)
    const userChat = await UserChat.findOne({
      userId: req.user,
      chatId: chatId,
    });

    if (!userChat) {
      return next(
        new customError("Chat not found or you are not a member", 404)
      );
    }

    // Get all messages in this chat
    const messages = await Message.find({ chat: chatId });

    // ✅ Update each message individually to handle nested arrays correctly
    const updatePromises = messages.map(async (message) => {
      // Add user to textDeletedFor if not already there
      if (!message.textDeletedFor.includes(req.user)) {
        message.textDeletedFor.push(req.user);
      }

      // Add user to each attachment's deletedFor array
      if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach((attachment) => {
          if (!attachment.deletedFor.includes(req.user)) {
            attachment.deletedFor.push(req.user);
          }
        });
      }

      return message.save();
    });

    await Promise.all(updatePromises);

    await UserChat.findOneAndUpdate(
      { userId: req.user, chatId: chatId },
      {
        lastMessage: {
          message: "Chat cleared",
          messageId: null,
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
  try {
    const { name, members, description } = req.body || {};

    if (!name || !members)
      next(new customError("name and members are required", 400));
    const allMembers = [...JSON.parse(members), req.user];

    const { public_id, url } = req.file
      ? (await uploadFilesToCloudinary([req.file]))[0]
      : {};

    const group = await Chat.create({
      name,
      members: allMembers,
      groupChat: true,
      description,
      avatar: { public_id, url },
      creator: req.user,
    });

    if (!group)
      return next(
        new customError("error creating group :: group not created", 400)
      );

    const userChatPromises = group.members.map((memberId) =>
      UserChat.create({
        userId: memberId,
        chatId: group._id,
      })
    );

    const check = await Promise.all(userChatPromises);

    emitEvent(req, REFETCH_CHATS, group.members);

    return res.status(200).json({
      success: true,
      message: "group successfully created",
      groupData: group,
    });
  } catch (error) {
    console.log("error creating group ::", error);
  }
}

// ############----- Get all chats of a user

export async function getMyChats(req, res, next) {
  try {
    // Get user's chat relationships with their personalized last messages
    const userChats = await UserChat.find({ userId: req.user })
      .populate({
        path: "chatId",
        populate: [
          {
            path: "members",
            select: "fullName avatar username",
          },
          { path: "creator", select: "fullName avatar username" },
          {
            path: "removedMembers.userId",
            select: "fullName avatar username",
          },
        ],
      })

      .sort({ lastMessageTime: -1 })
      .lean();

    if (!userChats) {
      return next(new customError("Error fetching chats", 400));
    }

    // Transform to include user-specific last message
    const chats = userChats.map((uc) => ({
      ...uc.chatId,
      lastMessage: uc.lastMessage,
      lastMessageTime: uc.lastMessageTime,
      isBlocked: uc.isBlocked,
      blockedAt: uc.blockedAt,
      isActive: uc.isActive,
      unreadCount: uc.unreadCount || 0,
      leftAt: uc.leftAt,
    }));

    return res.status(200).json({
      success: true,
      chats: chats,
    });
  } catch (error) {
    console.error("Get chats error:", error);
    next(error);
  }
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
    ).lean();
    const sentFriendRequests = await ChatRequest.find(
      { sender: req.user },
      "receiver"
    ).lean();

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
      req.user.toString(),
    ];

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
      .limit(20)
      .lean();

    res.status(200).json(users);
  } catch (err) {
    console.error("Error in findUsers:", err);

    res.status(500).json({ message: "Internal server error" });
  }
}

// ############----- add member

export async function addMembers(req, res, next) {
  try {
    const { chatId, username } = req.body;

    if (!chatId || !username) {
      return next(new customError("chatId and userId both are required", 400));
    }

    const [chat, user] = await Promise.all([
      Chat.findById(chatId).select("members creator groupChat removedMembers"),
      User.findOne({ username }).select("_id username fullName avatar"),
    ]);

    if (!chat) {
      return next(new customError("Chat not found", 404));
    }

    if (!user) {
      return next(new customError("User not found", 404));
    }

    if (!chat.groupChat) {
      return next(new customError("This is not a group chat", 400));
    }

    if (!areIdsEqual(chat.creator, req.user)) {
      return next(new customError("Only the creator can add members", 403));
    }

    if (chat.members.some((id) => areIdsEqual(id, user._id))) {
      return next(
        new customError("User is already a member of this group", 400)
      );
    }

    chat.removedMembers = chat.removedMembers.filter(
      (el) => !areIdsEqual(el.userId, user._id)
    );
    chat.members.push(user._id);
    await chat.save();

    const existingUserChat = await UserChat.findOne({
      userId: user._id,
      chatId: chat._id,
    });

    if (existingUserChat) {
      existingUserChat.isActive = true;
      existingUserChat.leftAt = null;
      await existingUserChat.save();
    } else {
      await UserChat.create({
        userId: user._id,
        chatId: chat._id,
        lastMessage: { message: "no message yet" },
        lastMessageTime: null,
        isActive: true,
      });
    }

    const updatedChat = await Chat.findById(chatId)
      .populate("members", "fullName username avatar")
      .populate("removedMembers.userId", "fullName username avatar");

    emitEvent(req, UPDATE_CHAT, updatedChat.members, {
      _id: updatedChat._id,
      removedMembers: updatedChat.removedMembers,
      members: updatedChat.members,
    });

    return res.status(200).json({
      success: true,
      message: "member added successfully",
    });
  } catch (error) {
    console.log("error adding members :: ", error);
  }
}

// ############----- remove member

export async function removeMember(req, res, next) {
  try {
    const { chatId, memberId } = req.body;

    if (!chatId || !memberId) {
      return next(new customError("chatId and userId are required", 400));
    }

    const chat = await Chat.findById(chatId)
      .select("members creator groupChat removedMembers")
      .populate("members", "fullName username avatar")
      .populate("creator", "fullName username avatar");

    if (!chat) {
      return next(new customError("Chat not found", 404));
    }

    if (!chat.groupChat) {
      return next(new customError("This is not a group chat", 400));
    }

    if (!areIdsEqual(chat.creator._id, req.user)) {
      return next(new customError("Only the creator can remove members", 403));
    }

    if (!chat.members.some((member) => areIdsEqual(member._id, memberId))) {
      return next(new customError("User is not a member of this group", 400));
    }

    if (areIdsEqual(chat.creator, req.user)) {
      return next(new customError("Cannot remove the creator", 403));
    }

    if (chat.members.length <= 2) {
      return next(new customError("A group must have at least 2 members", 400));
    }

    // Remove member from chat
    chat.members = chat.members.filter((m) => !areIdsEqual(m._id, memberId));

    chat.removedMembers.push({
      userId: memberId,
      removedAt: new Date(),
    });

    await chat.save();

    await UserChat.updateOne(
      { userId: memberId, chatId: chatId },
      {
        isActive: false,
        leftAt: new Date(),
      }
    );

    const updatedChat = await Chat.findById(chatId)
      .populate("members", "fullName username avatar")
      .populate("removedMembers.userId", "fullName username avatar");

    emitEvent(req, UPDATE_CHAT, updatedChat.members, {
      _id: updatedChat._id,
      removedMembers: updatedChat.removedMembers,
      members: updatedChat.members,
    });

    // Notify removed member
    // emitEvent(req, REFETCH_CHATS, [{ _id: memberId }], {
    //   chatId,
    //   removed: true,
    // });

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data: updatedChat,
    });
  } catch (error) {
    console.log("error removing members : ", error);
    next(error);
  }
}

// ############-----member leave group

export async function leaveGroup(req, res, next) {
  try {
    const { chatId, newCreatorId = null } = req.body;
    const userId = req.user;

    if (!chatId) {
      return next(new customError("chatId is required", 400));
    }

    const chat = await Chat.findById(
      chatId,
      "members creator groupChat removedMembers"
    ); // new learning

    if (!chat) {
      return next(new customError("Chat not found", 404));
    }

    if (!chat.groupChat) {
      return next(new customError("This is not a group chat", 400));
    }

    if (!chat.members.some((m) => areIdsEqual(m, userId))) {
      return next(new customError("User is not a member of this group", 400));
    }

    if (areIdsEqual(chat.creator, userId)) {
      if (!newCreatorId) {
        return next(
          new customError("Creator must transfer ownership before leaving", 400)
        );
      }

      if (!chat.members.some((m) => areIdsEqual(m, newCreatorId))) {
        return next(new customError("New creator must be a group member", 400));
      }

      // Transfer ownership
      chat.creator = newCreatorId;
    }

    chat.members = chat.members.filter((m) => !areIdsEqual(m, userId));

    chat.removedMembers.push({
      userId: userId,
      removedAt: new Date(),
    });

    await chat.save();

    await UserChat.findOneAndUpdate(
      { userId: userId, chatId: chatId },
      {
        isActive: false,
        leftAt: new Date(),
      }
    );

    const updatedChat = await Chat.findById(chatId)
      .populate("members", "fullName username avatar")
      .populate("removedMembers.userId", "fullName username avatar");

    const { _id, removedMembers, members } = updatedChat;
    emitEvent(req, UPDATE_CHAT, [...updatedChat.members, { _id: userId }], {
      _id,
      removedMembers,
      members,
    });

    return res.status(200).json({
      success: true,
      message: "you left",
      data: updatedChat,
    });
  } catch (error) {
    console.log("error leaving ::", error);
  }
}

// ############-----delete group

export async function deleteGroup(req, res, next) {
  try {
    const { chatId } = req.body;
    const userId = req.user;

    if (!chatId) {
      return next(new customError("chatId is required", 400));
    }

    const chat = await Chat.findById(chatId).select(
      "members creator groupChat"
    );

    if (!chat) {
      return next(new customError("Chat not found", 404));
    }

    if (!chat.groupChat) {
      return next(new customError("Cannot delete direct messages", 400));
    }

    if (!areIdsEqual(chat.creator, userId)) {
      return next(
        new customError("Only the creator can delete the group", 403)
      );
    }

    const members = [...chat.members];

    await Promise.all([
      await UserChat.deleteMany({ chatId: chatId }),
      await Message.deleteMany({ chat: chatId }),
      await Chat.findByIdAndDelete(chatId),
    ]);

    emitEvent(req, REFETCH_CHATS, members, { chatId });

    return res.status(200).json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting group:", error);
    next(error);
  }
}

// ############-----send attachment

export async function sendMessage(req, res, next) {
  try {
    const { chatId } = req.params;
    if (!chatId) return next(new customError("Chat id is missing", 404));

    const files = req.files || [];
    const text = req.body.text || "";

    if (files.length < 1 && !text) {
      return next(new customError("Please provide something", 404));
    }

    if (files.length > 6) {
      return next(new customError("Files can't be more than 6", 400));
    }

    const [chat, me] = await Promise.all([
      Chat.findById(chatId),
      User.findById(req.user, "username avatar fullName"),
    ]);

    if (!chat) return next(new customError("Chat not found", 404));
    if (!me) return next(new customError("Logged in user data not found", 404));

    let message = null;

    const attachments = await uploadFilesToCloudinary(files);

    const messageForDB = {
      text: text,
      attachments: attachments,
      sender: me._id,
      chat: chatId,
      status: "sent", // Initial status
      deliveredTo: [], // Empty initially
      readBy: [], // Empty initially
    };

    message = (await Message.create(messageForDB)).toObject();


    const lastMessagePreview = getLastMessagePreview(message);

    // ✅ Separate members: sender vs recipients
    const recipients = chat.members.filter(
      (memberId) => !areIdsEqual(memberId, me._id)
    );

    // Update lastMessage for ALL chat members in UserChat collection
    const updatePromises = chat.members.map((memberId) =>
      UserChat.findOneAndUpdate(
        { userId: memberId, chatId: chatId },
        {
          lastMessage: {
            message: lastMessagePreview,
            messageId: message._id,
          },
          lastMessageTime: message.createdAt,
          ...(areIdsEqual(me._id, memberId)
            ? {}
            : { $inc: { unreadCount: 1 } }),
        },
        { upsert: true, new: true } // Create if doesn't exist
      )
    );

    await Promise.all(updatePromises);

    const messageForRealTime = {
      ...message,
      sender: {
        _id: me._id,
        name: me.username,
        avatar: me.avatar,
        fullName: me.fullName,
      },
    };

    // ✅ Emit to all members - new message
    emitEvent(req, NEW_MESSAGE, chat.members, messageForRealTime);

    // ✅ Emit last message update to all members
    emitEvent(req, UPDATE_LAST_MESSAGE, chat.members, {
      chatId,
      lastMessageObj: {
        message: lastMessagePreview,
        messageId: message._id,
      },
      lastMessageTime: message.createdAt,
    });

    // ✅ NEW: Emit unread count update to recipients only
    if (recipients.length > 0) {
      emitEvent(req, UPDATE_UNREAD_COUNT, recipients, {
        chatId,
        increment: 1, // Increment by 1
      });
    }

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    next(error);
  }
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
