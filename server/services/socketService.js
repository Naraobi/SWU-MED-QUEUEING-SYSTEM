
const { Server } = require("socket.io");

let io = null;

const allowedOrigins = require("../config/corsOrigins");

// Initialize Socket.IO server
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Handle client connections
  io.on("connection", (socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    // Join department-specific room
    socket.on("join-department", (departmentPrefix) => {
      if (!departmentPrefix) {
        return;
      }

      const room = `department:${departmentPrefix}`;

      socket.join(room);

      console.log(`Socket ${socket.id} joined ${room}`);
    });

    // Handle client disconnection
    socket.on("disconnect", () => {
      console.log(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  console.log("WebSocket server initialized.");

  return io;
}

// Get Socket.IO instance
function getIO() {
  if (!io) {
    throw new Error("WebSocket server has not been initialized.");
  }

  return io;
}

// Emit queue updates to a specific department
function emitQueueUpdated(departmentPrefix, payload = {}) {
  if (!io || !departmentPrefix) {
    return;
  }

  io.to(`department:${departmentPrefix}`).emit("QUEUE_UPDATED", {
    departmentPrefix,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

// Export functions
module.exports = {
  initializeSocket,
  getIO,
  emitQueueUpdated,
};
