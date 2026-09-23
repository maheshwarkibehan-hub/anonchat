// ==========================================================================
// AnonChat - Client Logic & Dimensional Warp Engine
// Ultra-Luxe Obsidian & Dimensional Warp Experience
// ==========================================================================

const socket = io();

// DOM Elements
const landingScreen = document.getElementById('landingScreen');
const searchingScreen = document.getElementById('searchingScreen');
const chatScreen = document.getElementById('chatScreen');
const dimensionalFlash = document.getElementById('dimensionalFlash');

const startChatBtn = document.getElementById('startChatBtn');
const cancelSearchBtn = document.getElementById('cancelSearchBtn');
const nextChatBtn = document.getElementById('nextChatBtn');
const endChatBtn = document.getElementById('endChatBtn');

const onlineCountText = document.getElementById('onlineCountText');
const messagesContainer = document.getElementById('messagesContainer');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const typingIndicator = document.getElementById('typingIndicator');
const strangerSubstatus = document.getElementById('strangerSubstatus');

const newMsgPill = document.getElementById('newMsgPill');
const newMsgPillText = document.getElementById('newMsgPillText');
const skipGraceBar = document.getElementById('skipGraceBar');
const skipCountdownText = document.getElementById('skipCountdownText');
const cancelSkipBtn = document.getElementById('cancelSkipBtn');
const confirmSkipBtn = document.getElementById('confirmSkipBtn');
const replyPreviewBar = document.getElementById('replyPreviewBar');
const replyPreviewAuthor = document.getElementById('replyPreviewAuthor');
const replyPreviewSnippet = document.getElementById('replyPreviewSnippet');
const cancelReplyBtn = document.getElementById('cancelReplyBtn');

// 8 Modern Chat Feature Bindings
const pinnedMessageBar = document.getElementById('pinnedMessageBar');
const pinnedText = document.getElementById('pinnedText');
const unpinBtn = document.getElementById('unpinBtn');

const bombToggleBtn = document.getElementById('bombToggleBtn');
const micBtn = document.getElementById('micBtn');
const voiceRecordBar = document.getElementById('voiceRecordBar');
const recordingTimer = document.getElementById('recordingTimer');
const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');

const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundOnIcon = document.getElementById('soundOnIcon');
const soundOffIcon = document.getElementById('soundOffIcon');

// Sound State
let soundEnabled = localStorage.getItem('anonchat_sound') !== 'false';
let typingTimeout = null;
let isTypingSent = false;
let isPartnerConnected = false;

function updateSoundUI() {
  if (soundEnabled) {
    soundOnIcon.classList.remove('hidden');
    soundOffIcon.classList.add('hidden');
  } else {
    soundOnIcon.classList.add('hidden');
    soundOffIcon.classList.remove('hidden');
  }
}
updateSoundUI();

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('anonchat_sound', soundEnabled);
  updateSoundUI();
});

// Precision Web Audio API Synthesizer (Micro-chimes & Dimensional Swells)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playChime(type) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'sent') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'received') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.setValueAtTime(920, now + 0.07);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'connected') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'disconnected') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'warp') {
      // Hyperspace / Dimensional Warp Audio Swell
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.45);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    }
  } catch (e) {
    // Audio context may be restricted before user interaction
  }
}

// ==========================================================================
// 3D Dimensional Warp & Starfield Engine (Three.js WebGL + 2D Canvas Fallback)
// ==========================================================================
const canvas = document.getElementById('dimensionalCanvas');
let ctx = null;

let canvasWidth = (canvas.width = window.innerWidth);
let canvasHeight = (canvas.height = window.innerHeight);

// Particle Configuration
const STAR_COUNT = 380;
const stars = [];
const STAR_COLORS = ['#a5b4fc', '#c084fc', '#67e8f9', '#ffffff', '#e0e7ff'];

let baseSpeed = 0.55;
let currentSpeed = baseSpeed;
let targetSpeed = baseSpeed;
let warpActive = false;
let warpTimeout = null;
let warpResetTimeout = null;

// Mouse Parallax
let mouseX = canvasWidth / 2;
let mouseY = canvasHeight / 2;
let targetCenterX = canvasWidth / 2;
let targetCenterY = canvasHeight / 2;

// Three.js 3D WebGL Setup
let isThreeActive = false;
let threeRenderer = null;
let threeCamera = null;
let threeScene = null;
let threeParticles = null;
const THREE_STAR_COUNT = 1400;

if (typeof THREE !== 'undefined' && canvas) {
  try {
    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(65, canvasWidth / canvasHeight, 0.1, 2000);
    threeCamera.position.z = 5;

    threeRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    threeRenderer.setSize(canvasWidth, canvasHeight);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(THREE_STAR_COUNT * 3);
    const colors = new Float32Array(THREE_STAR_COUNT * 3);
    const palette = [
      new THREE.Color('#6366f1'),
      new THREE.Color('#8b5cf6'),
      new THREE.Color('#06b6d4'),
      new THREE.Color('#ffffff'),
      new THREE.Color('#a5b4fc')
    ];

    for (let i = 0; i < THREE_STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 600;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 600;
      positions[i * 3 + 2] = -Math.random() * 1200;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    threeParticles = new THREE.Points(geometry, material);
    threeScene.add(threeParticles);
    isThreeActive = true;
  } catch (e) {
    isThreeActive = false;
  }
}

// 2D Canvas Fallback
if (!isThreeActive && canvas) {
  ctx = canvas.getContext('2d');
  function initStars() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: (Math.random() - 0.5) * canvasWidth * 2,
        y: (Math.random() - 0.5) * canvasHeight * 2,
        z: Math.random() * 1000 + 1,
        prevZ: 1000,
        size: Math.random() * 1.5 + 0.5,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
      });
    }
  }
  initStars();
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;

  if (isThreeActive && threeRenderer && threeCamera) {
    threeCamera.aspect = canvasWidth / canvasHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(canvasWidth, canvasHeight);
  } else if (canvas && ctx) {
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);
  }
  targetCenterX = canvasWidth / 2;
  targetCenterY = canvasHeight / 2;
}
let resizeRaf = null;
window.addEventListener('resize', () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(resizeCanvas);
}, { passive: true });
resizeCanvas();

