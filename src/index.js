// ----------- env file configuration

import dotenv from "dotenv";
dotenv.config();

// ------------- imports

import express from "express";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import messageRoutes from "./routes/message.routes.js";
import connectDB from "./utils/db.js";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { v4 as uuid } from "uuid";
// import { createUser } from '../seeders/user.js'
import { errorHandlerMiddleware } from "./middleware/error.js";
import { corsOptions } from "../constants/constants.js";
import { socketAuthenticator } from "./middleware/isAuthenticated.js";
import { getSockets } from "./utils/helpers.js";
import { NEW_MESSAGE, NEW_MESSAGE_ALERT } from "../constants/events.js";
import Message from "./models/msg.model.js";
import { createGroupChats, createMessages, createMessagesInAChat, createSingleChats } from "../seeders/chat.js";
import { createUser } from "../seeders/user.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
const port = process.env.PORT || 5000;
export const envMode = process.env.NODE_ENV.trim() || "PRODUCTION";
export const userSocketIDs = new Map();

// ------ Database connection
// console.log(process.env.MONGODB_URL)
connectDB(process.env.MONGODB_URL);

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

//------- Routes

// createMessages(100);
// createUser(30)
// createSingleChats(30)
// createGroupChats(30)
// createMessagesInAChat('68c132caf94b1217d59b6408',60)

app.get("/", (req, res) => {
  res.send("base route");
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/messages", messageRoutes);

// socket goes here
io.use((socket, next) => {
  cookieParser()(socket.request, {}, async (err) => {
    console.log("testing");
    if (err) return next(err);
    await socketAuthenticator(socket, next);
  });
});

io.on("connection", (socket) => {
  const user = socket.user;
  userSocketIDs.set(user._id.toString(), socket.id);
  // console.log("a user connected");

  const tempuser = {
    _id: "6788ugvjk",
    name: "satish",
  };

  socket.on("NEW_MESSAGE", async ({ chatId, members, message }) => {
    const msgForRealtime = {
      text: message,
      chat: chatId,
      sender: {
        _id: tempuser._id,
        name: tempuser._id,
      },
      _id: uuid(),
      createdAt: new Date().toISOString(),
    };

    const messageForDB = {
      text: message,
      sender: user._id,
      chat: chatId,
    };

    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(NEW_MESSAGE, {
      chatId,
      message: msgForRealtime,
    });
    io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });

    try {
      await Message.create(messageForDB);
    } catch (error) {
      throw new Error(error);
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// --------- global error handler ---------

app.use(errorHandlerMiddleware);

server.listen(port, () => {
  console.log(`server is listening on ${port} in ${envMode} mode`);
});
