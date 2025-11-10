import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    name: String,
    groupChat: {
      type: Boolean,
      default: false,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    description: String,
    avatar: {
      public_id: { type: String, default: null },
      url: { type: String, default: null },
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    removedMembers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      removedAt: Date,
    }],
  },
  { timestamps: true }
);


const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
