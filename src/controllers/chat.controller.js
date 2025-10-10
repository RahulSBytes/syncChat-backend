import {
  ALERT,
  CHAT_CLEARED,
  GROUP_MEMBER_UPDATED,
  MESSAGE_DELETED,
  NEW_MESSAGE,
  REFETCH_CHATS,
  UPDATE_LAST_MESSAGE,
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
          text = getLastMessagePreview(modifyMessage([prev],req.user)[0], req.user);
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
    return next(new customError("error deleting message for me",400 ))
  }
}

export async function deleteForEveryone(req, res, next) {
  try {
    const { messageId } = req.params;
    const { messageInfo, chatId } = req.body;

    if (!messageId || !messageInfo) {
      return next(new customError("message id and message info both are required", 404));
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

    // emitEvent(req, ALERT, allMembers, "welcome to group");
    // emitEvent(req, REFETCH_CHATS, members, "chat list refreshed");
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
  console.log("hey reached the backend");
  try {
    // Get user's chat relationships with their personalized last messages
    const userChats = await UserChat.find({ userId: req.user })
      .populate({
        path: "chatId",
        populate: [
          {
            path: "members",
            select: "fullName avatar username email isOnline",
          },
          { path: "creator", select: "fullName avatar username" },
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
    };

    message = (await Message.create(messageForDB)).toObject();

    const lastMessagePreview = getLastMessagePreview(message);

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

    // Emit to all members - each will see the update in their chat list
    emitEvent(req, UPDATE_LAST_MESSAGE, chat.members, {
      chatId,
      lastMessageObj: {
        message: lastMessagePreview,
        messageId: message._id,
      },
      lastMessageTime: message.createdAt,
    });

    emitEvent(req, NEW_MESSAGE, chat.members, messageForRealTime);

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
