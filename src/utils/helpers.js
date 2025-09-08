import jwt from 'jsonwebtoken'
import { userSocketIDs } from '../index.js';
import { v4 as uuid } from "uuid";
import {cloudinary} from '../utils/cloudinaryconfig.js'

const cookieOptions = {
 maxAge: 7 * 24 * 60 * 60 * 1000,
  sameSite: "lax",  
  httpOnly: true,
  secure: false, 
};

function sendToken(res, savedUserData) {
  const token = jwt.sign({ _id: savedUserData._id }, process.env.JWT_SECRET);
  return res.status(201).cookie("synqchat-token", token, cookieOptions).json({
    success: true,
    token,
    savedUserData,
  });  // sending the response as well as setting the cookie
}


const emitEvent = (req, event, users, data ='')=>{
  console.log("event emitted", event);
}

const getSockets = (users = []) => {
  const sockets = users.map((user) => userSocketIDs.get(user.toString()));
  return sockets;
};




// Convert file buffer to base64 string
const getBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};


// Upload multiple files to Cloudinary manually
export const uploadFilesToCloudinary = async (files = []) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);

    const formattedResults = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
    return formattedResults;
  } catch (err) {
    throw new Error("Error uploading files to cloudinary", err);
  }
};





export {cookieOptions, sendToken, emitEvent, getSockets}