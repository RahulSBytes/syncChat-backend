import Chat from "../models/chat.model";
import UserChat from "../models/UserChat";

export async function checkIfChatBlockedMiddleware(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user;

    // Check if current user has blocked this chat
    const userChat = await UserChat.findOne({
      userId,
      chatId,
      isBlocked: true,
    });

    if (userChat) {
      return next(
        new customError("You have blocked this chat. Unblock to send messages.", 403)
      );
    }

    // Optional: Check if other user (in DM) has blocked you
    const chat = await Chat.findById(chatId).select("members groupChat");
    
    if (chat && !chat.groupChat) {
      const otherUserId = chat.members.find(
        (id) => String(id) !== String(userId)
      );

      const otherUserChat = await UserChat.findOne({
        userId: otherUserId,
        chatId,
        isBlocked: true,
      });

      if (otherUserChat) {
        return next(
          new customError("Cannot send message - chat is unavailable", 403)
        );
      }
    }

    next();
  } catch (error) {
    console.error("Check blocked middleware error:", error);
    next(error);
  }
}