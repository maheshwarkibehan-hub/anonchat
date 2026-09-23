# AnonChat v2.0 - Complete Project Context & Architecture Masterfile

> **Document Created:** September 23, 2026  
> **Project Directory:** `C:\Users\mahes\Desktop\all projects\anon-chat`  
> **Git Repository:** `https://github.com/maheshwarkibehan-hub/anonchat.git` (`main` branch)  
> **Live Deployment:** Hosted on Render (Auto-deploys from GitHub `main`)  
> **Version:** `v2.0.0`  
> **Core Philosophy:** High-Performance, Zero-Overhead, Zero-Telemetry, In-Memory Only, Apple + Linear Obsidian Dark Aesthetic (`/ponytail` compliance).

---

## 1. 🌌 Project Overview & Identity

**AnonChat** is a modern, ultra-fast, anonymous 1-on-1 real-time chat application inspired by the core premise of Omegle, re-engineered for the 2026 web standard:
- **Zero Registration**: No emails, phone numbers, or account creation.
- **Zero Database Storage**: 100% RAM-only state. When two strangers disconnect, their chat history and media vanish forever.
- **Zero IP / Telemetry Logging**: No tracking scripts, no third-party analytics, no tracking cookies, no server-side IP mapping.
- **Obsidian Dimensional Aesthetic**: Void black backgrounds (`#030508`), subtle starlight particles, Three.js 3D warp jump transitions, and crisp WCAG AA typography.
- **Rich Interaction Suite**: Quoted replies, emoji reaction docks, ephemeral self-destruct bombs, voice notes, live delivery & seen ticks, 3-second accidental skip protection, and pinned messages.

---

## 2. 🏗️ Tech Stack & Dependencies

```json
{
  "name": "anonchat",
  "version": "2.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.21.2",
    "socket.io": "^4.8.1"
  },
  "devDependencies": {
    "ws": "^8.18.0"
  }
}
```

- **Backend**: Node.js + Express + Socket.io (WebSocket + polling fallback).
- **Frontend**: Native Vanilla JS (ES6+), HTML5, Modern CSS3 with CSS Custom Properties, View Transitions API.
- **Libraries (CDN loaded for smooth visual immersion)**:
  - `Three.js` (r128) - Powers the 3D cosmic hyperspace stars and warp jump speed transitions.
  - `GSAP` (3.12.5) - Fluid screen transitions with scale and motion blur.
- **Zero Heavy Frameworks**: No React, Vue, Angular, Next.js, Tailwind build steps, or ORMs. Runs with blazing speed and instantaneous startup.

---

## 3. 📜 Chronological Evolution & Development Journey

### 📍 Phase 1: Foundational Omegle Engine
- **In-Memory Matchmaking**: Implemented `waitingQueue` (array of waiting socket IDs) and `activeRooms` Map (`socket.id -> { partnerId, roomId }`).
- **Core Real-Time Events**: Pair matching, instant bidirectional text relay, typing indicators, and online user counts.
- **Partner Skipping**: Immediate search cancellation and reassignment to new partners.

---

### 📍 Phase 2: Color Palette & Obsidian Aesthetic Overhaul
- **User Feedback**: The original color scheme felt generic, flat, and outdated.
- **Redesign Implementation**:
  - Deep Obsidian Void (`--bg-void: #030508`, `--bg-card: #0B0C10`, `--bg-surface: #12131C`).
  - Specular Borders (`rgba(255, 255, 255, 0.08)` and `rgba(99, 102, 241, 0.18)`).
  - Solid Dark Indigo Accents (`#4f46e5`, hover `#6366f1` with `scale(1.02)`).
  - Interactive Dimensional Ingress: Three.js warp engine accelerates star particles on screen transitions to simulate entering another dimension.

---

### 📍 Phase 3: Human UI/UX & WCAG AA Accessibility Audit
- **Eliminating Generic AI Artifacts**:
  - Removed stock eye icon; created minimalist custom AnonChat branding.
  - Added live pulsating radar dot (`@keyframes radar-ping` using GPU-accelerated CSS `transform: scale()`) next to online counter.
  - Optical alignment: Status pill normalized to 32px height matching navbar buttons.
  - Strict 8px grid system applied to all cards, buttons, margins, and gaps (`gap-y-6`).
  - WCAG AA contrast ratio compliance: Feature card subtexts and legal links upgraded to Slate-400 (`#94a3b8`, 7.19:1 contrast ratio against dark backgrounds).
  - Responsive footer added with direct links to Terms of Service, Privacy Policy, and GitHub.

