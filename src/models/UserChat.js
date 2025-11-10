// models/UserChat.js
import mongoose from "mongoose";

const userChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    lastMessage: {
      message: {
        type: String,
        default: "no message yet",
      },
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    },
    lastMessageTime: Date,

    isActive: {
      type: Boolean,
      default: true,
    },
    leftAt: Date,

    isBlocked: {
      type: Boolean,
      default: false,
    },
    
    blockedAt: Date,

    // ✅ Unread count
    unreadCount: {
      type: Number,
      default: 0,
    },

    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true }
);

userChatSchema.index({ userId: 1, chatId: 1 }, { unique: true });
userChatSchema.index({ userId: 1, lastMessageTime: -1 });

const UserChat = mongoose.model("UserChat", userChatSchema);
export default UserChat;