let mouseMoveRaf = null;
window.addEventListener('mousemove', (e) => {
  if (mouseMoveRaf) return;
  mouseMoveRaf = requestAnimationFrame(() => {
    targetCenterX = canvasWidth / 2 + (e.clientX - canvasWidth / 2) * 0.08;
    targetCenterY = canvasHeight / 2 + (e.clientY - canvasHeight / 2) * 0.08;
    mouseMoveRaf = null;
  });
}, { passive: true });

// Trigger a Dimensional Warp Jump (with timer collision protection)
function triggerDimensionalWarp(durationMs = 900) {
  warpActive = true;
  targetSpeed = 28.0;
  playChime('warp');

  if (dimensionalFlash) {
    dimensionalFlash.classList.add('flashing');
    setTimeout(() => {
      dimensionalFlash.classList.remove('flashing');
    }, 180);
  }

  // Clear existing timers to prevent velocity desync on rapid clicks
  if (warpTimeout) clearTimeout(warpTimeout);
  if (warpResetTimeout) clearTimeout(warpResetTimeout);

  warpTimeout = setTimeout(() => {
    targetSpeed = baseSpeed;
    warpResetTimeout = setTimeout(() => {
      warpActive = false;
    }, 400);
  }, durationMs);
}

// Animation Loop (Three.js WebGL with 2D Canvas Fallback & Battery Saver)
function animateStars() {
  if (document.hidden) {
    requestAnimationFrame(animateStars);
    return;
  }

  mouseX += (targetCenterX - mouseX) * 0.05;
  mouseY += (targetCenterY - mouseY) * 0.05;
  currentSpeed += (targetSpeed - currentSpeed) * 0.12;

  if (isThreeActive && threeRenderer && threeParticles) {
    const positions = threeParticles.geometry.attributes.position.array;
    const speedFactor = warpActive || currentSpeed > 3 ? currentSpeed * 1.6 : currentSpeed;

    for (let i = 0; i < THREE_STAR_COUNT; i++) {
      let zIdx = i * 3 + 2;
      positions[zIdx] += speedFactor;
      if (positions[zIdx] > 10) {
        positions[zIdx] = -1200;
        positions[i * 3] = (Math.random() - 0.5) * 600;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 600;
      }
    }
    threeParticles.geometry.attributes.position.needsUpdate = true;

    threeCamera.rotation.y = -(mouseX - canvasWidth / 2) * 0.0003;
    threeCamera.rotation.x = -(mouseY - canvasHeight / 2) * 0.0003;

    const targetFov = warpActive ? 92 : 65;
    threeCamera.fov += (targetFov - threeCamera.fov) * 0.1;
    threeCamera.updateProjectionMatrix();

    threeRenderer.render(threeScene, threeCamera);
  } else if (ctx) {
    if (warpActive || currentSpeed > 3) {
      ctx.fillStyle = 'rgba(3, 5, 8, 0.28)';
    } else {
      ctx.fillStyle = 'rgba(3, 5, 8, 0.45)';
    }
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = mouseX;
    const cy = mouseY;

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      star.prevZ = star.z;
      star.z -= currentSpeed;

      if (star.z <= 0) {
        star.z = 1000;
        star.prevZ = 1000;
        star.x = (Math.random() - 0.5) * canvasWidth * 2;
        star.y = (Math.random() - 0.5) * canvasHeight * 2;
      }

      const k = 250 / star.z;
      const px = star.x * k + cx;
      const py = star.y * k + cy;

      if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) {
        continue;
      }

      if (currentSpeed > 3) {
        const prevK = 250 / star.prevZ;
        const prevPx = star.x * prevK + cx;
        const prevPy = star.y * prevK + cy;

        ctx.beginPath();
        ctx.moveTo(prevPx, prevPy);
        ctx.lineTo(px, py);
        ctx.strokeStyle = star.color;
        ctx.lineWidth = Math.min((1 - star.z / 1000) * 3, 2.5);
        ctx.stroke();
      } else {
        const alpha = Math.min((1 - star.z / 1000) * 1.2, 1);
        const rad = star.size * (1 - star.z / 1000) * 1.6;

        ctx.beginPath();
        ctx.arc(px, py, Math.max(rad, 0.6), 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  requestAnimationFrame(animateStars);
}
requestAnimationFrame(animateStars);

// ==========================================================================
// Obsidian Dual-Engine: Specular Spotlight & 24px Micro-Dot Grid
// ==========================================================================
const spotlightCanvas = document.getElementById('spotlightCanvas');
if (spotlightCanvas) {
  const sCtx = spotlightCanvas.getContext('2d', { alpha: true });
  if (sCtx) {
    let sRafId = null;
    let sWidth = 0;
    let sHeight = 0;

    const sTarget = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const sCurrent = { x: sTarget.x, y: sTarget.y };
    let sIsTouching = false;
    let sLastInteractionTime = performance.now();

    const sDpr = Math.min(window.devicePixelRatio || 1, 1.5);

    function resizeSpotlight() {
      sWidth = window.innerWidth;
      sHeight = window.innerHeight;
      spotlightCanvas.width = Math.floor(sWidth * sDpr);
      spotlightCanvas.height = Math.floor(sHeight * sDpr);
      sCtx.scale(sDpr, sDpr);
    }
    resizeSpotlight();
    window.addEventListener('resize', resizeSpotlight, { passive: true });

    // Desktop Pointer and Mobile Touch Listeners (Passive)
    window.addEventListener('pointermove', (e) => {
      sTarget.x = e.clientX;
      sTarget.y = e.clientY;
      sLastInteractionTime = performance.now();
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        sIsTouching = true;
        sTarget.x = e.touches[0].clientX;
        sTarget.y = e.touches[0].clientY;
        sLastInteractionTime = performance.now();
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        sTarget.x = e.touches[0].clientX;
        sTarget.y = e.touches[0].clientY;
        sLastInteractionTime = performance.now();
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      sIsTouching = false;
    }, { passive: true });

    let sTime = 0;

    function renderSpotlight() {
      if (document.hidden) {
        sRafId = requestAnimationFrame(renderSpotlight);
        return;
      }

      sTime += 0.01;
      const idleTime = performance.now() - sLastInteractionTime;

      // When idle on mobile (no touches for > 2.5s), run smooth Lissajous ambient drift
      if (idleTime > 2500 && !sIsTouching) {
        const driftX = sWidth / 2 + Math.sin(sTime * 0.4) * (sWidth * 0.25);
        const driftY = sHeight / 2 + Math.cos(sTime * 0.3) * (sHeight * 0.2);
        sTarget.x += (driftX - sTarget.x) * 0.02;
        sTarget.y += (driftY - sTarget.y) * 0.02;
      }

      // Smooth lerp easing for silky movement
      sCurrent.x += (sTarget.x - sCurrent.x) * 0.08;
      sCurrent.y += (sTarget.y - sCurrent.y) * 0.08;

      sCtx.clearRect(0, 0, sWidth, sHeight);

      // Context-aware state dimming: drop opacity when chatting so text is crystal clear
      const isChatActive = chatScreen && chatScreen.classList.contains('active');
      const spotlightOpacity = isChatActive ? 0.03 : 0.07;
      const spotlightRadius = isChatActive ? 750 : 550;

      // Specular Radial Spotlight
      const gradient = sCtx.createRadialGradient(
        sCurrent.x,
        sCurrent.y,
        0,
        sCurrent.x,
        sCurrent.y,
        spotlightRadius
      );
      gradient.addColorStop(0, `rgba(99, 102, 241, ${spotlightOpacity})`);
      gradient.addColorStop(0.4, `rgba(168, 85, 247, ${spotlightOpacity * 0.5})`);
      gradient.addColorStop(1, 'rgba(11, 12, 16, 0)');

      sCtx.fillStyle = gradient;
      sCtx.fillRect(0, 0, sWidth, sHeight);

      // 24px Sub-Pixel Micro-Dot Grid
      const gridSize = 24;
      const dotRadius = 0.8;
      sCtx.fillStyle = isChatActive
        ? 'rgba(255, 255, 255, 0.025)'
        : 'rgba(255, 255, 255, 0.05)';

      const startX = Math.max(0, Math.floor((sCurrent.x - spotlightRadius) / gridSize) * gridSize);
      const endX = Math.min(sWidth, Math.ceil((sCurrent.x + spotlightRadius) / gridSize) * gridSize);
      const startY = Math.max(0, Math.floor((sCurrent.y - spotlightRadius) / gridSize) * gridSize);
      const endY = Math.min(sHeight, Math.ceil((sCurrent.y + spotlightRadius) / gridSize) * gridSize);

      for (let x = startX; x < endX; x += gridSize) {
        for (let y = startY; y < endY; y += gridSize) {
          const dx = x - sCurrent.x;
          const dy = y - sCurrent.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < spotlightRadius * spotlightRadius) {
            const proximity = 1 - Math.sqrt(distSq) / spotlightRadius;
            sCtx.globalAlpha = proximity * (isChatActive ? 0.4 : 0.85);
            sCtx.beginPath();
            sCtx.arc(x, y, dotRadius, 0, Math.PI * 2);
            sCtx.fill();
          }
        }
      }
      sCtx.globalAlpha = 1.0;

      sRafId = requestAnimationFrame(renderSpotlight);
    }
    sRafId = requestAnimationFrame(renderSpotlight);
  }
}

// ==========================================================================
// GSAP Dimensional Transitions & Ingress Portal
// ==========================================================================
const dimensionalPortal = document.getElementById('dimensionalPortal');

function updateScreenDOM(screen) {
  [landingScreen, searchingScreen, chatScreen].forEach((s) => s.classList.remove('active'));
  screen.classList.add('active');
}

function showScreen(screen) {
  const currentActive = document.querySelector('.screen.active');
  if (currentActive === screen) return;

  if (typeof gsap !== 'undefined') {
    const tl = gsap.timeline();
    if (currentActive) {
      tl.to(currentActive, {
        scale: 0.92,
        opacity: 0,
        filter: 'blur(12px)',
        duration: 0.28,
        ease: 'power2.in',
        onComplete: () => {
          updateScreenDOM(screen);
        }
      });
    } else {
      updateScreenDOM(screen);
    }

    tl.fromTo(
      screen,
      { scale: 1.08, opacity: 0, filter: 'blur(14px)' },
      { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.45, ease: 'power3.out' }
    );
    return;
  }

  if (document.startViewTransition) {
    document.startViewTransition(() => {
      updateScreenDOM(screen);
    });
    return;
  }

  updateScreenDOM(screen);
}

// Initial Dimensional Ingress Sequence ("Entering another dimension")
function initDimensionalEntrance() {
  triggerDimensionalWarp(1100);

  if (dimensionalPortal) {
    dimensionalPortal.classList.add('portal-burst');
    setTimeout(() => {
      dimensionalPortal.style.display = 'none';
    }, 1200);
  }

  if (typeof gsap !== 'undefined') {
    gsap.fromTo(
      '.navbar',
      { y: -35, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.85, ease: 'power3.out', delay: 0.15 }
    );
    gsap.fromTo(
      '#landingScreen .card',
      { scale: 0.88, rotationX: 12, opacity: 0, filter: 'blur(16px)' },
      { scale: 1, rotationX: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power4.out', delay: 0.25 }
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDimensionalEntrance);
} else {
  initDimensionalEntrance();
}

function formatTime(timestamp = Date.now()) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Mobile Haptic Vibration API
function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'light') {
        navigator.vibrate(15);
      } else if (type === 'connected') {
        navigator.vibrate([25, 45, 25]);
      } else if (type === 'disconnected') {
        navigator.vibrate([35, 30]);
      }
    } catch (e) {
      // Audio or vibration disallowed
    }
  }
}