---

### 📍 Phase 4: Modern Real-Time Chat Feature Suite (8 Additions)
1. **👆 Swipe-to-Reply & Quoted Replies**:
   - Drag message bubble rightward on mobile touch devices (or click the Reply button) to open the quote preview bar.
   - Submitting sends a sanitized `replyTo` object `{ id, text, author }`. Clicking the quote chip scrolls smoothly to and pulses the target message.
2. **❤️ Quick Emoji Reaction Dock**:
   - Double-tap or trigger the dock to select from `❤️`, `😂`, `👍`, `🔥`, `😮`, `😢`. Aggregates reactions into compact badges on the bubble.
3. **📌 Message Pinning**:
   - Pin important messages to a sticky header bar (`#pinnedMessageBar`). Updates or unpins synchronously across both peers.
4. **💣 Ephemeral Self-Destruct Bombs**:
   - Toggle the bomb icon (`#bombToggleBtn`) before sending. Starts a 5-second countdown on delivery, followed by a realistic smoke dissolve animation (`smokeDissolve`) and DOM removal.
5. **🎙️ Voice Memos (Audio Notes)**:
   - Built with native `MediaRecorder` API (WebM/Opus).
   - Real-time animated audio waveforms, audio singleton (prevents multiple voice notes playing simultaneously), and a strict 400KB base64 cap.
6. **✓ / ✓✓ Real-Time Delivery & Seen Ticks**:
   - `✓` (Gray single tick) = Message acknowledged by server.
   - `✓✓` (Gray double tick) = Received by partner client.
   - `✓✓` (Blue double tick) = Seen by partner (triggered by window focus and viewport scroll visibility).
7. **🛡️ 3-Second Accidental Skip Protection**:
   - Hitting "Next" or pressing `Escape` triggers an interactive 3-second grace period with a visual countdown and `[Cancel]` button to prevent accidental partner loss.
8. **🔗 Safe Link Chips**:
   - Raw URLs in messages are automatically converted into isolated, safe link chips warning the user before navigating away.

---

### 📍 Phase 5: v2.0 Release, Privacy Policy & Mobile Engine
- **Version Bump**: Official upgrade to `v2.0` across navbar badge, package.json, and preview documents.
- **Dedicated Privacy Policy Page (`/privacy`)**:
  - Comprehensive Transparency Manifesto detailing zero logging, ephemeral memory state, and zero tracking.
- **Mobile-First UX Polish**:
  - `font-size: 16px` on inputs to prevent iOS Safari auto-zoom.
  - Active chat mode hides the footer dynamically (`:has(#chatScreen.active)`).
  - Touch targets expanded to 44px+ for thumbs.
  - Mobile haptics integrated via `navigator.vibrate`.

---

### 📍 Phase 6: Critical Bug Fix - Message Dropping & Rate-Limiter Collision
- **Problem**: Users reported that some messages were not being sent during fast conversations.
- **Root Cause**:
  - `server.js` had a rate limiter helper `isRateLimited(socket, limit, windowMs, key = 'msgTimestamps')`.
  - In `socket.on('typing')`, the function called `isRateLimited(socket, 15, 3000)` without passing the 4th argument `key`.
  - Because `key` defaulted to `'msgTimestamps'`, every keystroke pushed a timestamp into the message rate-limiting bucket!
  - When the user finished typing and pressed Enter or Send within 2 seconds, `send_message` saw >8 timestamps in `'msgTimestamps'` and silently dropped the message.
- **Fix**:
  1. **Bucket Isolation**: `socket.on('typing')` now explicitly uses `'typingTimestamps'` (`25 events / 2s`), completely isolated from chat messages.
  2. **Message Quota Raised**: Message limit increased to `20 messages / 2s`.
  3. **Client Debouncing**: Added `isTypingSent` flag to client typing handler—emits once when typing starts and debounces for 1.4s, cutting socket events by 90%.
  4. **Disconnection Guard**: Added `socket.on('disconnect')` to disable inputs and show the disconnect banner if the socket drops.

