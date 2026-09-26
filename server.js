const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Load local .env variables if file exists (Zero dependencies)
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  try {
    const envLines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    for (const rawLine of envLines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (e) {}
}

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

// Clean route for Synapse Design System showcase
app.get('/synapse', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'synapse.html'));
});

// Trust proxy for accurate client IP detection behind proxies / cloud hosts
app.set('trust proxy', true);

// In-memory set of IPs that have already seen the What's New modal
const seenWhatsNewIPs = new Set();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

// Live version & what's new check endpoint
app.get('/api/version', (req, res) => {
  const ip = getClientIp(req);
  const shouldShow = !seenWhatsNewIPs.has(ip);
  if (shouldShow) {
    seenWhatsNewIPs.add(ip);
  }
  res.json({
    version: BUILD_VERSION,
    buildId: BUILD_ID,
    timestamp: Date.now(),
    shouldShowWhatsNew: shouldShow
  });
});

// Acknowledge What's New modal seen for this IP
app.post('/api/whats-new/ack', (req, res) => {
  const ip = getClientIp(req);
  seenWhatsNewIPs.add(ip);
  res.json({ ok: true, ipSeen: true });
});

// Matchmaking state (In-Memory / Zero DB)
let waitingQueue = [];
const activeRooms = new Map(); // socket.id -> { partnerId, roomId }

// --- Private Chat Session Logger (Structured for AI Training Datasets) ---
const CHAT_LOG_DIR = path.join(__dirname, 'chat');
const chatSessions = new Map(); // roomId -> session object

