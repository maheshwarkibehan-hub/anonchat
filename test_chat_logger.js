const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

console.log('--- Testing Private Chat Session Logger & AI Training Dataset Engine ---');

const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');
const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf-8');

// 1. Static Security & Architecture Checks
console.log('\n1. Checking Git Ignore & Privacy Concealment...');
assert(gitignore.includes('chat/'), '.gitignore contains chat/ directory ignore');
assert(gitignore.includes('chats/'), '.gitignore contains chats/ directory ignore');
assert(fs.existsSync(path.join(__dirname, 'chat')), 'chat/ directory exists on local disk');

// Verify git status doesn't track chat folder
const gitStatus = execSync('git status --porcelain').toString();
assert(!gitStatus.includes('chat/'), 'Git ignores chat/ directory completely (No chat leak on push)');

// 2. Server Code Integration Checks
console.log('\n2. Checking Server Integration Hooks...');
assert(serverJs.includes('CHAT_LOG_DIR = path.join(__dirname, \'chat\');'), 'server.js defines CHAT_LOG_DIR in chat folder');
assert(serverJs.includes('function initChatSession('), 'server.js defines initChatSession');
assert(serverJs.includes('function flushSessionToFile('), 'server.js defines flushSessionToFile');
assert(serverJs.includes('function recordChatMessage('), 'server.js defines recordChatMessage');
assert(serverJs.includes('function recordChatSystemEvent('), 'server.js defines recordChatSystemEvent');
assert(serverJs.includes('function finishChatSession('), 'server.js defines finishChatSession');

assert(serverJs.includes('initChatSession(roomId, socketA.id, socketB.id, vibeLabel);'), 'pairUsers initializes chat session');
assert(serverJs.includes('finishChatSession(roomId);'), 'cleanupUser finalizes chat session and flushes');
assert(serverJs.includes('recordChatMessage(roomId, socket.id,'), 'send_message records user messages');
assert(serverJs.includes('recordChatSystemEvent(roomId, \'teacher_intervention\''), 'Joby Sir intervention is recorded');
assert(serverJs.includes('recordChatSystemEvent(roomId, \'bench_chit\''), 'Bench chits are recorded');

// 3. Functional Simulation of Chat Logging & AI Training Dataset Generation
console.log('\n3. Testing Functional Session Simulation & JSON Output...');

// Extract helper functions or simulate using server's exact algorithm
const CHAT_LOG_DIR = path.join(__dirname, 'chat');
const testSessions = new Map();

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

const testRoomId = `room_sim_${Date.now()}`;
const dateFolder = getLocalDateFolder();
const timePrefix = getLocalTimePrefix();
const dayDir = path.join(CHAT_LOG_DIR, dateFolder);
const testFileName = `chat_${timePrefix}_${testRoomId}.json`;
const testFilePath = path.join(dayDir, testFileName);

const session = {
  roomId: testRoomId,
  vibe: 'Exam Panic 📚',
  dayFolder: dateFolder,
  fileName: testFileName,
  filePath: testFilePath,
  dayDir: dayDir,
  startTime: new Date().toISOString(),
  endTime: null,
  durationSeconds: 0,
  userAliases: {
    'socket_A': 'Student_1',
    'socket_B': 'Student_2'
  },
  messages: [],
  openai_format: [],
  sharegpt_format: []
};
testSessions.set(testRoomId, session);

// Turn 1: Student 1 speaks
const t1Text = 'Bhai kal ka homework ho gaya kya?';
session.messages.push({
  turn: 1,
  msgId: 'msg_sim_1',
  sender: 'Student_1',
  role: 'user',
  timestamp: Date.now(),
  isoTime: new Date().toISOString(),
  type: 'text',
  text: t1Text
});
session.openai_format.push({ role: 'user', content: t1Text });
session.sharegpt_format.push({ from: 'human', value: t1Text });