// ==========================================================================
// Smart Auto-Scroll & Floating New Message Pill
// ==========================================================================
let unreadCount = 0;

function isScrolledNearBottom() {
  if (!messagesContainer) return true;
  const threshold = 85;
  return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= threshold;
}

function updateNewMsgPill() {
  if (!newMsgPill || !newMsgPillText) return;
  if (unreadCount > 0) {
    newMsgPillText.textContent = unreadCount === 1 ? '↓ New message' : `↓ ${unreadCount} new messages`;
    newMsgPill.classList.remove('hidden');
  } else {
    newMsgPill.classList.add('hidden');
  }
}

function clearUnreadPill() {
  unreadCount = 0;
  updateNewMsgPill();
}

if (messagesContainer) {
  messagesContainer.addEventListener('scroll', () => {
    if (isScrolledNearBottom()) {
      clearUnreadPill();
    }
  }, { passive: true });
}

if (newMsgPill) {
  newMsgPill.addEventListener('click', () => {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    clearUnreadPill();
  });
}

// ==========================================================================
// Quoted Reply System
// ==========================================================================
let activeReply = null; // { id, text, author: 'self' | 'partner' }

function setReply(msgId, text, author) {
  activeReply = { id: msgId, text: text, author: author };
  if (replyPreviewAuthor && replyPreviewSnippet && replyPreviewBar) {
    replyPreviewAuthor.textContent = author === 'self' ? 'Replying to You' : 'Replying to Stranger';
    replyPreviewSnippet.textContent = text;
    replyPreviewBar.classList.remove('hidden');
  }
  if (messageInput) messageInput.focus();
}

