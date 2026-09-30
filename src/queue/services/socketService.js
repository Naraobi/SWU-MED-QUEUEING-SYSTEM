import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:5000";

const socket = io(SOCKET_URL, {
  autoConnect: true,
});

console.log("SOCKET SERVICE LOADED:", SOCKET_URL);

socket.on("connect", () => {
  console.log("WebSocket connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("WebSocket disconnected:", reason);
});

export function connectSocket() {
  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export function joinDepartment(departmentPrefix) {
  if (!departmentPrefix) {
    return;
  }

  socket.emit("join-department", departmentPrefix);
}

export function onQueueUpdated(callback) {
  socket.on("QUEUE_UPDATED", callback);

  return () => {
    socket.off("QUEUE_UPDATED", callback);
  };
}

export default socket;