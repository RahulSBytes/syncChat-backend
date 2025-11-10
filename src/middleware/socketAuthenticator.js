import jwt from "jsonwebtoken";
import User from "../models/user.model.js"; 
import { customError } from "./error.js";

const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) throw err;
    
    const token = socket.request.cookies["synqchat-token"]; 

    if (!token) next(new customError("No authentication token provided", 400));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id); 

    if (!user) next(new customError("user not found", 404));

    socket.user = {
      _id: user._id,
      username: user.username,
      avatar: {
        public_id: user.avatar.public_id,
        url: user.avatar.url,
      },
      fullName: user.fullName,
    };

    next();
  } catch (error) {
    console.error("Socket authentication failed:", error);
    next(new customError("authentication failed", 401));
  }
};

export default socketAuthenticator;
