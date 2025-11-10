// socket.js
import { getSockets, userSocketIDs } from "../utils/socketHelpers.js";
import { ONLINE_USERS, START_TYPING, STOP_TYPING } from "../../constants/events.js";

const onlineUsers = new Set();     
const userSockets = new Map(); 

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    const userId = String(socket.user._id);

    userSocketIDs.set(userId, socket.id);

    let sockets = userSockets.get(userId);
    const wasOnline = !!sockets && sockets.size > 0;

    if (!sockets) {
      sockets = new Set();
      userSockets.set(userId, sockets);
    }
    sockets.add(socket.id);
    if (!wasOnline) {
      onlineUsers.add(userId);
    }
    
    io.emit(ONLINE_USERS, Array.from(onlineUsers));

    // ------------typing
    const username = socket.user.username;

    // ✅ Handle typing start
    socket.on(START_TYPING, ({ chatId, members }) => {
      const memberSockets = getSockets(members.filter(el => el._id !== socket.user._id));
      socket.to(memberSockets).emit(START_TYPING, { 
        chatId,
        userId,
        username
      });
    });

    // ✅ Handle typing stop
    socket.on(STOP_TYPING, ({ chatId, members }) => {
      const memberSockets = getSockets(members.filter(id => id !== userId));
      socket.to(memberSockets).emit(STOP_TYPING, { 
        chatId,
        userId
      });
    });

    // --typing

    socket.on("disconnect", () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);

        if (userSocketIDs.get(userId) === socket.id) {
          const [anyRemaining] = set.values();
          if (anyRemaining) userSocketIDs.set(userId, anyRemaining);
          else userSocketIDs.delete(userId);
        }

        if (set.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          
          io.emit(ONLINE_USERS, Array.from(onlineUsers));
        }
      }
    });
  });
};

export default socketHandler;