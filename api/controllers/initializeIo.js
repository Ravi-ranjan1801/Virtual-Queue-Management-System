const { Server } = require("socket.io");

let io;

const initializeIo = (server) => {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "https://virtual-queue-management-system.vercel.app",
          process.env.CLIENT_URL,
        ].filter(Boolean),
        credentials: true,
      },
    });
  }
  return io;
};

module.exports = initializeIo;