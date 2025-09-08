import Joi from "joi";

export const signinSchema = Joi.object({
fullName : Joi.string().trim().required().max(30),
username:Joi.string().required().trim().min(3),
bio: Joi.string().max(200),
email: Joi.string().email().required(),
password : Joi.string().pattern(/^[A-Za-z][A-Za-z0-9-]*$/).min(6).required(),
});


export const loginSchema = Joi.object({
username:Joi.string().required().trim(),
password : Joi.string().required(),
});


