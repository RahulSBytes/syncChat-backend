import bcrypt from "bcryptjs";
import { customError } from "../middleware/error.js";
import User from "../models/user.model.js";
import UserPreferences from "../models/UserPreferences.js";
import { uploadFilesToCloudinary } from "../utils/helpers.js";



export const updatePassword = async (req, res, next) => {
  console.log("backend updatePassword");

  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user;

    // Validation
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Get user with password field
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update password error:", error);
    
    res.status(500).json({
      success: false,
      message: "Failed to update password",
      error: error.message,
    });
  }
};


export const getPreferences = async (req, res) => {
  try {
    let preferences = await UserPreferences.findOne({
      userId: req.UserPreferences,
    });

    if (!preferences) {
      preferences = await UserPreferences.create({ userId: req.user });
    }

    res.status(200).json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    return new customError("error fetching preferences", 404);
  }
};

export const updateAppearance = async (req, res) => {
  try {

    const allowedFields = {
      theme: "appearance.theme",
      fontSize: "appearance.fontSize",
      messageBubbleStyle: "messageBubbleStyle",
      accentColor: "accentColor",
      timeFormat: "timeFormat",
    };

    const updates = Object.fromEntries(
      Object.entries(req.body)
        .filter(([key]) => key in allowedFields)
        .map(([key, value]) => [allowedFields[key], value])
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );


    return res.status(200).json({
      success: true,
      message: "Appearance settings updated successfully",
      preferences,
    });
  } catch (error) {
    console.error("Update appearance error:", error);

    // Generic error
    return res.status(500).json({
      success: false,
      message: "Failed to update appearance settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


export const updateProfile = async (req, res, next) => {


  try {
    const { fullName, username, bio, email } = req.body;
    const userId = req.user;

    // Find current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return next(new customError('User not found', 404));
    }

    // Check if username or email is taken by another user
    if (username || email) {
      const existingUser = await User.findOne({
        _id: { $ne: userId }, // Exclude current user
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : [])
        ]
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return next(new customError('Email already in use', 409));
        }
        if (existingUser.username === username) {
          return next(new customError('Username already taken', 409));
        }
      }
    }

    // Prepare update data
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (email !== undefined) updateData.email = email;

    if (req.file) {
      const result = await uploadFilesToCloudinary([req.file]);
      updateData.avatar = result[0];
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password'); 

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return next(new customError('Invalid profile data', 400));
    }
    
    next(error);
  }
};



// ===== UPDATE PRIVACY SETTINGS =====
export const updatePrivacy = async (req, res) => {
  console.log("backend updatePrivacy",req.body);

  try {
    const { profilePhoto, onlineStatus, typingIndicator } = req.body;

    // Validate input
    const allowedFields = ["profilePhoto", "onlineStatus", "typingIndicator"];
    const updates = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[`privacy.${key}`] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Privacy settings updated",
      preferences,
    });
  } catch (error) {
    console.error("Update privacy error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid privacy settings",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update privacy settings",
      error: error.message,
    });
  }
};

// ===== UPDATE GENERAL SETTINGS =====
export const updateGeneralSettings = async (req, res) => {
  console.log("backend updateGeneralSettings", req.body);

  try {
    const allowedFields = [
      "messageBubbleStyle",
      "accentColor",
      "enterToSend",
      "notifications",
      "tickSound",
      "timeFormat",
    ];

    const updates = {};

    // Filter only allowed fields
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    // Validate accent color format
    if (updates.accentColor) {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexColorRegex.test(updates.accentColor)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid accent color format. Use hex format (e.g., #0084ff)",
        });
      }
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Settings updated",
      preferences,
    });
  } catch (error) {
    console.error("Update general settings error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid settings",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};

// ===== TOGGLE SINGLE SETTING =====
export const toggleSetting = async (req, res) => {
  console.log("backend getPreferences");

  try {
    const keys = Object.keys(req.body);

    if (keys.length !== 1) {
      return res.status(400).json({
        success: false,
        message: "Please provide exactly one setting to toggle",
      });
    }

    const key = keys[0];
    const value = req.body[key];

    const toggleableSettings = [
      "notifications",
      "tickSound",
      "enterToSend",
      "privacy.typingIndicator",
    ];

    const isNestedKey = key.includes(".");
    const settingPath = isNestedKey ? key : key;

    const isAllowed = toggleableSettings.some(
      (setting) => setting === settingPath || setting.startsWith(settingPath)
    );

    if (!isAllowed) {
      return res.status(400).json({
        success: false,
        message: `Cannot toggle setting: ${key}`,
      });
    }

    // Validate boolean value
    if (typeof value !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Toggle value must be boolean",
      });
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { [key]: value } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Setting toggled",
      preferences,
    });
  } catch (error) {
    console.error("Toggle setting error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to toggle setting",
      error: error.message,
    });
  }
};

// ===== RESET TO DEFAULTS =====
export const resetPreferences = async (req, res) => {
  console.log("backend resetPreferences");

  try {
    await UserPreferences.findOneAndDelete({ userId: req.user._id });

    const preferences = await UserPreferences.create({ userId: req.user._id });

    res.status(200).json({
      success: true,
      message: "Preferences reset to defaults",
      preferences,
    });
  } catch (error) {
    console.error("Reset preferences error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reset preferences",
      error: error.message,
    });
  }
};

// ===== UPDATE MULTIPLE SETTINGS AT ONCE (OPTIONAL) =====
export const updateMultipleSettings = async (req, res) => {
  console.log("backend updateMultipleSettings");

  try {
    const { appearance, privacy, ...generalSettings } = req.body;

    const updates = {};

    // Handle appearance updates
    if (appearance) {
      Object.keys(appearance).forEach((key) => {
        updates[`appearance.${key}`] = appearance[key];
      });
    }

    if (privacy) {
      Object.keys(privacy).forEach((key) => {
        updates[`privacy.${key}`] = privacy[key];
      });
    }

    const allowedGeneralFields = [
      "messageBubbleStyle",
      "accentColor",
      "enterToSend",
      "notifications",
      "tickSound",
      "timeFormat",
    ];

    Object.keys(generalSettings).forEach((key) => {
      if (allowedGeneralFields.includes(key)) {
        updates[key] = generalSettings[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      preferences,
    });
  } catch (error) {
    console.error("Update multiple settings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};