function getLocalDateFolder() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalTimePrefix() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}-${minutes}-${seconds}`;
}

function initChatSession(roomId, socketAId, socketBId, vibeLabel) {
  const dayFolder = getLocalDateFolder();
  const timePrefix = getLocalTimePrefix();
  const dayDir = path.join(CHAT_LOG_DIR, dayFolder);
  const fileName = `chat_${timePrefix}_${roomId}.json`;
  const filePath = path.join(dayDir, fileName);

  chatSessions.set(roomId, {
    roomId,
    vibe: vibeLabel || 'Direct',
    dayFolder,
    fileName,
    filePath,
    dayDir,
    startTime: new Date().toISOString(),
    endTime: null,
    durationSeconds: 0,
    userAliases: {
      [socketAId]: 'Student_1',
      [socketBId]: 'Student_2'
    },
    messages: [],
    openai_format: [],
    sharegpt_format: [],
    writeTimer: null
  });
}

async function flushSessionToFile(session) {
  if (!session || !session.filePath) return;
  try {
    if (!fs.existsSync(session.dayDir)) {
      fs.mkdirSync(session.dayDir, { recursive: true });
    }

    const payload = {
      metadata: {
        roomId: session.roomId,
        vibe: session.vibe,
        date: session.dayFolder,
        startTime: session.startTime,
        endTime: session.endTime,
        durationSeconds: session.durationSeconds,
        totalMessages: session.messages.length,
        aiTrainingReady: session.openai_format.length >= 2
      },
      messages: session.messages,
      ai_dataset: {
        openai_format: session.openai_format,
        sharegpt_format: session.sharegpt_format
      }
    };

    await fs.promises.writeFile(session.filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    // Non-blocking error containment so real-time socket delivery is never disrupted
  }
}

function scheduleSessionFlush(session) {
  if (!session) return;
  if (session.writeTimer) clearTimeout(session.writeTimer);
  session.writeTimer = setTimeout(() => {
    flushSessionToFile(session);
  }, 100);
}

function recordChatMessage(roomId, socketId, msgData) {
  const session = chatSessions.get(roomId);
  if (!session) return;

  const sender = session.userAliases[socketId] || 'Student_1';
  const role = sender === 'Student_1' ? 'user' : 'assistant';
  const shareGptRole = sender === 'Student_1' ? 'human' : 'gpt';

  const text = typeof msgData.text === 'string' ? msgData.text.trim() : '';

  let msgType = 'text';
  if (msgData.audio) msgType = 'voice_note';
  else if (msgData.image) msgType = 'image';

  const entry = {
    turn: session.messages.length + 1,
    msgId: msgData.msgId || `msg_${Date.now()}`,
    sender,
    role,
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    type: msgType,
    text: text,
    ephemeral: !!msgData.ephemeral,
    replyTo: msgData.replyTo ? { text: msgData.replyTo.text, author: msgData.replyTo.author } : null
  };

  session.messages.push(entry);

  if (text) {
    session.openai_format.push({
      role,
      content: text
    });
    session.sharegpt_format.push({
      from: shareGptRole,
      value: text
    });
  }

  scheduleSessionFlush(session);
}

function recordChatSystemEvent(roomId, eventType, text) {
  const session = chatSessions.get(roomId);
  if (!session) return;

  const entry = {
    turn: session.messages.length + 1,
    msgId: `event_${Date.now()}`,
    sender: 'System',
    role: 'system',
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    type: eventType,
    text: text
  };

  session.messages.push(entry);
  scheduleSessionFlush(session);
}

// GitHub Auto-Upload Sync Queue (Supports GitHub REST API on Render + Local Git CLI)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'maheshwarkibehan-hub/anonchat';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

let isGitSyncRunning = false;
const gitSyncQueue = [];

async function triggerAutoUpload(filePath) {
  if (!fs.existsSync(filePath)) return;

  // 1. If GITHUB_TOKEN is provided (Recommended for Render cloud hosting)
  if (GITHUB_TOKEN) {
    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${relativePath}`;

      let sha = undefined;
      try {
        const getRes = await fetch(`${url}?ref=${GITHUB_BRANCH}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'AnonChat-AutoSync'
          }
        });
        if (getRes.ok) {
          const resData = await getRes.json();
          sha = resData.sha;
        }
      } catch (e) {}

      const body = {
        message: `archive: sync ${path.basename(filePath)} [skip ci] [skip render]`,
        content: Buffer.from(fileContent, 'utf8').toString('base64'),
        branch: GITHUB_BRANCH
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AnonChat-AutoSync'
        },
        body: JSON.stringify(body)
      });

      if (putRes.ok) {
        console.log(`[GitHub Sync] Uploaded ${relativePath} directly via API [skip ci]`);
        return;
      }
    } catch (err) {
      console.error('[GitHub API Upload Error]', err.message);
    }
  }

  // 2. Fallback: Local Git CLI auto-commit & push (when running locally with .git directory)
  if (fs.existsSync(path.join(__dirname, '.git'))) {
    gitSyncQueue.push(filePath);
    processNextGitSync();
  }
}

function processNextGitSync() {
  if (isGitSyncRunning || gitSyncQueue.length === 0) return;
  isGitSyncRunning = true;
  const targetFile = gitSyncQueue.shift();

  // Commit and push with [skip ci] [skip render] to prevent auto-deploy loop on Render
  const cmd = `git add "chat" && git commit -m "archive: auto-save chat session [skip ci] [skip render]" && git push origin ${GITHUB_BRANCH}`;

  exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
    isGitSyncRunning = false;
    if (error) {
      if (!error.message.includes('nothing to commit')) {
        console.error('[Git Auto-Push]', error.message.split('\n')[0]);
      }
    } else {
      console.log('[Git Auto-Push] Successfully pushed chat archive to GitHub [skip ci]');
    }

    if (gitSyncQueue.length > 0) {
      setTimeout(processNextGitSync, 1500);
    }
  });
}

function finishChatSession(roomId) {
  const session = chatSessions.get(roomId);
  if (!session) return;

  if (session.writeTimer) clearTimeout(session.writeTimer);
  session.endTime = new Date().toISOString();
  session.durationSeconds = Math.max(0, Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000));

  // Only keep conversation logs that have at least 1 user message
  if (session.messages.length > 0) {
    flushSessionToFile(session).then(() => {
      // Trigger automatic GitHub upload
      triggerAutoUpload(session.filePath);
    });
  } else {
    try {
      if (fs.existsSync(session.filePath)) {
        fs.unlinkSync(session.filePath);
      }
    } catch (e) {}
  }

  chatSessions.delete(roomId);
}

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
    recordChatSystemEvent(roomId, 'teacher_intervention', `Joby Sir: ${JOBY_MESSAGE_TEXT}`);
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

function pairUsers(socketA, socketB, vibeLabel = 'Direct') {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  socketA.join(roomId);
  socketB.join(roomId);

  activeRooms.set(socketA.id, { partnerId: socketB.id, roomId });
  activeRooms.set(socketB.id, { partnerId: socketA.id, roomId });

  // Initialize private structured chat logger safely
  try {
    initChatSession(roomId, socketA.id, socketB.id, vibeLabel);
  } catch (err) {
    console.error('[Chat Logger Init Error]', err.message);
  }

  socketA.emit('chat_start', { roomId });
  socketB.emit('chat_start', { roomId });
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

    // Finalize chat session & flush AI training dataset safely
    try {
      finishChatSession(roomId);
    } catch (err) {
      console.error('[Chat Logger Finish Error]', err.message);
    }

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

  // Purge any stale disconnected sockets from waitingQueue
  waitingQueue = waitingQueue.filter((id) => {
    const s = io.sockets.sockets.get(id);
    return s && s.connected && id !== socket.id;
  });

  if (waitingQueue.length > 0) {
    const partnerId = waitingQueue.shift();
    const partnerSocket = io.sockets.sockets.get(partnerId);

    if (partnerSocket && partnerSocket.connected) {
      pairUsers(socket, partnerSocket);
    } else {
      matchUser(socket);
    }
  } else {
    waitingQueue.push(socket.id);
    socket.emit('waiting_for_partner');
  }
}

io.on('connection', (socket) => {
  socket.data = { msgTimestamps: [], lastAction: 0 };
  broadcastOnlineCount();

  const clientIp = (socket.handshake.headers && socket.handshake.headers['x-forwarded-for']
    ? socket.handshake.headers['x-forwarded-for'].split(',')[0].trim()
    : socket.handshake.address) || '127.0.0.1';

  // Check What's New v3 modal eligibility (1-time per IP)
  const shouldShowWhatsNew = !seenWhatsNewIPs.has(clientIp);
  if (shouldShowWhatsNew) {
    seenWhatsNewIPs.add(clientIp);
  }
  socket.emit('whats_new_status', { show: shouldShowWhatsNew });

  socket.on('check_whats_new', () => {
    const show = !seenWhatsNewIPs.has(clientIp);
    if (show) {
      seenWhatsNewIPs.add(clientIp);
    }
    socket.emit('whats_new_status', { show });
  });

  socket.on('ack_whats_new', () => {
    seenWhatsNewIPs.add(clientIp);
  });

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
      const { partnerId, roomId } = activeRooms.get(socket.id);
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

        // Record message in private AI dataset JSON
        recordChatMessage(roomId, socket.id, {
          msgId,
          text: sanitized,
          audio: audioPayload,
          image: imagePayload,
          replyTo: replyTo,
          ephemeral: ephemeral
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
