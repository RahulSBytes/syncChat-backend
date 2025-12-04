// ----------- env file configuration

import dotenv from "dotenv";
dotenv.config();

// ------------- imports

import express from "express";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import messageRoutes from "./routes/message.routes.js";
import preferencesRoutes from "./routes/preferencesRoutes.js";
import connectDB from "./utils/db.js";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import socketHandler from "./utils/socket.js";
import { errorHandlerMiddleware } from "./middleware/error.js";
import { corsOptions } from "../constants/constants.js";
import socketAuthenticator from "./middleware/socketAuthenticator.js";

const app = express();
const server = createServer(app);

const port = process.env.PORT || 5000;
export const envMode = process.env.NODE_ENV.trim() || "PRODUCTION";
export const userSocketIDs = new Map();

connectDB(process.env.MONGODB_URL);

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("base route");
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/preferences", preferencesRoutes);

const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);

// socket goes here
io.use((socket, next) => {
  cookieParser()(
    socket.request,
    socket.request.res,
    async (err) => await socketAuthenticator(err, socket, next)
  );
});

socketHandler(io);

// --------- global error handler ---------

app.use(errorHandlerMiddleware);

server.listen(port, () => {
  console.log(`server is listening on ${port} in ${envMode} mode`);
});
