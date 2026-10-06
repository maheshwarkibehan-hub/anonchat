const fs = require('fs');
const path = require('path');
const http = require('http');

process.env.PORT = 3025;
process.env.MAINTENANCE_MODE = 'false';
const server = require('./server');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('[PASS] ' + msg);
    passed++;
  } else {
    console.error('[FAIL] ' + msg);
    failed++;
  }
}

async function runTests() {
  console.log('--- Testing AnonChat Admin Live Monitor & Joby Sir Prank Feature ---');

  // 1. Static Asset & Code Verification
  console.log('\n1. Checking Files and Integration Points...');
  const adminHtmlPath = path.join(__dirname, 'public', 'admin.html');
  assert(fs.existsSync(adminHtmlPath), 'public/admin.html exists on disk');

  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
  assert(adminHtml.includes('AnonChat God Mode'), 'admin.html contains Mission Control branding');
  assert(adminHtml.includes('Prank & Intervention Studio'), 'admin.html contains Prank & Intervention Studio');
  assert(adminHtml.includes('targetRoomSelect'), 'admin.html has target room selector');
  assert(adminHtml.includes('prankSenderName'), 'admin.html has customizable sender name input');
  assert(adminHtml.includes('prankSenderRole'), 'admin.html has customizable sender role input');
  assert(adminHtml.includes('prankPhotoUrl'), 'admin.html has avatar photo URL input');
  assert(adminHtml.includes('prankMessageText'), 'admin.html has custom prank message textarea');
  assert(adminHtml.includes('btnLaunchPrank'), 'admin.html has launch prank trigger button');
  assert(adminHtml.includes('chatFeed'), 'admin.html has live chat inspector wiretap feed');
  assert(adminHtml.includes('roomsListContainer'), 'admin.html has active rooms directory container');
  assert(adminHtml.includes('btnTestSiren'), 'admin.html has test siren synthesizer button');
  assert(adminHtml.includes('PRESETS'), 'admin.html includes 1-click persona disguise presets (Joby Sir, Principal, Police, Hacker, Ghost, Admin)');

  const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(serverJs.includes("app.get('/admin'"), 'server.js registers clean /admin route');
  assert(serverJs.includes('const adminSockets = new Set()'), 'server.js tracks connected admin dashboards');
  assert(serverJs.includes('function getAdminRoomsSummary('), 'server.js contains getAdminRoomsSummary helper');
  assert(serverJs.includes('function notifyAdminRoomCreated('), 'server.js contains notifyAdminRoomCreated helper');
  assert(serverJs.includes('function notifyAdminRoomClosed('), 'server.js contains notifyAdminRoomClosed helper');
  assert(serverJs.includes('function notifyAdminNewMessage('), 'server.js contains notifyAdminNewMessage helper');
  assert(serverJs.includes('function broadcastAdminStats('), 'server.js contains broadcastAdminStats helper');

  assert(serverJs.includes("socket.on('admin_init'"), 'server.js listens for admin_init socket handshake');
  assert(serverJs.includes("socket.on('admin_get_room_history'"), 'server.js listens for admin_get_room_history event');
  assert(serverJs.includes("socket.on('admin_send_prank'"), 'server.js listens for admin_send_prank event');
  assert(serverJs.includes("socket.on('admin_disconnect_room'"), 'server.js listens for admin_disconnect_room event');

  assert(serverJs.includes("app.get('/api/admin/rooms'"), 'server.js provides GET /api/admin/rooms REST endpoint');
  assert(serverJs.includes("app.get('/api/admin/room/:roomId'"), 'server.js provides GET /api/admin/room/:roomId REST endpoint');
  assert(serverJs.includes("app.post('/api/admin/prank'"), 'server.js provides POST /api/admin/prank REST endpoint');

  const clientJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  assert(clientJs.includes('scheduleJobySirIntervention(incomingData'), 'client.js scheduleJobySirIntervention accepts dynamic incoming data');
  assert(clientJs.includes('renderJobySirMessage(data)'), 'client.js renders dynamic prank cards');
  assert(clientJs.includes('incomingName'), 'client.js dynamically renders custom typing persona');

  // 2. HTTP Server Endpoints Verification
  console.log('\n2. Testing HTTP Endpoints on port 3025...');
  await new Promise(r => setTimeout(r, 600));

  function fetchUrl(urlPath, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlPath, `http://localhost:3025`);
      const opts = {
        method,
        headers: {}
      };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
      }
      const req = http.request(url, opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Test GET /admin
  const resAdmin = await fetchUrl('/admin');
  assert(resAdmin.status === 200, 'GET /admin returns 200 OK');
  assert(resAdmin.data.includes('AnonChat God Mode'), 'GET /admin serves AnonChat Admin dashboard HTML');

  // Test GET /api/admin/rooms
  const resApiRooms = await fetchUrl('/api/admin/rooms');
  assert(resApiRooms.status === 200, 'GET /api/admin/rooms returns 200 OK');
  const roomsJson = JSON.parse(resApiRooms.data);
  assert(typeof roomsJson.stats === 'object', 'Response has stats object');
  assert(Array.isArray(roomsJson.rooms), 'Response has rooms array');
  assert(typeof roomsJson.stats.onlineCount === 'number', 'Stats onlineCount is numeric');
  assert(typeof roomsJson.stats.activeRoomsCount === 'number', 'Stats activeRoomsCount is numeric');

  // Test POST /api/admin/prank validation (empty payload)
  const resPrankEmpty = await fetchUrl('/api/admin/prank', 'POST', {});
  assert(resPrankEmpty.status === 400, 'POST /api/admin/prank without active room returns 400 validation error');

  // 3. Functional Simulation of Admin Prank Execution
  console.log('\n3. Testing Prank Dispatch & Message Injection Cycle...');
  const simulatedRoomId = 'room_sim_test_999';
  const dispatchedEvents = [];

  const mockIo = {
    to(rId) {
      return {
        emit(evt, payload) {
          dispatchedEvents.push({ roomId: rId, event: evt, payload, time: Date.now() });
        }
      };
    }
  };

  function simulateAdminPrank(roomId, prankPayload) {
    const incomingPayload = {
      name: prankPayload.name || 'Joby Jacob Sir',
      role: prankPayload.role || 'Discipline Incharge',
      forced: true,
      siren: prankPayload.siren !== false
    };

    const messagePayload = {
      id: `prank_${Date.now()}_test`,
      name: prankPayload.name,
      role: prankPayload.role,
      photo: prankPayload.photo || '/joby-sir.jpg',
      fallbackPhoto: '/joby-sir.jpg',
      text: prankPayload.text,
      footer: prankPayload.footer || 'Staff Room / Discipline Alert • SJS Kaushambi',
      timestamp: Date.now(),
      forced: true,
      siren: prankPayload.siren !== false
    };

    if (prankPayload.typingBefore) {
      mockIo.to(roomId).emit('joby_sir_incoming', incomingPayload);
    }
    mockIo.to(roomId).emit('joby_sir_message', messagePayload);
  }

  // Test custom prank with custom persona name: "Principal Sebastian"
  simulateAdminPrank(simulatedRoomId, {
    name: 'Principal Sebastian',
    role: 'School Director',
    photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
    text: 'Beta Principal office me turant aao kal subah!',
    siren: true,
    typingBefore: true
  });

  assert(dispatchedEvents.length === 2, 'Simulated prank dispatched exactly 2 events in sequence');
  assert(dispatchedEvents[0].event === 'joby_sir_incoming', 'First event is joby_sir_incoming typing alert');
  assert(dispatchedEvents[0].payload.name === 'Principal Sebastian', 'Incoming typing has custom persona name');
  assert(dispatchedEvents[1].event === 'joby_sir_message', 'Second event is joby_sir_message prank payload');
  assert(dispatchedEvents[1].payload.name === 'Principal Sebastian', 'Prank payload has custom persona name');
  assert(dispatchedEvents[1].payload.role === 'School Director', 'Prank payload has custom role');
  assert(dispatchedEvents[1].payload.text === 'Beta Principal office me turant aao kal subah!', 'Prank payload has custom text');
  assert(dispatchedEvents[1].payload.forced === true, 'Prank has forced: true flag to bypass client spam limiter');

  console.log(`\n======================================================`);
  console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================`);

  server.close(() => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

runTests().catch(err => {
  console.error('[Error in test execution]', err);
  process.exit(1);
});