function clearReply() {
  activeReply = null;
  if (replyPreviewBar) {
    replyPreviewBar.classList.add('hidden');
  }
}

if (cancelReplyBtn) {
  cancelReplyBtn.addEventListener('click', clearReply);
}

// ==========================================================================
// Accidental Skip Protection (3-Second Grace Countdown)
// ==========================================================================
let skipTimer = null;
let skipInterval = null;
let skipSecondsLeft = 3;

function cancelSkipGrace() {
  if (skipTimer) {
    clearTimeout(skipTimer);
    skipTimer = null;
  }
  if (skipInterval) {
    clearInterval(skipInterval);
    skipInterval = null;
  }
  if (skipGraceBar) {
    skipGraceBar.classList.add('hidden');
  }
}

function triggerNextWithGrace() {
  if (!isPartnerConnected) {
    nextPartner();
    return;
  }
  if (skipTimer) {
    cancelSkipGrace();
    nextPartner();
    return;
  }

  skipSecondsLeft = 3;
  if (skipCountdownText) skipCountdownText.textContent = skipSecondsLeft;
  if (skipGraceBar) skipGraceBar.classList.remove('hidden');

  skipInterval = setInterval(() => {
    skipSecondsLeft--;
    if (skipCountdownText) {
      skipCountdownText.textContent = Math.max(1, skipSecondsLeft);
    }
  }, 1000);

  skipTimer = setTimeout(() => {
    cancelSkipGrace();
    nextPartner();
  }, 3000);
}

if (cancelSkipBtn) cancelSkipBtn.addEventListener('click', cancelSkipGrace);
if (confirmSkipBtn) {
  confirmSkipBtn.addEventListener('click', () => {
    cancelSkipGrace();
    nextPartner();
  });
}

// ==========================================================================
// 8 Modern Chat Interaction Engine (Sept 2026 Standards)
// ==========================================================================

// 1. Pinned Message Real-Time State
let activePinnedMsgId = null;

function setPinnedMessage(msgId, text, notifyServer = false) {
  activePinnedMsgId = msgId;
  if (pinnedText && pinnedMessageBar) {
    pinnedText.textContent = text;
    pinnedMessageBar.classList.remove('hidden');
  }
  document.querySelectorAll('.msg-pin-btn').forEach((btn) => {
    const isThis = btn.closest('.msg-row')?.id === msgId;
    btn.classList.toggle('pinned', isThis);
  });
  if (notifyServer && socket && isPartnerConnected) {
    socket.emit('pin_message', { msgId, text });
  }
}

function unpinMessage(notifyServer = false) {
  activePinnedMsgId = null;
  if (pinnedMessageBar) {
    pinnedMessageBar.classList.add('hidden');
  }
  document.querySelectorAll('.msg-pin-btn.pinned').forEach((btn) => btn.classList.remove('pinned'));
  if (notifyServer && socket && isPartnerConnected) {
    socket.emit('unpin_message');
  }
}

if (pinnedMessageBar) {
  pinnedMessageBar.addEventListener('click', (e) => {
    if (e.target.closest('#unpinBtn')) return;
    if (activePinnedMsgId) {
      const target = document.getElementById(activePinnedMsgId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.remove('msg-highlight');
        void target.offsetWidth;
        target.classList.add('msg-highlight');
        setTimeout(() => target.classList.remove('msg-highlight'), 1500);
      }
    }
  });
}

if (unpinBtn) {
  unpinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unpinMessage(true);
  });
}

// 2. Double-Tap / Quick Emoji Reaction Dock & Badges
const messageReactions = new Map(); // msgId -> Map(emoji -> count)
let activeReactionDock = null;

function closeReactionDock() {
  if (activeReactionDock) {
    activeReactionDock.remove();
    activeReactionDock = null;
  }
}

document.addEventListener('click', (e) => {
  if (activeReactionDock && !activeReactionDock.contains(e.target)) {
    closeReactionDock();
  }
});

function openReactionDock(row, bubble, msgId) {
  closeReactionDock();
  const dock = document.createElement('div');
  dock.className = 'reaction-dock';
  const emojis = ['❤️', '😂', '🔥', '👍', '😮'];
  emojis.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reaction-btn';
    btn.textContent = emoji;
    btn.setAttribute('aria-label', `React with ${emoji}`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addOrUpdateReactionBadge(msgId, emoji);
      socket.emit('message_reaction', { msgId, reaction: emoji });
      playChime('sent');
      triggerHaptic('light');
      closeReactionDock();
    });
    dock.appendChild(btn);
  });
  bubble.appendChild(dock);
  activeReactionDock = dock;
}

function addOrUpdateReactionBadge(msgId, emoji) {
  if (!messageReactions.has(msgId)) {
    messageReactions.set(msgId, new Map());
  }
  const emojiMap = messageReactions.get(msgId);
  emojiMap.set(emoji, (emojiMap.get(emoji) || 0) + 1);
  renderReactionBadges(msgId);
}

function renderReactionBadges(msgId) {
  const row = document.getElementById(msgId);
  if (!row) return;
  let badgesRow = row.querySelector('.reaction-badges-row');
  const emojiMap = messageReactions.get(msgId);
  if (!emojiMap || emojiMap.size === 0) {
    if (badgesRow) badgesRow.remove();
    return;
  }
  if (!badgesRow) {
    badgesRow = document.createElement('div');
    badgesRow.className = 'reaction-badges-row';
    const bubbleWrap = row.querySelector('.msg-bubble-wrap');
    if (bubbleWrap) {
      row.insertBefore(badgesRow, row.querySelector('.msg-timestamp'));
    }
  }
  badgesRow.innerHTML = '';
  emojiMap.forEach((count, emoji) => {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'reaction-badge';
    badge.textContent = `${emoji} ${count}`;
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      addOrUpdateReactionBadge(msgId, emoji);
      socket.emit('message_reaction', { msgId, reaction: emoji });
      playChime('sent');
      triggerHaptic('light');
    });
    badgesRow.appendChild(badge);
  });
}

