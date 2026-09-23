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

// Build version & timestamp tracking for zero-downtime auto-updates
const pkg = require('./package.json');
const BUILD_VERSION = pkg.version || '2.2.0';
const BUILD_ID = `${BUILD_VERSION}-${Date.now().toString(36)}`;

// Force no-cache on frontend assets so code updates are never stale
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Clean route for privacy policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Live version endpoint for client auto-update checks
app.get('/api/version', (req, res) => {
  res.json({
    version: BUILD_VERSION,
    buildId: BUILD_ID,
    timestamp: Date.now()
  });
});

// Matchmaking state (In-Memory / Zero DB)
let waitingQueue = [];
const activeRooms = new Map(); // socket.id -> { partnerId, roomId }

// Joby Sir Discipline Easter Egg State
const roomJobyCooldown = new Map(); // roomId -> timestamp of last intervention
const JOBY_PHOTO = 'https://www.sjskaushambi.org/Images/teaching_staff/2025AUG/JOBY%20JACOB.JPG';
const JOBY_MESSAGE_TEXT = 'i told you beta gali nahi dene ka meet tommarow';

const ABUSE_PATTERNS = [
  /\b(b[\s\.\-_]*c|m[\s\.\-_]*c|b[\s\.\-_]*k[\s\.\-_]*l|b[\s\.\-_]*s[\s\.\-_]*d[\s\.\-_]*k[a-z]*)\b/i,
  /\b(bhenchod|behenchod|behnchod|benchod|banchod|betichod|teri maa ki)\b/i,
  /\b(madarchod|madarchor|maderchod|madarjaat|motherfucker|mf)\b/i,
  /\b(bhosdike|bhosadike|bhosdika|bhosad|bhosdi|bhosadi|bsdiwale|bhosdiwale|bsdk)\b/i,
  /\b(chutiya|chutiye|chutya|chootiya|chutiyapa|choot|chut)\b/i,
  /\b(gandu|gaand|gand|gaandu)\b/i,
  /\b(laude|lauda|loda|lode|lund|lavde|lowde)\b/i,
  /\b(harami|haraami|kamine|kamina|randi|raand|chinar|kutta|kutte|suar|jhant|jhaant)\b/i,
  /\b(fuck|fucker|fucking|fuk|fck|f\*ck|bitch|bastard|asshole|cunt|dick|pussy)\b/i
];

function normalizeProfanity(text) {
  return text.toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/(.)\1+/g, (m, p) => p);
}

function containsAbuse(text) {
  if (!text || typeof text !== 'string') return false;
  const raw = text.toLowerCase();
  const normalized = normalizeProfanity(text);
  return ABUSE_PATTERNS.some((regex) => regex.test(normalized) || regex.test(raw));
}

function triggerJobySirIntervention(roomId, senderSocket = null, partnerSocket = null) {
  if (!roomId) return;
  const now = Date.now();
  const lastIntervention = roomJobyCooldown.get(roomId) || 0;
  if (now - lastIntervention < 8000) return; // 8s cooldown per room
  roomJobyCooldown.set(roomId, now);

  const incomingPayload = {
    name: 'Joby Sir',
    role: 'Discipline Incharge'
  };

  const messagePayload = {
    id: `joby_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Joby Jacob Sir',
    role: 'Discipline Incharge',
    photo: JOBY_PHOTO,
    fallbackPhoto: '/joby-sir.jpg',
    text: JOBY_MESSAGE_TEXT,
    timestamp: Date.now()
  };

  // 1. Alert typing indicator
  setTimeout(() => {
    io.to(roomId).emit('joby_sir_incoming', incomingPayload);
    if (senderSocket && senderSocket.connected) senderSocket.emit('joby_sir_incoming', incomingPayload);
    if (partnerSocket && partnerSocket.connected) partnerSocket.emit('joby_sir_incoming', incomingPayload);
  }, 250);

  // 2. Deliver Joby Sir's reprimand message
  setTimeout(() => {
    io.to(roomId).emit('joby_sir_message', messagePayload);
    if (senderSocket && senderSocket.connected) senderSocket.emit('joby_sir_message', messagePayload);
    if (partnerSocket && partnerSocket.connected) partnerSocket.emit('joby_sir_message', messagePayload);
  }, 1200);
}


// Rate limiting & DoS guards (Sliding window on socket.data, 0 extra deps)
function isRateLimited(socket, limit = 20, windowMs = 2000, key = 'msgTimestamps') {
  const now = Date.now();
  if (!socket.data) socket.data = {};
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
    roomJobyCooldown.delete(roomId);

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

  // Send current online count and server build info to newly connected client
  socket.emit('server_build', { buildId: BUILD_ID, version: BUILD_VERSION });
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
    if (isRateLimited(socket, 20, 2000, 'msgTimestamps')) return; // Generous 20 msgs/2s limit
    if (!data) return;

    const msgId = typeof data.msgId === 'string' && data.msgId.trim()
      ? data.msgId.trim().slice(0, 64)
      : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const textRaw = typeof data.text === 'string' ? data.text : '';
    const sanitized = textRaw.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 1500);

    // Audio voice note validation (ephemeral Base64 WebM/Opus, max 400KB, max 15s)
    let audioPayload = null;
    if (data.audio && typeof data.audio.data === 'string' && data.audio.data.startsWith('data:audio/')) {
      if (data.audio.data.length <= 400000) {
        audioPayload = {
          data: data.audio.data,
          duration: typeof data.audio.duration === 'number' ? Math.min(Math.max(1, data.audio.duration), 15) : 5
        };
      }
    }

    // Image attachment validation (ephemeral Base64 JPEG/PNG/WebP, max 950KB)
    let imagePayload = null;
    if (data.image && typeof data.image === 'string' && (data.image.startsWith('data:image/') || data.image.startsWith('https://'))) {
      if (data.image.length <= 950000) {
        imagePayload = data.image;
      }
    }

    const viewOnce = !!data.viewOnce;

    if (!sanitized && !audioPayload && !imagePayload) return;

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

    // Verify active room connection
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        // Acknowledge back to sender
        socket.emit('message_sent_ack', { msgId });

        partnerSocket.emit('receive_message', {
          msgId,
          text: sanitized,
          audio: audioPayload,
          image: imagePayload,
          viewOnce: viewOnce,
          replyTo: replyTo,
          ephemeral: ephemeral,
          timestamp: Date.now()
        });

        // Trigger Joby Sir Discipline Easter Egg if bad words / gali detected
        if (sanitized && containsAbuse(sanitized)) {
          triggerJobySirIntervention(roomId, socket, partnerSocket);
        }
      } else {
        cleanupUser(socket.id, false);
        socket.emit('partner_disconnected', { message: 'Stranger has disconnected.' });
      }
    } else {
      socket.emit('partner_disconnected', { message: 'Stranger has disconnected.' });
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
    if (isRateLimited(socket, 25, 2000, 'typingTimestamps')) return;
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
