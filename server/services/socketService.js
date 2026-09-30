const { Server } = require("socket.io");

let io = null;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(
      `WebSocket client connected: ${socket.id}`
    );

    socket.on("join-department", (departmentPrefix) => {
      if (!departmentPrefix) {
        return;
      }

      const room = `department:${departmentPrefix}`;

      socket.join(room);

      console.log(
        `Socket ${socket.id} joined ${room}`
      );
    });

    socket.on("disconnect", () => {
      console.log(
        `WebSocket client disconnected: ${socket.id}`
      );
    });
  });

  console.log(
    "WebSocket server initialized."
  );

  return io;
}

function getIO() {
  if (!io) {
    throw new Error(
      "WebSocket server has not been initialized."
    );
  }

  return io;
}

function emitQueueUpdated(
  departmentPrefix,
  payload = {}
) {
  if (!io || !departmentPrefix) {
    return;
  }

  io.to(
    `department:${departmentPrefix}`
  ).emit(
    "QUEUE_UPDATED",
    {
      departmentPrefix,
      ...payload,
      timestamp:
        new Date().toISOString(),
    }
  );
}

module.exports = {
  initializeSocket,
  getIO,
  emitQueueUpdated,
};