import mongoose from "mongoose";
import { hash } from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    bio: {
      type: String,
      maxlength: 200,
      default: "happy chating",
    },
    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      minlength: 3,
      // maxlength: 20,
      // match: /^[A-Za-z][A-Za-z0-9-]*$/,
    },
    avatar: {
      public_id: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 6,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await hash(this.password, 10);
});

const User = mongoose.model("User", userSchema);

export default User;