// 3. Ephemeral Bomb Self-Destruction
let isBombActive = false;
const activeBombTimers = new Map(); // msgId -> intervalId

function generateMsgId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

if (bombToggleBtn) {
  bombToggleBtn.addEventListener('click', () => {
    isBombActive = !isBombActive;
    bombToggleBtn.classList.toggle('active', isBombActive);
    if (messageInput) {
      if (isBombActive) {
        messageInput.setAttribute('placeholder', '💣 Self-destruct message (5s)...');
      } else {
        messageInput.setAttribute('placeholder', 'Type a message...');
      }
    }
  });
}

function triggerMessageDestruction(msgId) {
  if (activeBombTimers.has(msgId)) {
    clearInterval(activeBombTimers.get(msgId));
    activeBombTimers.delete(msgId);
  }
  const row = document.getElementById(msgId);
  if (!row) return;
  row.classList.add('destructing');
  setTimeout(() => {
    row.remove();
    if (activePinnedMsgId === msgId) {
      unpinMessage(false);
    }
  }, 800);
}

// 4. Native MediaRecorder API: 10-Second Voice Notes
let mediaRecorder = null;
let audioChunks = [];
let voiceTimerInterval = null;
let voiceDurationSeconds = 0;
let isRecordingVoice = false;
let audioStream = null;
let shouldSendAudio = true;

async function startVoiceRecording() {
  if (isRecordingVoice) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Audio recording is not supported on this device/browser.');
    return;
  }
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    voiceDurationSeconds = 0;
    shouldSendAudio = true;

    const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
      ? 'audio/webm;codecs=opus'
      : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : '');

    mediaRecorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (audioStream) {
        audioStream.getTracks().forEach((t) => t.stop());
        audioStream = null;
      }
      if (shouldSendAudio && audioChunks.length > 0 && voiceDurationSeconds > 0) {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          const duration = Math.min(Math.max(1, voiceDurationSeconds), 10);
          const replyPayload = activeReply ? { id: activeReply.id, text: activeReply.text, author: activeReply.author } : null;
          const msgId = generateMsgId();

          socket.emit('send_message', {
            msgId: msgId,
            audio: { data: base64Audio, duration: duration },
            replyTo: replyPayload,
            ephemeral: isBombActive
          });
          appendMessage('', 'me', Date.now(), replyPayload, msgId, {
            audio: { data: base64Audio, duration: duration },
            ephemeral: isBombActive
          });
          playChime('sent');
          clearReply();
          if (isBombActive) {
            isBombActive = false;
            bombToggleBtn?.classList.remove('active');
            messageInput?.setAttribute('placeholder', 'Type a message...');
          }
        };
        reader.readAsDataURL(audioBlob);
      }
      audioChunks = [];
      voiceDurationSeconds = 0;
      shouldSendAudio = true;
    };

    mediaRecorder.start(200);
    isRecordingVoice = true;
    if (voiceRecordBar) voiceRecordBar.classList.remove('hidden');
    if (recordingTimer) recordingTimer.textContent = '0:00';
    if (micBtn) micBtn.classList.add('recording');

    voiceTimerInterval = setInterval(() => {
      voiceDurationSeconds++;
      if (recordingTimer) {
        recordingTimer.textContent = `0:${String(voiceDurationSeconds).padStart(2, '0')}`;
      }
      if (voiceDurationSeconds >= 10) {
        stopVoiceRecording(true);
      }
    }, 1000);
  } catch (err) {
    console.warn('Microphone access error:', err);
    alert('Microphone permission required for voice notes.');
    cancelVoiceRecording();
  }
}

function stopVoiceRecording(send = true) {
  if (!isRecordingVoice) return;
  isRecordingVoice = false;
  shouldSendAudio = send;

  if (voiceTimerInterval) {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
  }
  if (voiceRecordBar) voiceRecordBar.classList.add('hidden');
  if (micBtn) micBtn.classList.remove('recording');

  if (!send) {
    audioChunks = [];
    voiceDurationSeconds = 0;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  } else if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
}

function cancelVoiceRecording() {
  stopVoiceRecording(false);
}

if (micBtn) {
  micBtn.addEventListener('click', () => {
    if (isRecordingVoice) {
      stopVoiceRecording(true);
    } else {
      startVoiceRecording();
    }
  });
}
if (cancelVoiceBtn) {
  cancelVoiceBtn.addEventListener('click', cancelVoiceRecording);
}

