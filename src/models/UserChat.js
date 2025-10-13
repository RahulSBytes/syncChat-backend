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

    // still a member of the group or not
    isActive: {
      type: Boolean,
      default: true,
    },
    leftAt: Date,

    //blocking
    isBlocked: {
      type: Boolean,
      default: false,
    },
    
    blockedAt: Date,

    // // Bonus: other user-specific data
    // unreadCount: { type: Number, default: 0 },
    // isPinned: { type: Boolean, default: false },
    // isMuted: { type: Boolean, default: false },
    // isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index for fast lookups
userChatSchema.index({ userId: 1, chatId: 1 }, { unique: true });
userChatSchema.index({ userId: 1, lastMessageTime: -1 });

const UserChat = mongoose.model("UserChat", userChatSchema);
export default UserChat;
