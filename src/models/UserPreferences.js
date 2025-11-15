// models/UserPreferences.js
import mongoose from "mongoose";

const userPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    appearance: {
      theme: {
        type: String,
        enum: ["light", "dark"],
        default: "dark",
      },
      fontSize: {
        type: String,
        enum: ["small", "medium", "large", "extra-large"],
        default: "medium",
      },
      chatWallpaper: {
        type: String,
        default: null,
      },
    },

    // ===== PRIVACY SETTINGS =====
    privacy: {
      profilePhoto: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      onlineStatus: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      typingIndicator: {
        type: Boolean,
        default: true,
      },
    },

    messageBubbleStyle: {
      type: String,
      enum: ["rounded", "sharp", "minimal"],
      default: "rounded",
    },

    accentColor: {
      type: String,
      default: "#0084ff",
    },
    
    enterToSend: {
      type: Boolean,
      default: true, 
    },

    notifications: {
      type: Boolean,
      default: true,
    },

    ticKsound: {
      type: Boolean,
      default: true,
    },

    timeFormat: {
      type: String,
      enum: ["12h", "24h"],
      default: "12h",
    },
  },
  { timestamps: true }
);

const UserPreferences = mongoose.model(
  "UserPreferences",
  userPreferencesSchema
);
export default UserPreferences;
