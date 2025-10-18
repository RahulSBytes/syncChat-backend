import UserChat from "../models/UserChat.js";
import { areIdsEqual } from "../utils/helpers.js";
import { customError } from "./error.js";

export async function checkIfChatBlockedMiddleware(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user;

    // Check if current user has blocked this chat
    const userChat = await UserChat.find({
      chatId,
    }).populate("chatId", "groupChat");

    if (userChat[0].chatId.groupChat) {
     return next();
    }

    if ( userChat.some((el) => areIdsEqual(el.userId, userId) && el.isBlocked ) ) {
      return res.status(400).json({
      success: false,
      message :"You have blocked this chat. Unblock to send messages.",
    });
    }

    if ( userChat.some( (el) => !areIdsEqual(el.userId, userId) && el.isBlocked ) ) {
      return res.status(400).json({
      success: false,
      message :"Cannot send message - chat is unavailable",
    });
    }

    next();
  } catch (error) {
    console.error("Check blocked middleware error:", error);
    next(error);
  }
}
