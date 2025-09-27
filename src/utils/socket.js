// socket.js
import { getSockets, userSocketIDs } from "../utils/socketHelpers.js";
import { ONLINE_USERS, START_TYPING, STOP_TYPING } from "../../constants/events.js";

const onlineUsers = new Set();     
const userSockets = new Map(); 

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    const userId = String(socket.user._id);

    // Keep your single-id map if other code relies on it
    userSocketIDs.set(userId, socket.id);

    // Track all sockets for this user (multi-tab/device safe)
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

        // Keep userSocketIDs pointing to a live socket if any
        if (userSocketIDs.get(userId) === socket.id) {
          // pick any remaining socket as the primary
          const [anyRemaining] = set.values();
          if (anyRemaining) userSocketIDs.set(userId, anyRemaining);
          else userSocketIDs.delete(userId);
        }

        // If this was the last socket, user goes offline
        if (set.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          
          // ✅ FIX: Emit to ALL connected users (not just the disconnecting socket)
          io.emit(ONLINE_USERS, Array.from(onlineUsers));
        }
      }
    });
  });
};

export default socketHandler;