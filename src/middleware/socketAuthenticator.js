import jwt from "jsonwebtoken";
import User from "../models/user.model.js"; 
import { customError } from "./error.js";

const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) return next(err);
    
    const token = socket.request.cookies["synqchat-token"]; 

     if (!token) {
      return next(new customError("No authentication token provided", 400)); // ✅ Add return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id); 

    if (!user) {
      return next(new customError("user not found", 404)); // ✅ Add return
    }

    socket.user = {
      _id: user._id,
      username: user.username,
      avatar: {
        public_id: user.avatar.public_id,
        url: user.avatar.url,
      },
      fullName: user.fullName,
    };

  return next();
  } catch (error) {
    console.error("Socket authentication failed:", error);
  return next(new customError("authentication failed", 401));
  }
};

export default socketAuthenticator;
