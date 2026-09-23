const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Maintenance Mode: Instant toggle via Render Console ('npm run maintenance:on' or 'touch .maintenance')
const MAINTENANCE_FILE = path.join(__dirname, '.maintenance');
function isMaintenanceActive() {
  return process.env.MAINTENANCE_MODE === 'true' || fs.existsSync(MAINTENANCE_FILE);
}

app.use((req, res, next) => {
  if (isMaintenanceActive()) {
    if (req.path.startsWith('/socket.io/')) {
      return res.status(503).json({ error: 'Maintenance mode active' });
    }
    if (req.path === '/' || req.path.endsWith('.html') || !path.extname(req.path)) {
      res.status(503);
      return res.sendFile(path.join(__dirname, 'public', 'maintenance.html'));
    }
  }
  next();
});

// Reject Socket.io connections while maintenance is enabled
io.use((socket, next) => {
  if (isMaintenanceActive()) {
    return next(new Error('MAINTENANCE_MODE'));
  }
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Matchmaking state (In-Memory / Zero DB)
let waitingQueue = [];
const activeRooms = new Map(); // socket.id -> { partnerId, roomId }

// Rate limiting & DoS guards (Sliding window on socket.data, 0 extra deps)
function isRateLimited(socket, limit = 6, windowMs = 2000) {
  const now = Date.now();
  if (!socket.data.msgTimestamps) socket.data.msgTimestamps = [];
  socket.data.msgTimestamps = socket.data.msgTimestamps.filter((t) => now - t < windowMs);
  if (socket.data.msgTimestamps.length >= limit) return true;
  socket.data.msgTimestamps.push(now);
  return false;
}

function isActionThrottled(socket, minIntervalMs = 500) {
  const now = Date.now();
  if (socket.data.lastAction && now - socket.data.lastAction < minIntervalMs) return true;
  socket.data.lastAction = now;
  return false;
}

let onlineBroadcastTimer = null;
function broadcastOnlineCount(delay = 1500) {
  if (onlineBroadcastTimer) return;
  onlineBroadcastTimer = setTimeout(() => {
    onlineBroadcastTimer = null;
    io.emit('online_count', { count: io.engine.clientsCount });
  }, delay);
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

    // FIX: Leave room for initiating socket (eliminates ghost room leak)
    const currentSocket = io.sockets.sockets.get(socketId);
    if (currentSocket) currentSocket.leave(roomId);

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
  socket.data = { msgTimestamps: [], lastAction: 0 };
  broadcastOnlineCount();

  // Send current online count immediately to newly connected client
  socket.emit('online_count', { count: io.engine.clientsCount });

  // Start searching for a partner (throttled to prevent click spam)
  socket.on('find_partner', () => {
    if (isActionThrottled(socket, 400)) return;
    matchUser(socket);
  });

  // Cancel search
  socket.on('cancel_search', () => {
    removeFromQueue(socket.id);
    socket.emit('search_cancelled');
  });

  // Sending a message with rate limiting and newline normalization
  socket.on('send_message', (data) => {
    if (isRateLimited(socket, 6, 2000)) return; // Max 6 messages per 2s
    if (!data || typeof data.text !== 'string') return;
    const sanitized = data.text.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    if (!sanitized || sanitized.length > 1500) return;

    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('receive_message', {
          text: sanitized,
          timestamp: Date.now()
        });
      }
    }
  });

  // Typing indicators
  socket.on('typing', () => {
    if (isRateLimited(socket, 15, 3000)) return;
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

  // Next / Skip partner (throttled)
  socket.on('next_partner', () => {
    if (isActionThrottled(socket, 400)) return;
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

// Process crash resilience guards
process.on('uncaughtException', (err) => {
  console.error('[AnonChat Exception]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[AnonChat Rejection]', reason);
});

server.listen(PORT, () => {
  console.log(`[AnonChat] Server running smoothly on http://localhost:${PORT}`);
});

module.exports = server;
