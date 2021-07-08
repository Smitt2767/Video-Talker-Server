const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

app.get("/", (req, res) => {
  res.send("hello");
});

let peers = [];
const broadcastingEvents = {
  ACTIVE_USERS: "ACTIVE_USERS",
  GROUP_CALL_ROOMS: "GROUP_CALL_ROOMS",
};

io.on("connection", (socket) => {
  socket.on("register-new-user", (data) => {
    peers.push({
      username: data.username,
      socketId: socket.id,
    });

    io.sockets.emit("broadcast", {
      event: broadcastingEvents.ACTIVE_USERS,
      activeUsers: peers,
    });
  });

  socket.on("pre-offer", (data) => {
    const callerData = {
      username: data.caller,
      socketId: socket.id,
    };

    io.to(data.callee.socketId).emit("pre-offer", callerData);
  });

  socket.on("pre-offer-answer", (data) => {
    io.to(data.callerSocketId).emit("pre-offer-answer", {
      answer: data.answer,
    });
  });

  socket.on("webRTC-offer", (data) => {
    io.to(data.connectedUserSocketId).emit("webRTC-offer", {
      offer: data.offer,
    });
  });
  socket.on("webRTC-answer", (data) => {
    io.to(data.connectedUserSocketId).emit("webRTC-answer", {
      answer: data.answer,
    });
  });
  socket.on("webRTC-candidate", (data) => {
    io.to(data.connectedUserSocketId).emit("webRTC-candidate", {
      candidate: data.candidate,
    });
  });
  socket.on("user-hangedup", (data) => {
    io.to(data.connectedUserSocketId).emit("user-hangedup");
  });

  socket.on("disconnect", () => {
    peers = peers.filter((peer) => peer.socketId !== socket.id);

    io.sockets.emit("broadcast", {
      event: broadcastingEvents.ACTIVE_USERS,
      activeUsers: peers,
    });
  });
});

server.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});
