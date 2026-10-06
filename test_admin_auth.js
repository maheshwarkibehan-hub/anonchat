const fs = require('fs');
const path = require('path');
const http = require('http');

process.env.PORT = 3031;
process.env.MAINTENANCE_MODE = 'false';

// Backup existing admin_auth.json if present
const authFile = path.join(__dirname, 'data', 'admin_auth.json');
let backupAuthData = null;
if (fs.existsSync(authFile)) {
  backupAuthData = fs.readFileSync(authFile, 'utf8');
  fs.unlinkSync(authFile);
}

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

function fetchUrl(urlPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, `http://localhost:3031`);
    const opts = {
      method,
      headers: { ...headers }
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

async function runTests() {
  console.log('=== Testing Master Admin Login & First-Time Setup Lifecycle ===\n');

  try {
    // 1. Initial State Check
    console.log('1. Checking uninitialized state...');
    const resStatus1 = await fetchUrl('/api/admin/auth/status');
    assert(resStatus1.status === 200, 'GET /api/admin/auth/status returns 200');
    const statusData1 = JSON.parse(resStatus1.data);
    assert(statusData1.initialized === false, 'initialized is false on clean state');
    assert(statusData1.authenticated === false, 'authenticated is false on clean state');

    // 2. Reject invalid setup attempts
    console.log('\n2. Testing setup validation...');
    const resShortPw = await fetchUrl('/api/admin/auth/setup', 'POST', { username: 'admin', password: '12' });
    assert(resShortPw.status === 400, 'Rejects password shorter than 5 chars');

    const resShortUser = await fetchUrl('/api/admin/auth/setup', 'POST', { username: 'a', password: 'password123' });
    assert(resShortUser.status === 400, 'Rejects username shorter than 3 chars');

    // 3. Successful Setup
    console.log('\n3. Creating initial admin credentials...');
    const resSetup = await fetchUrl('/api/admin/auth/setup', 'POST', { username: 'superadmin', password: 'masterPassword2026' });
    assert(resSetup.status === 200, 'POST /api/admin/auth/setup returns 200 OK');
    const setupData = JSON.parse(resSetup.data);
    assert(setupData.success === true, 'Setup returns success: true');
    assert(typeof setupData.token === 'string' && setupData.token.length > 20, 'Setup issues session token');
    assert(setupData.username === 'superadmin', 'Username matches');

    // Verify disk record has scrypt hash and salt, NOT plaintext password
    assert(fs.existsSync(authFile), 'data/admin_auth.json created on disk');
    const fileRecord = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    assert(fileRecord.initialized === true, 'disk record has initialized: true');
    assert(!fileRecord.password, 'disk record NEVER stores plaintext password');
    assert(typeof fileRecord.hash === 'string' && typeof fileRecord.salt === 'string', 'disk record has cryptographic hash and salt');

    // 4. Prevent duplicate setup
    console.log('\n4. Verifying setup cannot be re-triggered...');
    const resDupSetup = await fetchUrl('/api/admin/auth/setup', 'POST', { username: 'hacker', password: 'hackedPassword' });
    assert(resDupSetup.status === 400, 'Duplicate setup attempt rejected with 400 Bad Request');

    // 5. Check status with and without token
    console.log('\n5. Checking auth status with token...');
    const resStatusNoToken = await fetchUrl('/api/admin/auth/status');
    const statusNoToken = JSON.parse(resStatusNoToken.data);
    assert(statusNoToken.initialized === true, 'Status shows initialized: true');
    assert(statusNoToken.authenticated === false, 'Status without token shows authenticated: false');

    const resStatusWithToken = await fetchUrl('/api/admin/auth/status', 'GET', null, { 'x-admin-token': setupData.token });
    const statusWithToken = JSON.parse(resStatusWithToken.data);
    assert(statusWithToken.authenticated === true, 'Status with token shows authenticated: true');
    assert(statusWithToken.username === 'superadmin', 'Authenticated username is correct');

    // 6. Test Login endpoint
    console.log('\n6. Testing Login verification...');
    const resWrongPw = await fetchUrl('/api/admin/auth/login', 'POST', { username: 'superadmin', password: 'wrongPassword' });
    assert(resWrongPw.status === 401, 'Invalid password rejected with 401');

    const resWrongUser = await fetchUrl('/api/admin/auth/login', 'POST', { username: 'wrongadmin', password: 'masterPassword2026' });
    assert(resWrongUser.status === 401, 'Invalid username rejected with 401');

    const resLoginSuccess = await fetchUrl('/api/admin/auth/login', 'POST', { username: 'superadmin', password: 'masterPassword2026' });
    assert(resLoginSuccess.status === 200, 'Valid login returns 200 OK');
    const loginData = JSON.parse(resLoginSuccess.data);
    assert(loginData.success === true, 'Login returns success: true');
    assert(typeof loginData.token === 'string', 'Login returns valid session token');

    // 7. Test Logout
    console.log('\n7. Testing Logout revocation...');
    const resLogout = await fetchUrl('/api/admin/auth/logout', 'POST', null, { 'x-admin-token': loginData.token });
    assert(resLogout.status === 200, 'POST /api/admin/auth/logout returns 200');

    const resStatusAfterLogout = await fetchUrl('/api/admin/auth/status', 'GET', null, { 'x-admin-token': loginData.token });
    const statusAfterLogout = JSON.parse(resStatusAfterLogout.data);
    assert(statusAfterLogout.authenticated === false, 'Logged out token is no longer authenticated');

    // 8. HTML UI checks
    console.log('\n8. Checking admin.html UI components...');
    const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
    assert(adminHtml.includes('adminAuthOverlay'), 'admin.html has master authentication overlay');
    assert(adminHtml.includes('adminSetupForm'), 'admin.html has setup form for first-time creation');
    assert(adminHtml.includes('adminLoginForm'), 'admin.html has login form for subsequent visits');
    assert(adminHtml.includes('checkAdminAuth'), 'admin.html includes checkAdminAuth logic');
    assert(adminHtml.includes('handleAdminLogout'), 'admin.html includes logout capability');

  } finally {
    // Restore original auth data if there was any before test
    if (backupAuthData) {
      fs.writeFileSync(authFile, backupAuthData, 'utf8');
    }
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
