import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat: {
      // which chat this msg belongs to
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    text: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attachments: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "location", "file"],
      default: "text",
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
