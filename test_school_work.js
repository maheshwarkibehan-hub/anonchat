const fs = require('fs');
const path = require('path');
const http = require('http');

process.env.PORT = 3028;
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

function fetchUrl(urlPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, `http://localhost:3028`);
    const opts = { method, headers: {} };
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
  console.log('=== Testing School Work & Class Notes Implementation ===\n');

  // 1. Files on Disk
  console.log('1. Checking Files and Design Tokens...');
  const schoolWorkHtmlPath = path.join(__dirname, 'public', 'school-work.html');
  assert(fs.existsSync(schoolWorkHtmlPath), 'public/school-work.html exists');

  const schoolWorkCssPath = path.join(__dirname, 'public', 'css', 'school-work.css');
  assert(fs.existsSync(schoolWorkCssPath), 'public/css/school-work.css exists');

  const schoolWorkJsonPath = path.join(__dirname, 'data', 'school_work.json');
  assert(fs.existsSync(schoolWorkJsonPath), 'data/school_work.json exists');

  const swHtml = fs.readFileSync(schoolWorkHtmlPath, 'utf8');
  assert(!swHtml.includes('⚛️') && !swHtml.includes('🧪') && !swHtml.includes('📚'), 'school-work.html does not contain tacky emoji clutter');
  assert(swHtml.includes('Instrument Serif'), 'school-work.html uses Instrument Serif branding');
  assert(swHtml.includes('sw-lightbox'), 'school-work.html includes Fullscreen Lightbox Zoom & Pan component');

  // 2. Navbar Integration in index.html & app-chat.html
  console.log('\n2. Checking Navbar Integration...');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  assert(indexHtml.includes('/school-work') && indexHtml.includes('School Work'), 'index.html navbar has School Work link');

  const appChatHtml = fs.readFileSync(path.join(__dirname, 'public', 'app-chat.html'), 'utf8');
  assert(appChatHtml.includes('/school-work') && appChatHtml.includes('School Work'), 'app-chat.html navbar has School Work link');

  // 3. Admin Panel Integration
  console.log('\n3. Checking Admin Panel Integration...');
  const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
  assert(adminHtml.includes('School Work Manager'), 'admin.html has School Work Manager switch button');
  assert(adminHtml.includes('schoolwork-dashboard'), 'admin.html contains School Work studio dashboard');
  assert(adminHtml.includes('sw-dropzone'), 'admin.html contains photo upload dropzone');

  // 4. HTTP Endpoints
  console.log('\n4. Testing HTTP & REST API Endpoints on Port 3028...');
  await new Promise(r => setTimeout(r, 600));

  // GET /school-work
  const resPage = await fetchUrl('/school-work');
  assert(resPage.status === 200, 'GET /school-work returns 200 OK');
  assert(resPage.data.includes('School Work &amp; Notes'), 'GET /school-work renders page HTML');

  // GET /api/school-work/subjects
  const resSubjects = await fetchUrl('/api/school-work/subjects');
  assert(resSubjects.status === 200, 'GET /api/school-work/subjects returns 200 OK');
  const subjectsData = JSON.parse(resSubjects.data);
  assert(subjectsData.success === true, 'GET /api/school-work/subjects response has success: true');
  assert(Array.isArray(subjectsData.subjects) && subjectsData.subjects.length === 8, 'All 8 NCERT subjects present (moral science omitted)');

  const names = subjectsData.subjects.map(s => s.name);
  assert(names.includes('Physics') && names.includes('Chemistry') && names.includes('Biology'), 'Science is cleanly split into Physics, Chemistry, and Biology');
  assert(names.includes('Mathematics') && names.includes('Social Science') && names.includes('English'), 'Core subjects present (Mathematics, Social Science, English)');
  assert(names.includes('Hindi') && (names.includes('Computer') || names.includes('Computer Applications')), 'Elective & Language subjects present (Hindi, Computer)');
  assert(!names.includes('Moral Science'), 'Moral Science is excluded per NCERT curriculum specification');

  // GET /api/school-work/subject/physics
  const resSubjectPhysics = await fetchUrl('/api/school-work/subject/physics');
  assert(resSubjectPhysics.status === 200, 'GET /api/school-work/subject/physics returns 200 OK');

  // 5. Admin Chapter Creation & Photo Upload Flow
  console.log('\n5. Testing Admin Chapter Creation & Image Upload...');
  const createPayload = {
    subjectId: 'physics',
    chapterNumber: 1,
    title: 'Kinematics & Motion'
  };
  const resCreateCh = await fetchUrl('/api/admin/school-work/chapter', 'POST', createPayload);
  assert(resCreateCh.status === 200, 'POST /api/admin/school-work/chapter returns 200 OK');
  const createdCh = JSON.parse(resCreateCh.data);
  assert(createdCh.success === true && createdCh.chapter.title === 'Kinematics & Motion', 'Chapter created successfully');

  const chapterId = createdCh.chapter.id;

  // Tiny 1x1 transparent PNG base64 for testing
  const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadPayload = {
    subjectId: 'physics',
    chapterId,
    photos: [
      { name: 'motion_notes_page1.png', base64: tinyPngBase64, title: 'Velocity & Acceleration Notes' }
    ]
  };
  const resUpload = await fetchUrl('/api/admin/school-work/upload', 'POST', uploadPayload);
  assert(resUpload.status === 200, 'POST /api/admin/school-work/upload returns 200 OK');
  const uploadData = JSON.parse(resUpload.data);
  assert(uploadData.success === true && uploadData.count === 1, 'Photo uploaded successfully');

  const uploadedPhoto = uploadData.photos[0];
  const diskPhotoPath = path.join(__dirname, 'public', uploadedPhoto.url.replace(/^\//, ''));
  assert(fs.existsSync(diskPhotoPath), 'Uploaded photo saved physically to disk: ' + uploadedPhoto.url);

  // Check chapter view has photo
  const resChView = await fetchUrl(`/api/school-work/chapter/physics/${chapterId}`);
  assert(resChView.status === 200, 'GET chapter details returns 200 OK');
  const chViewData = JSON.parse(resChView.data);
  assert(chViewData.chapter.photos.length === 1, 'Chapter contains 1 uploaded photo note');

  // Delete photo
  const resDelPhoto = await fetchUrl(`/api/admin/school-work/photo/physics/${chapterId}/${uploadedPhoto.id}`, 'DELETE');
  assert(resDelPhoto.status === 200, 'DELETE photo returns 200 OK');
  assert(!fs.existsSync(diskPhotoPath), 'Photo file deleted from disk');

  // Delete chapter
  const resDelChapter = await fetchUrl(`/api/admin/school-work/chapter/physics/${chapterId}`, 'DELETE');
  assert(resDelChapter.status === 200, 'DELETE chapter returns 200 OK');

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
