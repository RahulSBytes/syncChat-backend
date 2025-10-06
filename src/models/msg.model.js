import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    attachments: [
      {
        public_id: String,
        url: String,
        fileType: String,
        fileSize: String,
        filename: String,

        deletedForEveryone: {
          type: Boolean,
          default: false,
        },
        deletedFor: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: [],
          },
        ],
        deletedAt: Date,
      },
    ],
    text: String,
    textDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
    textDeletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "file"],
      default: "text",
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