// 5. Smart Link Preview & Safety Shield Formatter
function formatMessageTextWithSafeLinks(container, text) {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const plainPart = text.substring(lastIndex, match.index);
    if (plainPart) {
      container.appendChild(document.createTextNode(plainPart));
    }
    const fullUrl = match[0];
    try {
      const parsed = new URL(fullUrl);
      const linkChip = document.createElement('a');
      linkChip.href = fullUrl;
      linkChip.target = '_blank';
      linkChip.rel = 'noopener noreferrer';
      linkChip.className = 'safe-link-chip';
      linkChip.title = `Verified Safe Link: ${parsed.hostname}`;
      linkChip.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>${parsed.hostname}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="7" y1="17" x2="17" y2="7"/>
          <polyline points="7 7 17 7 17 17"/>
        </svg>
      `;
      container.appendChild(linkChip);
    } catch (e) {
      container.appendChild(document.createTextNode(fullUrl));
    }
    lastIndex = match.index + fullUrl.length;
  }

  const remaining = text.substring(lastIndex);
  if (remaining) {
    container.appendChild(document.createTextNode(remaining));
  }
}

// 6. Custom Voice Note Player
let currentPlayingAudio = null;
let currentPlayingPlayer = null;

function createVoicePlayer(audioPayload, sender) {
  const player = document.createElement('div');
  player.className = 'voice-player';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'voice-play-btn';
  playBtn.setAttribute('title', 'Play voice note');
  playBtn.setAttribute('aria-label', 'Play voice note');
  playBtn.innerHTML = `
    <svg class="play-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4"/>
    </svg>
    <svg class="pause-icon hidden" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  `;

  const waveform = document.createElement('div');
  waveform.className = 'voice-waveform';
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement('span');
    bar.className = 'wave-bar';
    waveform.appendChild(bar);
  }

  const durationSec = Math.round(audioPayload.duration || 5);
  const durationEl = document.createElement('span');
  durationEl.className = 'voice-duration';
  durationEl.textContent = `0:${String(durationSec).padStart(2, '0')}`;

  player.appendChild(playBtn);
  player.appendChild(waveform);
  player.appendChild(durationEl);

  let audioObj = null;
  let isPlaying = false;

  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!audioObj) {
      audioObj = new Audio(audioPayload.data);
      audioObj.addEventListener('timeupdate', () => {
        const cur = Math.floor(audioObj.currentTime);
        durationEl.textContent = `0:${String(cur).padStart(2, '0')} / 0:${String(durationSec).padStart(2, '0')}`;
      });
      audioObj.addEventListener('ended', () => {
        isPlaying = false;
        if (currentPlayingAudio === audioObj) {
          currentPlayingAudio = null;
          currentPlayingPlayer = null;
        }
        player.classList.remove('playing');
        playBtn.querySelector('.play-icon').classList.remove('hidden');
        playBtn.querySelector('.pause-icon').classList.add('hidden');
        durationEl.textContent = `0:${String(durationSec).padStart(2, '0')}`;
      });
      audioObj.addEventListener('pause', () => {
        isPlaying = false;
        if (currentPlayingAudio === audioObj) {
          currentPlayingAudio = null;
          currentPlayingPlayer = null;
        }
        player.classList.remove('playing');
        playBtn.querySelector('.play-icon').classList.remove('hidden');
        playBtn.querySelector('.pause-icon').classList.add('hidden');
      });
    }

    if (isPlaying) {
      audioObj.pause();
    } else {
      if (currentPlayingAudio && currentPlayingAudio !== audioObj) {
        currentPlayingAudio.pause();
      }
      currentPlayingAudio = audioObj;
      currentPlayingPlayer = player;
      audioObj.play().then(() => {
        isPlaying = true;
        player.classList.add('playing');
        playBtn.querySelector('.play-icon').classList.add('hidden');
        playBtn.querySelector('.pause-icon').classList.remove('hidden');
      }).catch((err) => {
        console.warn('Audio playback error:', err);
      });
    }
  });

  return player;
}

// 7. Delivery & Seen Tick Tracking
const unseenStrangerMsgs = new Set();

function markVisibleStrangerMsgsAsSeen() {
  if (document.hidden || !isPartnerConnected) return;
  unseenStrangerMsgs.forEach((msgId) => {
    socket.emit('message_seen', { msgId });
  });
  unseenStrangerMsgs.clear();
}

window.addEventListener('focus', markVisibleStrangerMsgsAsSeen);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    markVisibleStrangerMsgsAsSeen();
  }
  if (isPartnerConnected) {
    socket.emit('partner_focus', { focused: !document.hidden });
  }
});

// ==========================================================================
// Master Message Appender with Full Feature Suite
// ==========================================================================
function appendMessage(text, sender = 'me', timestamp = Date.now(), replyTo = null, msgId = null, extra = {}) {
  const id = msgId || generateMsgId();
  const row = document.createElement('div');
  row.className = `msg-row ${sender}`;
  row.id = id;

  // Swipe-to-Reply mobile touch gesture
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  const swipeIndicator = document.createElement('div');
  swipeIndicator.className = 'msg-swipe-indicator';
  swipeIndicator.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="9 17 4 12 9 7"/>
      <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  `;
  row.appendChild(swipeIndicator);

  row.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = false;
    }
  }, { passive: true });

  row.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const diffX = e.touches[0].clientX - touchStartX;
      const diffY = e.touches[0].clientY - touchStartY;
      if (Math.abs(diffX) > Math.abs(diffY) && diffX > 10) {
        isSwiping = true;
        const transX = Math.min(diffX * 0.6, 60);
        row.style.transform = `translateX(${transX}px)`;
        row.classList.add('swiping');
      }
    }
  }, { passive: true });

  row.addEventListener('touchend', (e) => {
    if (isSwiping) {
      const diffX = (e.changedTouches[0]?.clientX || 0) - touchStartX;
      if (diffX > 40) {
        triggerHaptic('light');
        const quoteText = text || (extra.audio ? '🎙️ Voice note' : 'Message');
        setReply(id, quoteText, sender === 'me' ? 'self' : 'partner');
      }
      row.style.transform = '';
      row.classList.remove('swiping');
      isSwiping = false;
    }
  });

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'msg-bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  // Double-Tap and Long-Press for Emoji Reaction Dock
  let lastTapTime = 0;
  let longPressTimeout = null;

  bubble.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openReactionDock(row, bubble, id);
  });

  bubble.addEventListener('touchstart', (e) => {
    longPressTimeout = setTimeout(() => {
      openReactionDock(row, bubble, id);
      triggerHaptic('light');
    }, 480);
  }, { passive: true });

  bubble.addEventListener('touchend', (e) => {
    clearTimeout(longPressTimeout);
    const now = Date.now();
    if (now - lastTapTime < 300) {
      openReactionDock(row, bubble, id);
      triggerHaptic('light');
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  });

  bubble.addEventListener('touchmove', () => {
    clearTimeout(longPressTimeout);
  }, { passive: true });

  // Ephemeral Bomb Self-Destruct Handling
  if (extra && extra.ephemeral) {
    row.classList.add('ephemeral-msg');
    const badge = document.createElement('div');
    badge.className = 'ephemeral-badge';
    badge.innerHTML = `💣 <span class="bomb-count" id="bomb_count_${id}">5s</span>`;
    bubble.appendChild(badge);

    let secondsLeft = 5;
    const countEl = badge.querySelector('.bomb-count');
    const bombInterval = setInterval(() => {
      secondsLeft--;
      if (countEl) countEl.textContent = `${secondsLeft}s`;
      if (secondsLeft <= 0) {
        clearInterval(bombInterval);
        activeBombTimers.delete(id);
        triggerMessageDestruction(id);
        socket.emit('message_destruct', { msgId: id });
      }
    }, 1000);
    activeBombTimers.set(id, bombInterval);
  }

  // Quoted Reply Card
  if (replyTo && replyTo.text) {
    const quoteCard = document.createElement('div');
    quoteCard.className = 'quoted-card';

    const quoteBar = document.createElement('div');
    quoteBar.className = 'quoted-bar';

    const quoteContent = document.createElement('div');
    quoteContent.className = 'quoted-content';

    let displayAuthor = 'Stranger';
    if (sender === 'me') {
      displayAuthor = replyTo.author === 'partner' ? 'Stranger' : 'You';
    } else {
      displayAuthor = replyTo.author === 'partner' ? 'You' : 'Stranger';
    }

    const quoteAuthorEl = document.createElement('span');
    quoteAuthorEl.className = 'quoted-author';
    quoteAuthorEl.textContent = displayAuthor;

    const quoteTextEl = document.createElement('span');
    quoteTextEl.className = 'quoted-text';
    quoteTextEl.textContent = replyTo.text;

    quoteContent.appendChild(quoteAuthorEl);
    quoteContent.appendChild(quoteTextEl);
    quoteCard.appendChild(quoteBar);
    quoteCard.appendChild(quoteContent);

    if (replyTo.id) {
      quoteCard.addEventListener('click', () => {
        const target = document.getElementById(replyTo.id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.remove('msg-highlight');
          void target.offsetWidth;
          target.classList.add('msg-highlight');
          setTimeout(() => target.classList.remove('msg-highlight'), 1500);
        }
      });
    }

    bubble.appendChild(quoteCard);
  }

  // Render Body: Audio Voice Note or Text with Safe Links
  if (extra && extra.audio && extra.audio.data) {
    const player = createVoicePlayer(extra.audio, sender);
    bubble.appendChild(player);
  } else if (text) {
    const textEl = document.createElement('div');
    textEl.className = 'msg-text';
    formatMessageTextWithSafeLinks(textEl, text);
    bubble.appendChild(textEl);
  }

  // Action Buttons Group (Reply, 1-Click Copy, Pin)
  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'msg-actions';

  // Reply Button
  const replyBtn = document.createElement('button');
  replyBtn.type = 'button';
  replyBtn.className = 'msg-reply-btn';
  replyBtn.setAttribute('title', 'Reply to message');
  replyBtn.setAttribute('aria-label', 'Reply to message');
  replyBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 17 4 12 9 7"/>
      <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  `;
  replyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const quoteText = text || (extra.audio ? '🎙️ Voice note' : 'Message');
    setReply(id, quoteText, sender === 'me' ? 'self' : 'partner');
  });
  actionsWrap.appendChild(replyBtn);

  // 1-Click Copy Button
  if (text) {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-copy-btn';
    copyBtn.setAttribute('title', 'Copy text');
    copyBtn.setAttribute('aria-label', 'Copy message text');
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `;
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const temp = document.createElement('textarea');
          temp.value = text;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
        }
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
        triggerHaptic('light');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          `;
        }, 1200);
      } catch (err) {
        console.warn('Copy error:', err);
      }
    });
    actionsWrap.appendChild(copyBtn);
  }

  // Pin Button
  const pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  pinBtn.className = 'msg-pin-btn';
  pinBtn.setAttribute('title', 'Pin message');
  pinBtn.setAttribute('aria-label', 'Pin message to session top');
  pinBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
    </svg>
  `;
  pinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const pinContent = text || (extra.audio ? '🎙️ Voice note' : 'Message');
    if (activePinnedMsgId === id) {
      unpinMessage(true);
    } else {
      setPinnedMessage(id, pinContent, true);
      triggerHaptic('light');
    }
  });
  actionsWrap.appendChild(pinBtn);

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(actionsWrap);

  // Timestamp & Delivery/Seen Status Tick
  const time = document.createElement('div');
  time.className = 'msg-timestamp';
  time.textContent = formatTime(timestamp);

  if (sender === 'me') {
    const tick = document.createElement('span');
    tick.className = 'msg-status-tick tick-single';
    tick.id = `tick_${id}`;
    tick.title = 'Sent';
    tick.textContent = '✓';
    time.appendChild(tick);
  }

  row.appendChild(bubbleWrap);
  row.appendChild(time);

  const nearBottom = isScrolledNearBottom();
  messagesContainer.appendChild(row);

  if (sender === 'me' || nearBottom) {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    clearUnreadPill();
  } else {
    unreadCount++;
    updateNewMsgPill();
  }

  // Stranger message delivery & seen reporting
  if (sender === 'stranger') {
    socket.emit('message_delivered', { msgId: id });
    if (!document.hidden) {
      socket.emit('message_seen', { msgId: id });
    } else {
      unseenStrangerMsgs.add(id);
    }
  }

  return id;
}

