import { NEW_REQUEST } from "../../constants/events.js";
import { customError } from "../middleware/error.js";
import Chat from "../models/chat.model.js";
import ChatRequest from "../models/chatrequest.model.js";
import User from "../models/user.model.js";
import { emitEvent } from "../utils/helpers.js";

export function getSpecificUser(req, res) {
  res.send(`user ${req.params.id} data`);
}

export async function getMyProfile(req, res, next) {
  const user = await User.findById(req.user);
  return res.status(200).json({
    sucess: true,
    data: user,
  });
}




export async function searchUser(req, res, next) {
  const { name } = req.body || {};

  const chats = await Chat.find(
    {
      groupChat: false,
      members: req.user,
    },
    "members"
  ).lean();

  const chattedWithIds = chats
    .map((chat) =>
      chat.members.filter((id) => id.toString() !== req.user.toString())
    )
    .flat()
    .map((id) => id.toString());

  const uniqueChattedIds = [...new Set(chattedWithIds), req.user.toString()];

  const searchQuery = {
    _id: { $nin: uniqueChattedIds },
    ...(name && {
      $or: [
        { fullName: { $regex: name, $options: "i" } },
        { username: { $regex: name, $options: "i" } },
      ],
    }),
  };

  const availableUsers = await User.find(
    searchQuery,
    "fullName username avatar"
  ).limit(20);

  return res.status(200).json({
    success: true,
    data: availableUsers,
  });
}



export async function getAllFriendRequest(req, res, next) {
  const chats = await ChatRequest.findById(req.user);
  if (!chats)
    return next(
      new customError("error fetching sent friend requests ::", chats)
    );
  return res.status(200).json({
    success: true,
    data: chats,
  });
}

export async function sendFriendRequest(req, res, next) {
  const userId = req.query.q;
  if (!userId) return next(new customError("must provide reciever's id", 400));

  const request = await ChatRequest.findOne({
    $or: [
      { receiver: userId, sender: req.user },
      { receiver: req.user, sender: userId },
    ],
  });

  if (request) return next(new customError("request is already there", 200));

  const sendRequest = await ChatRequest.create({
    receiver: userId,
    sender: req.user,
  });

  if (!sendRequest)
    return next(new customError("something went wrong sending request", 200));

  emitEvent(req, NEW_REQUEST, [userId]);

  return res.status(200).json({
    success: true,
    data: sendRequest,
  });
}

export async function respondFriendRequest(req, res, next) {
  const { requestId, accept = true } = req.body || {};
  if (!requestId)
    return next(new customError("must provide reciever's id", 400));

  const request = await ChatRequest.findById(requestId);
  if (!request) return next(new customError("request not found", 400));

  if (request.receiver.toString() != req.user.toString())
    return next(
      new customError("you aren't allowed to accept/reject the request")
    );

  let message = "";

  if (accept) {
    await Promise.all([
      Chat.create({ members: [request.sender, req.user] }),
      ChatRequest.deleteOne({ _id: requestId }),
    ]);
    message = "friend request accepted";
  } else {
    await ChatRequest.deleteOne({ _id: requestId });
    message = "friend request rejected";
  }

  emitEvent(req, REFETCH_CHATS, [request.sender, req.user]);

  return res.status(200).json({
    success: true,
    message: message,
  });
}

export async function notifications(req, res, next) {
  // console.log(req.user)
  const data = await ChatRequest.find({ receiver: req.user }).populate(
    "sender",
    "fullName username avatar"
  );

  if (!data) return next(new customError("error fetching notifications", 200));

  return res.status(200).json({
    success: true,
    data: data,
  });
}
