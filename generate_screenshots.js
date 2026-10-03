const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Copy user's exact uploaded screenshot as Card 1
const userShotPath = path.join(__dirname, 'public', 'chat-screenshot-real.png');
const shot1Path = path.join(__dirname, 'public', 'chat-screenshot-real-1.png');
fs.copyFileSync(userShotPath, shot1Path);
console.log('[OK] Card 1 screenshot saved from user upload:', shot1Path);

// HTML Template Builder for Cards 2, 3, and 4
function createShotHTML(title, innerContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 938px;
  height: 906px;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Header */
.header {
  height: 80px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffff;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.back-btn {
  background: none;
  border: none;
  color: #334155;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #e0f2fe;
  color: #0284c7;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.active-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #fff;
  position: absolute;
  bottom: 0;
  left: 0;
}
.peer-meta {
  display: flex;
  flex-direction: column;
}
.peer-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.peer-name {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}
.peer-badge {
  font-size: 12px;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 500;
}
.peer-status {
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-green-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
}
.info-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 9999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}
.leave-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: #ffffff;
  border: 1.5px solid #fecaca;
  color: #ef4444;
  font-size: 13px;
  font-weight: 600;
}
.next-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 9999px;
  background: #0284c7;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  border: none;
}
/* Messages Area */
.chat-body {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}
.date-pill {
  align-self: center;
  background: #f1f5f9;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 14px;
  border-radius: 9999px;
}
.system-chip {
  align-self: center;
  background: #ffffff;
  border: 1px solid #e0f2fe;
  color: #0369a1;
  font-size: 13px;
  padding: 8px 18px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
.user-msg {
  align-self: flex-end;
  background: #0284c7;
  color: #ffffff;
  padding: 12px 18px;
  border-radius: 20px;
  border-bottom-right-radius: 4px;
  font-size: 15px;
  max-width: 65%;
  position: relative;
}
.user-ticks {
  font-size: 11px;
  color: #7dd3fc;
  display: block;
  text-align: right;
  margin-top: 3px;
}
.stranger-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  align-self: flex-start;
  max-width: 75%;
}
.stranger-avatar-sm {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e0f2fe;
  color: #0284c7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stranger-msg {
  background: #f1f5f9;
  color: #0f172a;
  padding: 12px 18px;
  border-radius: 20px;
  border-bottom-left-radius: 4px;
  font-size: 15px;
}
.msg-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
/* Bottom Dock */
.input-dock {
  height: 90px;
  border-top: 1px solid #f1f5f9;
  padding: 16px 24px;
  display: flex;
  align-items: center;
}
.dock-bar {
  width: 100%;
  height: 56px;
  border-radius: 28px;
  border: 1.5px solid #bae6fd;
  display: flex;
  align-items: center;
  padding: 0 8px 0 16px;
  gap: 12px;
  background: #ffffff;
}
.plus-btn {
  color: #475569;
  font-size: 20px;
}
.dock-input {
  flex: 1;
  color: #94a3b8;
  font-size: 15px;
}
.dock-icons {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #64748b;
}
.send-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #0284c7;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="back-btn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </div>
      <div class="avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        <span class="active-dot"></span>
      </div>
      <div class="peer-meta">
        <div class="peer-name-row">
          <span class="peer-name">Peer</span>
          <span class="peer-badge">Anonymous</span>
        </div>
        <div class="peer-status">
          <span class="status-green-dot"></span>
          <span>Connected</span>
        </div>
      </div>
    </div>
    <div class="header-right">
      <div class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      </div>
      <div class="info-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Archive Info</span>
      </div>
      <div class="leave-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span>Leave</span>
      </div>
      <div class="next-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="3"/></svg>
        <span>Next</span>
        <span style="font-size:10px;opacity:0.8;background:rgba(255,255,255,0.25);padding:1px 5px;border-radius:4px;margin-left:2px;">Esc</span>
      </div>
    </div>
  </div>

  <div class="chat-body">
    <div class="date-pill">TODAY</div>
    <div class="system-chip">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>You are paired with an anonymous peer. Say hello!</span>
    </div>
    ${innerContent}
  </div>

  <div class="input-dock">
    <div class="dock-bar">
      <div class="plus-btn">+</div>
      <div class="dock-input">Type a message...</div>
      <div class="dock-icons">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
      </div>
      <div class="send-circle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="2 2 22 12 2 22 5 12 2 2"/></svg>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// 2. Card 2: 15s Ephemeral Audio Notes & View-Once Attachment
