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

// Maintenance Mode: Disabled by default (Set MAINTENANCE_MODE=true or create .maintenance file to enable)
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

// Clean route for privacy policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Matchmaking state (In-Memory / Zero DB)
let waitingQueue = [];
const activeRooms = new Map(); // socket.id -> { partnerId, roomId }

// Rate limiting & DoS guards (Sliding window on socket.data, 0 extra deps)
function isRateLimited(socket, limit = 8, windowMs = 2000, key = 'msgTimestamps') {
  const now = Date.now();
  if (!socket.data[key]) socket.data[key] = [];
  socket.data[key] = socket.data[key].filter((t) => now - t < windowMs);
  if (socket.data[key].length >= limit) return true;
  socket.data[key].push(now);
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
    if (isRateLimited(socket, 8, 2000, 'msgTimestamps')) return; // Max 8 messages per 2s
    if (!data) return;

    const msgId = typeof data.msgId === 'string' && data.msgId.trim()
      ? data.msgId.trim().slice(0, 64)
      : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const textRaw = typeof data.text === 'string' ? data.text : '';
    const sanitized = textRaw.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 1500);

    // Audio voice note validation (ephemeral Base64 WebM/Opus, max 200KB, max 15s)
    let audioPayload = null;
    if (data.audio && typeof data.audio.data === 'string' && data.audio.data.startsWith('data:audio/')) {
      if (data.audio.data.length <= 250000) {
        audioPayload = {
          data: data.audio.data,
          duration: typeof data.audio.duration === 'number' ? Math.min(Math.max(1, data.audio.duration), 15) : 5
        };
      }
    }

    if (!sanitized && !audioPayload) return;

    let replyTo = null;
    if (data.replyTo && typeof data.replyTo.text === 'string') {
      const trimmedQuote = data.replyTo.text.trim().slice(0, 150);
      if (trimmedQuote) {
        replyTo = {
          id: typeof data.replyTo.id === 'string' ? data.replyTo.id.slice(0, 64) : null,
          text: trimmedQuote,
          author: data.replyTo.author === 'self' ? 'self' : 'partner'
        };
      }
    }

    const ephemeral = !!data.ephemeral;

    // Acknowledge back to sender
    socket.emit('message_sent_ack', { msgId });

    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('receive_message', {
          msgId,
          text: sanitized,
          audio: audioPayload,
          replyTo: replyTo,
          ephemeral: ephemeral,
          timestamp: Date.now()
        });
      }
    }
  });

  // Relay Emoji Reactions (Rate limited)
  socket.on('message_reaction', (data) => {
    if (isRateLimited(socket, 15, 2000, 'relayTimestamps')) return;
    if (!data || typeof data.msgId !== 'string' || typeof data.reaction !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_reaction', {
          msgId: data.msgId.slice(0, 64),
          reaction: data.reaction.slice(0, 8)
        });
      }
    }
  });

  // Relay Pinned Messages (Rate limited)
  socket.on('pin_message', (data) => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('pin_message', {
          msgId: data.msgId.slice(0, 64),
          text: typeof data.text === 'string' ? data.text.slice(0, 200) : ''
        });
      }
    }
  });

  socket.on('unpin_message', () => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('unpin_message');
      }
    }
  });

  // Relay Delivery & Seen Ticks (Rate limited)
  socket.on('message_delivered', (data) => {
    if (isRateLimited(socket, 20, 2000, 'tickTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_delivered', { msgId: data.msgId.slice(0, 64) });
      }
    }
  });

  socket.on('message_seen', (data) => {
    if (isRateLimited(socket, 20, 2000, 'tickTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_seen', { msgId: data.msgId.slice(0, 64) });
      }
    }
  });

  // Relay Ephemeral Bomb Destruct Event (Rate limited)
  socket.on('message_destruct', (data) => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_destruct', { msgId: data.msgId.slice(0, 64) });
      }
    }
  });

  // Relay Tab Focus State (for real-time seen indicators)
  socket.on('partner_focus', (data) => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (!data) return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_focus', { focused: !!data.focused });
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
