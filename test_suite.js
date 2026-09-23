const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Import server
process.env.PORT = 3009;
process.env.MAINTENANCE_MODE = 'false';
const server = require('./server');

async function runTests() {
  console.log('--- Starting AnonChat Verification Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Static Asset Inspections
  console.log('\n1. Checking Static Assets...');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
  const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');
  const clientJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf-8');
  const previewHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'brain', '19b2b985-596e-4753-9fae-13aedbd24101', 'ui_preview.html'), 'utf-8');

  assert(indexHtml.includes('id="dimensionalCanvas"'), 'index.html has dimensionalCanvas');
  assert(indexHtml.includes('id="dimensionalFlash"'), 'index.html has dimensionalFlash');
  assert(indexHtml.includes('id="dimensionalPortal"'), 'index.html has dimensionalPortal ingress ring');
  assert(indexHtml.includes('gradient-headline'), 'index.html has gradient headline');
  assert(indexHtml.includes('gsap.min.js'), 'index.html loads GSAP library');
  assert(indexHtml.includes('three.min.js'), 'index.html loads Three.js library');

  assert(styleCss.includes('--bg-void: #030508'), 'style.css contains deep obsidian void color');
  assert(styleCss.includes('--accent-gradient'), 'style.css contains celestial aurora accent gradient');
  assert(styleCss.includes('.dimensional-canvas'), 'style.css styles dimensional canvas');
  assert(styleCss.includes('.dimensional-portal'), 'style.css styles dimensional portal ring');
  assert(styleCss.includes('::view-transition'), 'style.css integrates View Transitions API');
  assert(styleCss.includes('prefers-reduced-motion'), 'style.css respects reduced motion preference');

  assert(clientJs.includes('triggerDimensionalWarp'), 'client.js contains 3D warp jump function');
  assert(clientJs.includes('animateStars'), 'client.js contains canvas animation loop');
  assert(clientJs.includes('startViewTransition'), 'client.js supports View Transitions API');
  assert(clientJs.includes('warpActive'), 'client.js tracks warp state');
  assert(clientJs.includes('initDimensionalEntrance'), 'client.js contains dimensional entrance sequence');
  assert(clientJs.includes('warpTimeout'), 'client.js has timer collision protection for rapid warp triggers');

  assert(previewHtml.includes('dimensionalCanvas'), 'ui_preview.html has dimensionalCanvas');
  assert(previewHtml.includes('triggerDimensionalWarp'), 'ui_preview.html has 3D warp engine');
  assert(previewHtml.includes('switchMode'), 'ui_preview.html has responsive switcher');
  assert(previewHtml.includes('gsap.min.js'), 'ui_preview.html loads GSAP library');
  assert(previewHtml.includes('three.min.js'), 'ui_preview.html loads Three.js library');

  // 2. HTTP Server Endpoint Checks
  console.log('\n2. Testing HTTP Endpoints on port 3009...');
  await new Promise((resolve) => setTimeout(resolve, 600));

  function fetchUrl(pathname) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:3009${pathname}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
  }

  const resIndex = await fetchUrl('/');
  assert(resIndex.status === 200, 'GET / returns 200 OK');
  assert(resIndex.data.includes('AnonChat'), 'GET / serves AnonChat index.html');

  const resCss = await fetchUrl('/style.css');
  assert(resCss.status === 200, 'GET /style.css returns 200 OK');
  assert(resCss.data.includes('--bg-void'), 'GET /style.css serves updated CSS');

  const resJs = await fetchUrl('/client.js');
  assert(resJs.status === 200, 'GET /client.js returns 200 OK');
  assert(resJs.data.includes('triggerDimensionalWarp'), 'GET /client.js serves updated client script');

  const resSocketClient = await fetchUrl('/socket.io/socket.io.js');
  assert(resSocketClient.status === 200, 'GET /socket.io/socket.io.js serves official socket.io client bundle');

  // 3. Socket.io Engine Handshake Check
  console.log('\n3. Testing Socket.io Engine Handshake & Protocol...');
  const resHandshake = await fetchUrl('/socket.io/?EIO=4&transport=polling');
  assert(resHandshake.status === 200, 'Socket.io handshake returns 200 OK');
  assert(resHandshake.data.startsWith('0{'), 'Socket.io handshake returns valid Engine.io v4 payload');

  const sessionData = JSON.parse(resHandshake.data.substring(1));
  assert(typeof sessionData.sid === 'string' && sessionData.sid.length > 0, 'Handshake returns valid session ID (sid)');
  assert(Array.isArray(sessionData.upgrades) && sessionData.upgrades.includes('websocket'), 'Handshake supports WebSocket upgrade');

  // 4. WebSocket Connection via ws
  console.log('\n4. Testing WebSocket Upgrade via ws...');
  const wsUrl = `ws://localhost:3009/socket.io/?EIO=4&transport=websocket&sid=${sessionData.sid}`;
  const ws = new WebSocket(wsUrl);

  const wsConnected = await new Promise((resolve) => {
    ws.on('open', () => {
      // Send 2probe
      ws.send('2probe');
      resolve(true);
    });
    ws.on('error', () => resolve(false));
  });
  assert(wsConnected, 'WebSocket upgrade connected and sent probe');

  const probeAck = await new Promise((resolve) => {
    ws.on('message', (data) => {
      const msg = data.toString();
      if (msg === '3probe') {
        resolve(true);
      }
    });
    setTimeout(() => resolve(false), 2000);
  });
  assert(probeAck, 'Server replied with 3probe acknowledgment');

  ws.close();

  console.log(`\n--- Verification Summary: ${passed} Passed, ${failed} Failed ---`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
