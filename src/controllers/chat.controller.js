import { faker } from "@faker-js/faker";
import {
  ALERT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../../constants/events.js";
import { customError } from "../middleware/error.js";
import Chat from "../models/chat.model.js";
import Message from "../models/msg.model.js";
import { emitEvent } from "../utils/helpers.js";
import User from "../models/user.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";

// ############----- create a chat

export async function createGroupChat(req, res, next) {
  const { name, members } = req.body || {};
  if (!name || !members)
    next(new customError("name and members are required", 400));

  const allMembers = [...members, req.user];

  const group = await Chat.create({
    name,
    members: allMembers,
    groupChat: true,
    creator: req.user,
  });

  emitEvent(req, ALERT, allMembers, "welcome to group");
  emitEvent(req, REFETCH_CHATS, members, "chat list refreshed");

  if (!group) return next(new customError("error creating group", 400));
  return res.status(200).json({
    success: true,
    message: "group successfully created",
    groupData: group,
  });
}

// ############----- Get all chats of a user

export async function getAllChat(req, res, next) {
  const chats = await Chat.find({
    members: { $in: [req.user] },
  }).populate("members", "fullName username avatar");

  if (!chats) return next(new customError("error fetching chats", 400));

  return res.status(201).json({
    success: true,
    message: "here are the chats",
    chats: chats,
  });
}

// ############----- add member

export async function addMembers(req, res, next) {
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return next(new customError("chatId and userId are required", 400));
  }

  const chat = await Chat.findById(chatId, "members creator"); // new learning

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  if (chat.members.length === 2) {
    return next(new customError("this is not a group chat", 404));
  }

  if (chat.creator != req.user) {
    return next(new customError("you are not allowed to add members", 404));
  }

  if (chat.members.includes(userId)) {
    return next(new customError("User is already a member of this group", 400));
  }

  const addeduserdata = await Chat.updateOne(
    { _id: chatId },
    { $addToSet: { members: userId } }
  );

  console.log(addeduserdata);

  emitEvent(req, ALERT, chat.members, "the user added sucessfully");
  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(201).json({
    success: true,
    message: "member added",
  });
}

// ############----- remove member

export async function removeMember(req, res, next) {
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return next(new customError("chatId and userId are required", 400));
  }

  const chat = await Chat.findById(chatId, "members creator"); // new learning

  if (!chat) {
    return next(new customError("Chat not found", 404));
  }

  if (chat.creator != req.user) {
    return next(new customError("you are not allowed to remove members", 404));
  }

  if (!chat.members.includes(userId)) {
    return next(new customError("User is not a member of this group", 400));
  }

  await Chat.updateOne({ _id: chatId }, { $pull: { members: userId } });

  const leftUsers = chat.members.filter((el) => el != userId);

  emitEvent(req, ALERT, leftUsers, "member removed");
  emitEvent(req, REFETCH_CHATS, chat.members);

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
  // console.log(req.body)
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

export async function sendAttachment(req, res, next) {
  const { chatId } = req.body;

  const files = req.files || [];

  // console.log(files);

  if (files.length < 1)
    return next(new customError("Please Upload Attachments", 400));

  if (files.length > 5)
    return next(new customError("Files Can't be more than 5", 400));

  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "name"),
  ]);

  if (!chat) return next(new customError("Chat not found", 404));

  // if (files.length < 1)
  //   return next(new ErrorHandler("Please provide attachments", 400));

  //   Upload files here
  // const attachments = await uploadFilesToCloudinary(files);

  const messageForDB = {
    text: faker.lorem.sentence(),
    attachments: faker.image.avatar(),
    sender: me._id,
    chat: chatId,
  };

  const messageForRealTime = {
    ...messageForDB,
    sender: {
      _id: me._id,
      name: me.name,
    },
  };

  const message = await Message.create(messageForDB);

  emitEvent(req, NEW_MESSAGE, chat.members, {
    message: messageForRealTime,
    chatId,
  });

  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

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

export async function getAllMessagesOfAchat(req, res, next) {
  const { chatId, page = 1 } = req.body;

  if (!chatId) {
    return next(new customError("chatId id required", 400));
  }

  const resultPerPage = 20;

  const skip = (page - 1) * resultPerPage;

  const [messages, totalMsgCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resultPerPage)
      .populate("sender", "fullName avatar"),
    Message.countDocuments({ chat: chatId }),
  ]);

  const totalPages = Math.ceil(totalMsgCount / resultPerPage);

  return res.status(200).json({
    success: true,
    chat: messages.reverse(),
    totalPages,
  });
}
