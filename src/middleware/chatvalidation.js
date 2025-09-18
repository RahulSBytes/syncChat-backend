import { chatSchema } from "../joischemas/chat.js";
import { customError } from "./error.js";

export function chatValidation(req, res, next) {
  console.log("reached validation...");

  const { name, members } = req.body;
  const { error } = chatSchema.validate(
    { name, members },
    { abortEarly: true }
  );

  if (error)
    return next(new customError("error validating chat credentials", 404));
  next();
}