function appendDisconnectBanner() {
  const existing = document.getElementById('disconnectBanner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'disconnect-chip';
  banner.id = 'disconnectBanner';
  banner.innerHTML = `
    <div class="disconnect-text">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span>Stranger has disconnected.</span>
    </div>
    <button class="reconnect-btn" id="findNewBtn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 4 15 12 5 20 5 4"/>
        <line x1="19" y1="5" x2="19" y2="19"/>
      </svg>
      <span>Next Stranger</span>
    </button>
  `;
  messagesContainer.appendChild(banner);
  if (isScrolledNearBottom()) {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
  }

  document.getElementById('findNewBtn').addEventListener('click', () => {
    startSearch();
  });
}

function stopActiveMediaAndTimers() {
  activeBombTimers.forEach((timer) => clearInterval(timer));
  activeBombTimers.clear();
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio = null;
    currentPlayingPlayer = null;
  }
}

function resetChatUI() {
  clearReply();
  cancelSkipGrace();
  clearUnreadPill();
  unpinMessage(false);
  closeReactionDock();
  messageReactions.clear();
  unseenStrangerMsgs.clear();
  stopVoiceRecording(false);
  stopActiveMediaAndTimers();
  isBombActive = false;
  isTypingSent = false;
  clearTimeout(typingTimeout);
  if (bombToggleBtn) bombToggleBtn.classList.remove('active');
  if (messageInput) messageInput.setAttribute('placeholder', 'Type a message...');

  messagesContainer.innerHTML = `
    <div class="system-chip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span>You are paired with a stranger. Say hello!</span>
    </div>
  `;
  messageInput.value = '';
  messageInput.disabled = false;
  messageInput.focus();
  typingIndicator.classList.add('hidden');
  strangerSubstatus.innerHTML = `
    <span class="active-dot"></span>
    <span>Connected</span>
  `;
}

function startSearch() {
  cancelSkipGrace();
  clearReply();
  clearUnreadPill();
  unpinMessage(false);
  closeReactionDock();
  stopVoiceRecording(false);
  stopActiveMediaAndTimers();
  triggerDimensionalWarp(900);
  showScreen(searchingScreen);
  socket.emit('find_partner');
}

function cancelSearch() {
  socket.emit('cancel_search');
  showScreen(landingScreen);
}

