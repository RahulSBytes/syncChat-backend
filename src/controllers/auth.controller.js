import { compare } from "bcryptjs";
import User from "../models/user.model.js";
import {
  cookieOptions,
  sendToken,
  uploadFilesToCloudinary,
} from "../utils/helpers.js";
import { customError } from "../middleware/error.js";

export async function registerUser(req, res, next) {

  console.log("reached registerUser")

  const { username, fullName, email, bio, password } = req.body;
  const isExists = await User.findOne(
    { $or: [{ email }, { username }] },
    "username email"
  );

  if (isExists) {
    return next(new customError("user with same credential exists", 409));
  }

  let result;
  if(req.file){
    result = await uploadFilesToCloudinary([req.file]);
  }

  const createdUser = await User.create({
    username,
    bio,
    password,
    fullName,
    email,
    avatar: result[0],
  });

  sendToken(res, createdUser);
}

export async function loginUser(req, res, next) {
  if (!req.body) {
    return next(new customError("Missing request body", 404));
  }
  const { username, password } = req.body;
  const user = await User.findOne({ username }).select("+password");
  if (!user) return next(new customError("invalid credential", 404));
  const isMatched = await compare(password, user.password);
  if (!isMatched)
    return next(new customError("something went wrong logging in", 404));

  sendToken(res, user);
}

export async function logoutUser(req, res) {
  return res.clearCookie("synqchat-token", cookieOptions).status(200).json({
    message: "successfully logged out",
    success: true,
  });
}