---

## 4. 🔌 Socket.io Event Protocol Reference

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `online_count` | S → C | `{ count: number }` | Live number of connected socket clients |
| `find_partner` | C → S | `none` | Requests matchmaking pairing |
| `cancel_search` | C → S | `none` | Cancels matchmaking queue |
| `waiting_for_partner` | S → C | `none` | Client placed in waiting queue |
| `chat_start` | S → C | `none` | Stranger found, starts chat session |
| `send_message` | C → S | `{ msgId, text, audio, replyTo, ephemeral }` | Sends message payload to stranger |
| `message_sent_ack` | S → C | `{ msgId }` | Confirms message reached the server (Single tick) |
| `receive_message` | S → C | `{ msgId, text, audio, replyTo, ephemeral, timestamp }` | Delivers message to stranger |
| `message_delivered` | C → S → C | `{ msgId }` | Confirms message received by recipient (Double tick) |
| `message_seen` | C → S → C | `{ msgId }` | Confirms message seen on recipient's screen (Blue tick) |
| `partner_focus` | C → S → C | `{ focused: boolean }` | Notifies whether recipient window is active |
| `message_reaction` | C → S → C | `{ msgId, reaction }` | Relays emoji reaction |
| `pin_message` | C → S → C | `{ msgId, text }` | Pins message to header |
| `unpin_message` | C → S → C | `none` | Unpins current pinned message |
| `message_destruct` | C → S → C | `{ msgId }` | Triggers ephemeral self-destruct dissolve |
| `typing` | C → S | `none` | Emits typing indicator start |
| `partner_typing` | S → C | `none` | Displays typing bubble |
| `stop_typing` | C → S | `none` | Emits typing indicator stop |
| `partner_stop_typing`| S → C | `none` | Hides typing bubble |
| `next_partner` | C → S | `none` | Leaves current room and queues for new stranger |
| `leave_chat` | C → S | `none` | Leaves chat session and returns to landing |
| `partner_disconnected` | S → C | `{ message }` | Notifies stranger disconnected |
| `chat_ended` | S → C | `none` | Confirms chat termination |

---

## 5. 📂 Project File Structure

```
anon-chat/
├── .git/                      # Git repository (synced with GitHub main)
├── .gitignore                 # Ignores node_modules, logs, .env
├── package.json               # v2.0.0 metadata and dependencies
├── package-lock.json          # Dependency lockfile
├── server.js                  # Express & Socket.io server with isolated rate limiters
├── PROJECT_CONTEXT.md         # This master context and architectural document
├── README.md                  # Project overview and quickstart
├── verify_audit.js            # Automated test suite for UI/UX, WCAG, and design tokens (44 tests)
├── test_chat_features.js      # Automated test suite for replies, reactions, voice notes, rate limits (61 tests)
├── test_suite.js              # Automated test suite for 3D engine, socket handshake, and HTTP (39 tests)
└── public/
    ├── index.html             # Main Single Page App (Landing, Searching, Chat screens)
    ├── privacy.html           # Dedicated Privacy Policy & Transparency Manifesto page
    ├── style.css              # Obsidian dark theme, animations, responsive layouts
    └── client.js              # Client state, WebSockets, Three.js warp engine, UI gestures
```

---

## 6. 🧪 Automated Test Verification

All 144 automated tests pass with 100% success rate:

```bash
node verify_audit.js       # 44 Passed (Design tokens, WCAG AA, optical alignment)
node test_chat_features.js  # 61 Passed (Replies, Reactions, Voice, Rate limiting, Debounce)
node test_suite.js         # 39 Passed (Three.js Warp, Socket.io handshake, WebSocket upgrade)
```

**Total: 144 / 144 Passing Tests (0 Failures)**

---

## 7. 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start
# or
node server.js

# 3. Open in browser
http://localhost:3000
```

---

## 8. 🌐 Deployment Workflow

Any commit pushed to `main` on GitHub triggers an automatic redeploy on Render:
```bash
git add .
git commit -m "your commit message"
git push origin main
```
The server automatically starts with `npm start` (`node server.js`) and binds to `process.env.PORT` on Render.
