const userSocketIDs = new Map();

// a function to emit events in server-side
const emitEvent = (req, event, users, data) => {
  const io = req.app.get("io");
  const usersSocket = getSockets(users);
  io.to(usersSocket).emit(event, data);
};

// hum users ka array denge that contains mongodb's _id and this function turns it to array containing soket's socket.id
export const getSockets = (users = []) => {
  const sockets = users.map((user) => userSocketIDs.get(user._id.toString()));
  return sockets;
};

// console.log("fggff",getSockets())

export { emitEvent, userSocketIDs };
