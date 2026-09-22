const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Matchmaking state (In-Memory / Zero DB)
let waitingQueue = [];
const activeRooms = new Map(); // socket.id -> { partnerId, roomId }

function getOnlineCount() {
  return io.engine.clientsCount;
}

function broadcastOnlineCount() {
  io.emit('online_count', { count: getOnlineCount() });
}

function removeFromQueue(socketId) {
  waitingQueue = waitingQueue.filter((id) => id !== socketId);
}

function cleanupUser(socketId, notifyPartner = true) {
  // Remove from waiting queue if present
  removeFromQueue(socketId);

  // Check if user was in an active room
  if (activeRooms.has(socketId)) {
    const { partnerId, roomId } = activeRooms.get(socketId);

    // Remove current user
    activeRooms.delete(socketId);

    // Notify & cleanup partner
    if (activeRooms.has(partnerId)) {
      activeRooms.delete(partnerId);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.leave(roomId);
        if (notifyPartner) {
          partnerSocket.emit('partner_disconnected', {
            message: 'Stranger has disconnected.'
          });
        }
      }
    }
  }
}

function matchUser(socket) {
  // First clean up any existing room or queue status
  cleanupUser(socket.id, true);

  // Check queue for a valid waiting partner
  while (waitingQueue.length > 0) {
    const potentialPartnerId = waitingQueue.shift();

    // Check if partner is still connected and not the same socket
    const partnerSocket = io.sockets.sockets.get(potentialPartnerId);
    if (partnerSocket && potentialPartnerId !== socket.id) {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Join both to the room
      socket.join(roomId);
      partnerSocket.join(roomId);

      // Record active rooms
      activeRooms.set(socket.id, { partnerId: potentialPartnerId, roomId });
      activeRooms.set(potentialPartnerId, { partnerId: socket.id, roomId });

      // Notify both clients
      socket.emit('chat_start', { roomId });
      partnerSocket.emit('chat_start', { roomId });
      return;
    }
  }

  // If no partner available, push to waiting queue
  waitingQueue.push(socket.id);
  socket.emit('waiting_for_partner');
}

io.on('connection', (socket) => {
  broadcastOnlineCount();

  // Send current online count immediately to newly connected client
  socket.emit('online_count', { count: getOnlineCount() });

  // Start searching for a partner
  socket.on('find_partner', () => {
    matchUser(socket);
  });

  // Cancel search
  socket.on('cancel_search', () => {
    removeFromQueue(socket.id);
    socket.emit('search_cancelled');
  });

  // Sending a message
  socket.on('send_message', (data) => {
    if (!data || typeof data.text !== 'string') return;
    const trimmedText = data.text.trim();
    if (!trimmedText || trimmedText.length > 1500) return; // Prevent spam/massive payloads

    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('receive_message', {
          text: trimmedText,
          timestamp: Date.now()
        });
      }
    }
  });

  // Typing indicators
  socket.on('typing', () => {
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_typing');
      }
    }
  });

  socket.on('stop_typing', () => {
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_stop_typing');
      }
    }
  });

  // Next / Skip partner
  socket.on('next_partner', () => {
    matchUser(socket);
  });

  // Disconnect / Leave chat
  socket.on('leave_chat', () => {
    cleanupUser(socket.id, true);
    socket.emit('chat_ended');
  });

  // Socket disconnected
  socket.on('disconnect', () => {
    cleanupUser(socket.id, true);
    broadcastOnlineCount();
  });
});

server.listen(PORT, () => {
  console.log(`[AnonChat] Server running smoothly on http://localhost:${PORT}`);
});