function nextPartner() {
  cancelSkipGrace();
  clearReply();
  clearUnreadPill();
  unpinMessage(false);
  closeReactionDock();
  stopVoiceRecording(false);
  stopActiveMediaAndTimers();
  triggerDimensionalWarp(900);
  socket.emit('next_partner');
  showScreen(searchingScreen);
}

function endChat() {
  cancelSkipGrace();
  clearReply();
  clearUnreadPill();
  unpinMessage(false);
  closeReactionDock();
  stopVoiceRecording(false);
  stopActiveMediaAndTimers();
  socket.emit('leave_chat');
  showScreen(landingScreen);
}

// Event Bindings
startChatBtn.addEventListener('click', startSearch);
cancelSearchBtn.addEventListener('click', cancelSearch);
nextChatBtn.addEventListener('click', triggerNextWithGrace);
endChatBtn.addEventListener('click', endChat);

// Chat Input Form
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !isPartnerConnected) return;

  const replyPayload = activeReply ? {
    id: activeReply.id,
    text: activeReply.text,
    author: activeReply.author
  } : null;

  const willBeEphemeral = isBombActive;
  const msgId = generateMsgId();
  socket.emit('send_message', { msgId, text, replyTo: replyPayload, ephemeral: willBeEphemeral });
  appendMessage(text, 'me', Date.now(), replyPayload, msgId, { ephemeral: willBeEphemeral });
  playChime('sent');

  if (willBeEphemeral) {
    isBombActive = false;
    bombToggleBtn?.classList.remove('active');
    messageInput?.setAttribute('placeholder', 'Type a message...');
  }

  clearReply();
  isTypingSent = false;
  socket.emit('stop_typing');
  clearTimeout(typingTimeout);

  messageInput.value = '';
  messageInput.focus();
});

messageInput.addEventListener('input', () => {
  if (!isPartnerConnected) return;

  if (!isTypingSent) {
    isTypingSent = true;
    socket.emit('typing');
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTypingSent = false;
    socket.emit('stop_typing');
  }, 1400);
});

// Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && chatScreen.classList.contains('active')) {
    e.preventDefault();
    if (skipTimer) {
      cancelSkipGrace();
    } else {
      triggerNextWithGrace();
    }
  }
});

// Socket Listeners
socket.on('online_count', (data) => {
  if (data && typeof data.count === 'number') {
    onlineCountText.textContent = `${data.count} online`;
    const pill = document.getElementById('onlinePill');
    if (pill) {
      pill.style.borderColor = 'rgba(34, 197, 94, 0.6)';
      setTimeout(() => {
        pill.style.borderColor = '';
      }, 600);
    }
  }
});

socket.on('waiting_for_partner', () => {
  showScreen(searchingScreen);
});

socket.on('search_cancelled', () => {
  showScreen(landingScreen);
});

socket.on('chat_start', () => {
  isPartnerConnected = true;
  resetChatUI();
  showScreen(chatScreen);
  playChime('connected');
  triggerHaptic('connected');
});

socket.on('receive_message', (data) => {
  appendMessage(data.text, 'stranger', data.timestamp, data.replyTo, data.msgId, {
    ephemeral: data.ephemeral,
    audio: data.audio
  });
  playChime('received');
  triggerHaptic('light');
  typingIndicator.classList.add('hidden');
});

socket.on('message_sent_ack', (data) => {
  if (data && data.msgId) {
    const tick = document.getElementById('tick_' + data.msgId);
    if (tick) {
      tick.textContent = '✓';
      tick.className = 'msg-status-tick tick-single';
      tick.title = 'Sent';
    }
  }
});

socket.on('message_delivered', (data) => {
  if (data && data.msgId) {
    const tick = document.getElementById('tick_' + data.msgId);
    if (tick && !tick.classList.contains('tick-seen')) {
      tick.textContent = '✓✓';
      tick.className = 'msg-status-tick tick-double';
      tick.title = 'Delivered';
    }
  }
});

socket.on('message_seen', (data) => {
  if (data && data.msgId) {
    const tick = document.getElementById('tick_' + data.msgId);
    if (tick) {
      tick.textContent = '✓✓';
      tick.className = 'msg-status-tick tick-seen';
      tick.title = 'Seen';
    }
  }
});

socket.on('message_reaction', (data) => {
  if (data && data.msgId && data.reaction) {
    addOrUpdateReactionBadge(data.msgId, data.reaction);
    playChime('received');
    triggerHaptic('light');
  }
});

socket.on('pin_message', (data) => {
  if (data && data.msgId) {
    setPinnedMessage(data.msgId, data.text || '', false);
    triggerHaptic('light');
  }
});

socket.on('unpin_message', () => {
  unpinMessage(false);
});

socket.on('message_destruct', (data) => {
  if (data && data.msgId) {
    triggerMessageDestruction(data.msgId);
  }
});

socket.on('partner_typing', () => {
  typingIndicator.classList.remove('hidden');
  if (isScrolledNearBottom()) {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
  }
});

socket.on('partner_stop_typing', () => {
  typingIndicator.classList.add('hidden');
});

socket.on('partner_disconnected', () => {
  isPartnerConnected = false;
  cancelSkipGrace();
  clearReply();
  unpinMessage(false);
  closeReactionDock();
  stopVoiceRecording(false);
  stopActiveMediaAndTimers();
  strangerSubstatus.innerHTML = `
    <span class="active-dot" style="background-color: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>
    <span style="color: #ef4444;">Disconnected</span>
  `;
  messageInput.disabled = true;
  typingIndicator.classList.add('hidden');
  appendDisconnectBanner();
  playChime('disconnected');
  triggerHaptic('disconnected');
});

socket.on('chat_ended', () => {
  isPartnerConnected = false;
  cancelSkipGrace();
  clearReply();
  clearUnreadPill();
  unpinMessage(false);
  closeReactionDock();
  stopVoiceRecording(false);
  stopActiveMediaAndTimers();
  showScreen(landingScreen);
});

socket.on('disconnect', () => {
  isPartnerConnected = false;
  isTypingSent = false;
  clearTimeout(typingTimeout);
  if (chatScreen.classList.contains('active')) {
    messageInput.disabled = true;
    strangerSubstatus.innerHTML = `
      <span class="active-dot" style="background-color: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>
      <span style="color: #ef4444;">Disconnected</span>
    `;
    appendDisconnectBanner();
  }
});
