import { compare } from "bcryptjs";
import User from "../models/user.model.js";
import {
  cookieOptions,
  sendToken,
  uploadFilesToCloudinary,
} from "../utils/helpers.js";
import { customError } from "../middleware/error.js";
import mongoose from "mongoose";

export async function registerUser(req, res, next) {
  const { username, fullName, email, bio, password } = req.body;
  const isExists = await User.findOne(
    { $or: [{ email }, { username }] },
    "username email"
  );

  if (isExists) {
    if (isExists.email == email)
      return next(new customError("user with same email exists", 409));
    if (isExists.username == username)
      return next(new customError("user with same username exists", 409));
  }

  const result = [
    {
      public_id: "3287348e-d90e-4bf7-9a19-c2febc9d1927",
      url: "https://res.cloudinary.com/dgmgecezm/image/upload/v1757299608/3287348e-d90e-4bf7-9a19-c2febc9d1927.jpg",
    },
  ];

  // const result = await uploadFilesToCloudinary([req.file]);
  //   // console.log("cloudinary result :: ", result);

  const createdUser = await User.create({
    username,
    bio,
    password,
    fullName,
    email,
    avatar: result[0],
  });

  // console.log("saved user data ::", createdUser);
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

  // console.log(user)
  sendToken(res, user);
  // res.status(200).json(user);
}

export async function logoutUser(req, res) {
  console.log("reached backend")
  return res.clearCookie("synqchat-token", cookieOptions).status(200).json({
    message: "successfully logged out",
  });
}