const card2Content = `
  <div class="user-msg">
    kisi ke pass thermodynamics lab assignment ke questions hain?
    <span class="user-ticks">✓✓</span>
  </div>
  <div class="stranger-row">
    <div class="stranger-avatar-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    </div>
    <div>
      <div class="stranger-msg">ye le bhai, viva examiner ne lab me ye instructions diye the:</div>
      <div style="margin-top:8px;background:#e0f2fe;border:1px solid #bae6fd;border-radius:18px;padding:10px 16px;display:flex;align-items:center;gap:12px;width:340px;">
        <div style="width:36px;height:36px;border-radius:50%;background:#0284c7;color:#fff;display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div style="flex:1;display:flex;align-items:center;gap:3px;height:24px;">
          <span style="width:3px;height:8px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:16px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:10px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:22px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:14px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:18px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:12px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:20px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:15px;background:#0284c7;border-radius:2px;"></span>
          <span style="width:3px;height:8px;background:#0284c7;border-radius:2px;"></span>
        </div>
        <span style="font-size:12px;font-weight:700;color:#0369a1;font-family:monospace;">0:14 / 0:15</span>
      </div>
      <div style="margin-top:10px;background:#ffffff;border:1.5px solid #e2e8f0;border-radius:14px;padding:10px 14px;width:340px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;justify-content:space-between;color:#d97706;font-size:12px;font-weight:700;margin-bottom:4px;">
          <span>⏱️ View Once Photo</span>
          <span>Self-destructs in 8s</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:#334155;">Assignment_Problem_Set_4.png</div>
      </div>
      <div class="msg-time">01:42 AM</div>
    </div>
  </div>
`;

// 3. Card 3: 5s Self-Destruct Smoke Bomb & Safe Link
const card3Content = `
  <div class="stranger-row">
    <div class="stranger-avatar-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    </div>
    <div>
      <div style="background:#fff7ed;border:1.5px solid #ffedd5;border-radius:18px;padding:12px 18px;width:380px;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:#fed7aa;color:#c2410c;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;margin-bottom:8px;">
          <span>💣 Vaporizing in <strong>03</strong>s</span>
        </div>
        <div style="font-size:14px;color:#9a3412;line-height:1.4;">Midterm confidential Google Drive link:</div>
        <div style="margin-top:8px;background:#ffffff;border:1px solid #fdba74;border-radius:10px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12.5px;color:#0284c7;font-weight:600;">drive.google.com/midterm-notes-2026</span>
          <span style="font-size:10px;background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-weight:700;">Verified Safe</span>
        </div>
      </div>
      <div class="msg-time">01:43 AM</div>
    </div>
  </div>
  <div class="user-msg">
    Saved it! Message already vaporized into smoke on my screen too. Super clean!
    <span class="user-ticks">✓✓</span>
  </div>
`;

// 4. Card 4: 3s Skip Grace Shield & Reconnect
const card4Content = `
  <div class="user-msg">
    next class kab hai?
    <span class="user-ticks">✓✓</span>
  </div>
  <div style="align-self:center;width:90%;background:#fffbeb;border:1.5px solid #fef3c7;border-radius:18px;padding:18px 24px;display:flex;align-items:center;gap:18px;box-shadow:0 4px 12px rgba(245,158,11,0.08);">
    <div style="width:48px;height:48px;border-radius:50%;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0;">
      3
    </div>
    <div style="flex:1;">
      <div style="font-size:15px;font-weight:700;color:#92400e;">Peer clicked Skip &bull; Grace Protection Active</div>
      <div style="font-size:13px;color:#b45309;margin-top:2px;">Finding next classmate in <strong>3 seconds</strong>. Click to cancel.</div>
    </div>
    <button style="background:#ffffff;border:1.5px solid #f59e0b;color:#d97706;padding:8px 16px;border-radius:9999px;font-size:13px;font-weight:700;cursor:pointer;">
      Cancel Skip
    </button>
  </div>
`;

// Write HTML templates
fs.writeFileSync(path.join(__dirname, 'public', 'shot2.html'), createShotHTML('Card 2', card2Content));
fs.writeFileSync(path.join(__dirname, 'public', 'shot3.html'), createShotHTML('Card 3', card3Content));
fs.writeFileSync(path.join(__dirname, 'public', 'shot4.html'), createShotHTML('Card 4', card4Content));

// Capture with Headless Chrome
const chromePath = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const cwd = path.join(__dirname, 'public');

execSync(`${chromePath} --headless --screenshot="${path.join(cwd, 'chat-screenshot-real-2.png')}" --window-size=938,906 "http://localhost:3000/shot2.html"`);
console.log('[OK] Card 2 screenshot generated: chat-screenshot-real-2.png');

execSync(`${chromePath} --headless --screenshot="${path.join(cwd, 'chat-screenshot-real-3.png')}" --window-size=938,906 "http://localhost:3000/shot3.html"`);
console.log('[OK] Card 3 screenshot generated: chat-screenshot-real-3.png');

execSync(`${chromePath} --headless --screenshot="${path.join(cwd, 'chat-screenshot-real-4.png')}" --window-size=938,906 "http://localhost:3000/shot4.html"`);
console.log('[OK] Card 4 screenshot generated: chat-screenshot-real-4.png');

console.log('All 4 real screenshots successfully ready!');
