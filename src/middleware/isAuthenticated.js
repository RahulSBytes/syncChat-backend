import User from "../models/user.model.js";
import { customError } from "../middleware/error.js";
import Jwt from "jsonwebtoken";

export default function isAuthenticated(req, res, next) {
  const token = req.cookies["synqchat-token"];
  if (!token)
    return next(new customError("you need to login to access this route", 404));
  const decoded = Jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded._id; 
  next();
}

export const socketAuthenticator = async (socket, next) => {
  try {
    const token = socket.request.cookies["synqchat-token"];
    if (!token) {
      return next(new customError("Please login to access this route", 401));
    }

    const decoded = Jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded._id);

    if (!user) {
      return next(new customError("Please login to access this route", 401));
    }
    socket.user = user;
    return next();
  } catch (error) {
    console.error("Socket auth failed:", error);
    return next(new customError("Please login to access this route", 401));
  }
};
