import { signinSchema } from "../joischemas/auth.js";
import { customError } from "./error.js";

export function validateSignin(req, res, next) {
  const { username, fullName, password, bio, email } = req.body;
  const { error } = signinSchema.validate(
    { username, fullName, password, bio, email },
    { abortEarly: true }
  );

  if (error) 
    return next(new customError("error validating the credentials", 404));
  next();
}
