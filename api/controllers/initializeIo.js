const { Server } = require("socket.io");

let io;

const initializeIo = (server) => {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          process.env.CLIENT_URL,
        ].filter(Boolean),
        credentials: true,
      },
    });
  }
  return io;
};

module.exports = initializeIo;