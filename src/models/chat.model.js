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
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      text: String,
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      senderName: String,
      timestamp: Date,
      messageType: {
        type: String,
        enum: ["text", "image", "file", "audio"],
        default: "text",
      },
      isDeleted: { type: Boolean, default: false },
    },

    lastMessageTime: Date,
  },
  { timestamps: true }
);

// // chat handler
// function validateChatData(data, next) {
// console.log(data);

//   if (data.groupChat) {
//     if (!data.name || !data.creator) return next(new Error("Name as well as creator is required for group chats"));
//   } else {
//     if (!data.members || data.members.length > 2) {
//       return next(new Error("Private chats must have exactly 2 members"));
//     }
//   }
//   next();
// }

// chatSchema.pre(
//   ["save", "findOneAndUpdate", "updateOne", "updateMany"],
//   function (next) {
//     let dataToValidate = this.op ? this.getUpdate() : this;
//     validateChatData(dataToValidate, next);
//   }
// );

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