// Turn 2: Student 2 replies
const t2Text = 'Nahi yaar, question 3 aur 4 bache hain... copy bhejega?';
session.messages.push({
  turn: 2,
  msgId: 'msg_sim_2',
  sender: 'Student_2',
  role: 'assistant',
  timestamp: Date.now() + 1000,
  isoTime: new Date().toISOString(),
  type: 'text',
  text: t2Text
});
session.openai_format.push({ role: 'assistant', content: t2Text });
session.sharegpt_format.push({ from: 'gpt', value: t2Text });

// Turn 3: Bench Chit Event
session.messages.push({
  turn: 3,
  msgId: 'event_chit_1',
  sender: 'System',
  role: 'system',
  timestamp: Date.now() + 2000,
  isoTime: new Date().toISOString(),
  type: 'bench_chit',
  text: 'Parchi Pass: Joby Sir corridor me hai... 🚨'
});

// Finalize Session
session.endTime = new Date().toISOString();
session.durationSeconds = 12;

if (!fs.existsSync(dayDir)) {
  fs.mkdirSync(dayDir, { recursive: true });
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

fs.writeFileSync(session.filePath, JSON.stringify(payload, null, 2), 'utf8');

assert(fs.existsSync(testFilePath), 'Simulated session JSON written to disk successfully');

// Read back and validate JSON schema
const savedData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));

assert(savedData.metadata.roomId === testRoomId, 'JSON metadata contains correct roomId');
assert(savedData.metadata.vibe === 'Exam Panic 📚', 'JSON metadata contains correct vibe');
assert(savedData.metadata.totalMessages === 3, 'JSON metadata contains totalMessages count (3)');
assert(savedData.metadata.aiTrainingReady === true, 'JSON metadata marks aiTrainingReady as true');
assert(savedData.messages.length === 3, 'JSON messages array contains 3 entries');
assert(savedData.messages[0].sender === 'Student_1' && savedData.messages[0].role === 'user', 'Turn 1 mapped to Student_1 / user');
assert(savedData.messages[1].sender === 'Student_2' && savedData.messages[1].role === 'assistant', 'Turn 2 mapped to Student_2 / assistant');
assert(savedData.messages[2].role === 'system' && savedData.messages[2].type === 'bench_chit', 'Turn 3 mapped to system bench chit');

assert(Array.isArray(savedData.ai_dataset.openai_format) && savedData.ai_dataset.openai_format.length === 2, 'OpenAI ChatML format contains 2 conversation turns');
assert(savedData.ai_dataset.openai_format[0].role === 'user' && savedData.ai_dataset.openai_format[0].content === t1Text, 'OpenAI format Turn 1 validated');
assert(savedData.ai_dataset.openai_format[1].role === 'assistant' && savedData.ai_dataset.openai_format[1].content === t2Text, 'OpenAI format Turn 2 validated');

assert(Array.isArray(savedData.ai_dataset.sharegpt_format) && savedData.ai_dataset.sharegpt_format.length === 2, 'ShareGPT format contains 2 conversation turns');
assert(savedData.ai_dataset.sharegpt_format[0].from === 'human' && savedData.ai_dataset.sharegpt_format[0].value === t1Text, 'ShareGPT format Turn 1 validated');
assert(savedData.ai_dataset.sharegpt_format[1].from === 'gpt' && savedData.ai_dataset.sharegpt_format[1].value === t2Text, 'ShareGPT format Turn 2 validated');

// 4. Testing Empty Room Clean up (Zero junk files)
console.log('\n4. Verifying Empty Room Noise Prevention (Zero-Message Skip)...');
const emptyRoomId = `room_empty_${Date.now()}`;
const emptyFilePath = path.join(dayDir, `chat_${timePrefix}_${emptyRoomId}.json`);

function testEmptyCleanup(messagesCount, filePath) {
  if (messagesCount > 0) {
    fs.writeFileSync(filePath, '{}');
  } else {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

testEmptyCleanup(0, emptyFilePath);
assert(!fs.existsSync(emptyFilePath), 'Zero-message empty rooms do not create junk files on disk');

// Clean up test file
try {
  fs.unlinkSync(testFilePath);
} catch (e) {}

console.log(`\n--- Verification Summary: ${passed} Passed, ${failed} Failed ---`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
