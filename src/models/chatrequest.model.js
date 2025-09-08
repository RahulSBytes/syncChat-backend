import mongoose from "mongoose";

const chatRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const ChatRequest = mongoose.model("ChatRequest", chatRequestSchema);

export default ChatRequest;
