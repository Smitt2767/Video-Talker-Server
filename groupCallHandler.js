module.exports.createPeerServerListeners = (peerServer) => {
  peerServer.on("connection", (client) => {
    console.log(client.id);
  });
};
