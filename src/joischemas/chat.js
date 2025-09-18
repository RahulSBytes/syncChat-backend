import Joi from "joi";

export const chatSchema = Joi.object({
name : Joi.string().trim().required().max(25),
members: Joi.array().items(Joi.string()).min(2).unique().required(),
});

