const { Server } = require("socket.io");

let io;

const initializeIo = (server) => {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: "http://localhost:5173",
      },
    });
  }
  return io;
};

module.exports = initializeIo;
