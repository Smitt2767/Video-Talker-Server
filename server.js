const express = require("express");
const app = express();
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});

const { ExpressPeerServer } = require("peer");
const { createPeerServerListeners } = require("./groupCallHandler");
const { v4: uuidV4 } = require("uuid");

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
});

app.use("/peerjs", peerServer);

createPeerServerListeners(peerServer);

app.get("/", (req, res) => {
  res.send("hello");
});

let peers = [];
let rooms = [];
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
    io.sockets.emit("broadcast", {
      event: broadcastingEvents.GROUP_CALL_ROOMS,
      rooms,
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

  socket.on("group-call-register", (data) => {
    const roomId = uuidV4();
    socket.join(roomId);
    const room = {
      roomId,
      hostname: data.username,
      peerId: data.peerId,
      socketId: socket.id,
    };

    rooms.push(room);

    io.sockets.emit("broadcast", {
      event: broadcastingEvents.GROUP_CALL_ROOMS,
      rooms,
    });
  });

  socket.on("group-call-join-request", (data) => {
    io.to(data.roomId).emit("group-call-join-request", {
      peerId: data.peerId,
      streamId: data.streamId,
    });
    socket.join(data.roomId);
  });

  socket.on("group-call-user-left", (data) => {
    socket.leave(data.roomId);

    io.to(data.roomId).emit("group-call-user-left", {
      streamId: data.streamId,
    });
  });

  socket.on("group-call-close-by-host", (data) => {
    rooms = rooms.filter((room) => room.peerId !== data.peerId);

    io.sockets.emit("broadcast", {
      event: broadcastingEvents.GROUP_CALL_ROOMS,
      rooms,
    });
  });

  socket.on("disconnect", () => {
    peers = peers.filter((peer) => peer.socketId !== socket.id);

    io.sockets.emit("broadcast", {
      event: broadcastingEvents.ACTIVE_USERS,
      activeUsers: peers,
    });
  });
});
