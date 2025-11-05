
import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("Admin connected:", socket.id);
    socket.on("joinDashboard", () => socket.join("admin-dashboard"));
  });

  return io;
};

export const emitOrderUpdate = () => {
  if (io) io.to("admin-dashboard").emit("orderUpdated");
};
