// server.js — HTTP static + API cấu hình + WebSocket + kết nối TikTok Live + chế độ Demo
// Chạy: node server.js [--demo] [--user @username] [--port 3000]

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ---------------------------------------------------------------- config
const DEFAULT_CONFIG = {
  port: 3000,
  username: '',                 // @username mặc định của người đang live
  sessionid: '',                // (dự phòng) cookie sessionid khi đăng nhập tiktok.com
  background: '',               // tên file ảnh nền trong public/image/ — rỗng = cảnh vẽ code
  maxMonks: 20,                 // số bồ đoàn/phật tử tối đa trên màn hình
  bubbleSeconds: 5,             // thời gian hiện bubble bình luận (giây)
  walkSpeed: 1,                 // tốc độ đi của phật tử (x1)
  panelMode: 'occasional',      // always (luôn hiện) | occasional (thỉnh thoảng) | hidden (ẩn hẳn)
  panelEveryMinutes: 3,         // [occasional] mỗi N phút hiện bảng 1 lần
  panelShowSeconds: 30,         // [occasional] giữ bảng bao lâu mỗi lần hiện
  showTotals: true,             // hiện tổng hoa/phật tử
  leaderboardTitle: 'BẢNG VÀNG DÂNG HƯƠNG',
  recentTitle: 'Người quen đã dâng lại',
  demoSpeed: 1,                 // tốc độ demo (x1)
  demoGift: true,               // demo có gift
  demoLike: true,               // demo có like
  demoJoin: true                // demo có vào phòng/theo dõi
};

function clampNum(v, min, max, def) {
  v = Number(v);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
const config = loadConfig();

function saveConfigToDisk() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
  } catch (e) {
    console.error('[config] Không ghi được config.json:', e.message);
  }
}

// config trả ra client — ẩn sessionid
function publicConfig() {
  return { ...config, sessionid: config.sessionid ? '********' : '' };
}

// cập nhật config từ form cài đặt + lưu + phát tới mọi client
function applyConfigPatch(p) {
  if (p.username !== undefined) config.username = String(p.username).trim().replace(/^@/, '').slice(0, 60);
  if (p.sessionid !== undefined) {
    const s = String(p.sessionid).trim();
    if (s !== '********') config.sessionid = s.slice(0, 200);
  }
  if (p.background !== undefined) {
    // chỉ nhận tên file nằm trong public/image/
    const name = String(p.background).trim().slice(0, 200);
    config.background = (name && !name.includes('/') && !name.includes('\\') && !name.includes('..')
      && fs.existsSync(path.join(PUBLIC_DIR, 'image', name))) ? name : '';
  }
  if (p.maxMonks !== undefined) config.maxMonks = Math.round(clampNum(p.maxMonks, 1, 20, 20));
  if (p.bubbleSeconds !== undefined) config.bubbleSeconds = clampNum(p.bubbleSeconds, 2, 15, 5);
  if (p.walkSpeed !== undefined) config.walkSpeed = clampNum(p.walkSpeed, 0.3, 3, 1);
  if (p.panelMode !== undefined) config.panelMode = ['always', 'occasional', 'hidden'].includes(p.panelMode) ? p.panelMode : 'occasional';
  if (p.panelEveryMinutes !== undefined) config.panelEveryMinutes = Math.round(clampNum(p.panelEveryMinutes, 1, 30, 3));
  if (p.panelShowSeconds !== undefined) config.panelShowSeconds = Math.round(clampNum(p.panelShowSeconds, 5, 120, 30));
  for (const k of ['showTotals', 'demoGift', 'demoLike', 'demoJoin']) {
    if (p[k] !== undefined) config[k] = Boolean(p[k]);
  }
  if (p.leaderboardTitle !== undefined) config.leaderboardTitle = (String(p.leaderboardTitle).trim() || DEFAULT_CONFIG.leaderboardTitle).slice(0, 60);
  if (p.recentTitle !== undefined) config.recentTitle = (String(p.recentTitle).trim() || DEFAULT_CONFIG.recentTitle).slice(0, 60);
  if (p.demoSpeed !== undefined) config.demoSpeed = clampNum(p.demoSpeed, 0.3, 3, 1);

  saveConfigToDisk();
  broadcast({ t: 'config', config: publicConfig() });
  if (mode === 'demo') startDemo();   // áp dụng tốc độ/bật-tắt demo ngay
  console.log('[config] Đã lưu cài đặt mới.');
}

// CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(name);
if (getArg('--port')) config.port = Number(getArg('--port'));
if (getArg('--user')) config.username = getArg('--user');

// ---------------------------------------------------------------- state
let mode = 'idle';            // idle | live | demo
let currentUsername = '';
let connection = null;        // TikTokLiveConnection
let demoTimers = [];
let lastViewers = 0;

// ---------------------------------------------------------------- http
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // ---- API cấu hình ----
  if (urlPath === '/api/config') {
    if (req.method === 'GET') { sendJson(res, 200, publicConfig()); return; }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 100000) req.destroy(); });
      req.on('end', () => {
        try {
          applyConfigPatch(JSON.parse(body || '{}'));
          sendJson(res, 200, { ok: true, config: publicConfig() });
        } catch (e) {
          sendJson(res, 400, { ok: false, error: e.message });
        }
      });
      return;
    }
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  // ---- danh sách ảnh nền có trong public/image/ ----
  if (urlPath === '/api/backgrounds' && req.method === 'GET') {
    try {
      const dir = path.join(PUBLIC_DIR, 'image');
      const files = fs.readdirSync(dir)
        .filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f))
        .map(f => ({ file: f, url: '/image/' + encodeURIComponent(f) }));
      sendJson(res, 200, files);
    } catch {
      sendJson(res, 200, []);
    }
    return;
  }

  // ---- file tĩnh ----
  let file = urlPath === '/' ? '/index.html'
    : urlPath === '/control' ? '/control.html'
    : urlPath;

  const filePath = path.join(PUBLIC_DIR, path.normalize(file).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- websocket
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

let statusHeartbeat = null;
function sendStatus(msg) {
  broadcast({
    t: 'status',
    mode,
    username: currentUsername,
    viewers: lastViewers,
    msg: msg || ''
  });
}

function ensureHeartbeat() {
  if (!statusHeartbeat) {
    statusHeartbeat = setInterval(() => { if (mode !== 'idle') sendStatus(); }, 5000);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ t: 'hello', config: publicConfig() }));
  sendStatus();

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    try {
      if (msg.cmd === 'start' && msg.username) {
        await startLive(String(msg.username));
      } else if (msg.cmd === 'demo') {
        startDemo();
      } else if (msg.cmd === 'stop') {
        stopAll();
      } else if (msg.cmd === 'status') {
        sendStatus();
      }
    } catch (err) {
      console.error('[ws cmd]', err.message);
      sendStatus('Lỗi: ' + err.message);
    }
  });
});

// ---------------------------------------------------------------- chuẩn hoá user
function userOut(u) {
  if (!u) return null;
  return {
    uid: u.userId || u.uniqueId || '',
    id: u.uniqueId || '',
    nick: u.nickname || u.uniqueId || 'Khách',
    pic: u.profilePicture?.urlList?.[0] || u.profilePictureUrl || ''
  };
}

// ---------------------------------------------------------------- TikTok Live
async function startLive(username) {
  stopAll(false);

  let uniqueId = String(username || config.username || '').trim().replace(/^@/, '');
  if (!uniqueId) throw new Error('Chưa nhập username TikTok');

  const options = { enableExtendedGiftInfo: true };
  if (config.sessionid) options.auth = { sessionid: config.sessionid };

  connection = new TikTokLiveConnection(uniqueId, options);
  currentUsername = uniqueId;
  mode = 'live';

  connection.on(WebcastEvent.CHAT, (msg) => {
    const user = userOut(msg.user);
    if (user && msg.comment) broadcast({ t: 'comment', user, text: String(msg.comment) });
  });

  connection.on(WebcastEvent.GIFT, (msg) => {
    const user = userOut(msg.user);
    if (!user) return;
    // gift streak (giftType=1): chỉ tính khi kết thúc chuỗi tặng
    const streaking = msg.giftType === 1 && !msg.repeatEnd;
    if (streaking) return;
    const name = msg.giftName || msg.extendedGiftInfo?.name || `Gift #${msg.giftId}`;
    const count = Math.max(1, msg.repeatCount || 1);
    const diamonds = msg.diamondCount ?? msg.extendedGiftInfo?.diamond_count ?? 0;
    broadcast({ t: 'gift', user, name, count, diamonds });
  });

  connection.on(WebcastEvent.LIKE, (msg) => {
    const user = userOut(msg.user);
    const count = Math.min(Math.max(1, msg.likeCount || 1), 30);
    if (user) broadcast({ t: 'like', user, count });
  });

  connection.on(WebcastEvent.MEMBER, (msg) => {
    const user = userOut(msg.user);
    if (user) broadcast({ t: 'join', user });
  });

  connection.on(WebcastEvent.FOLLOW, (msg) => {
    const user = userOut(msg.user);
    if (user) broadcast({ t: 'follow', user });
  });

  connection.on(WebcastEvent.ROOM_USER, (msg) => {
    if (typeof msg.total === 'number') lastViewers = msg.total;
  });

  connection.on(WebcastEvent.STREAM_END, () => {
    sendStatus('Livestream đã kết thúc.');
    stopAll();
  });

  connection.on('disconnected', () => {
    if (mode === 'live') {
      sendStatus('Mất kết nối với TikTok.');
      stopAll();
    }
  });

  try {
    console.log(`[tiktok] Đang kết nối tới @${uniqueId} ...`);
    await connection.connect();
    console.log(`[tiktok] Đã kết nối tới @${uniqueId}`);
    sendStatus(`Đã kết nối tới @${uniqueId}`);
    ensureHeartbeat();
  } catch (err) {
    connection = null;
    mode = 'idle';
    currentUsername = '';
    console.error('[tiktok] Lỗi kết nối:', err.message);
    sendStatus('Không kết nối được livestream: ' + err.message);
    throw err;
  }
}

// ---------------------------------------------------------------- Demo
const DEMO_USERS = [
  'Hương Giang', 'Minh Tuấn', 'hoa_sen_98', 'Thanh Bình', 'Buddha Fan',
  'cô_giáo_hoa', 'Đại Đạo', 'trần văn an', 'Quách1', 'Sóng Sông',
  'ccce.nguy', 'dâu hemue', 'Mận Đường', 'thuy trang', 'VaniSuri',
  'ngọc diên', 'bông gạo mù', 'Thuyền020', 'nam mô a di đà', 'Kiều Anh',
  'Lê Hoàng', 'trúcgiadinh', 'da di da phat', 'tuấn kiệt', 'Ánh Sao Đêm'
].map((nick, i) => ({ uid: 'demo' + i, id: 'demo' + i, nick, pic: '' }));

const DEMO_COMMENTS = [
  'nam mô a di đà phật', 'xin chào mn', 'đã dâng hương ạ', 'cầu an lành cho cả nhà',
  'nam mô bản sư tôn đà di đà phật', 'phật phù hộ cho gia đình mình',
  'chúc mọi người buổi tối an lành', 'nam mô quan âm bồ tát', 'cả nhà cho xin 10 điểm lạt',
  'nam mô a di đà phật 🙏🙏🙏', 'đã dưng hương', 'con lạy phật trời',
  'cầu bình an cho mẹ con nhà em', 'mải miết đi chùa', 'chùa đẹp quá!',
  'hôm nay đi chùa thật không?', 'quê em có chùa đẹp lắm', 'nam mo adi da phat',
  'chúc phiên live luôn vui', 'xin phật phù hộ cho con thi đậu', 'đã dâng nén tâm hương',
  'cầu sức khỏe cho ba mẹ', 'cảm ơn livestream ý nghĩa', 'đi chùa đầu năm', 'nam mô a di đà phật 🌸'
];

function demoUser() {
  const u = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
  return { ...u };
}

function startDemo() {
  stopAll(false);
  mode = 'demo';
  currentUsername = 'demo';
  console.log('[demo] Bật chế độ demo');

  const speed = clampNum(config.demoSpeed, 0.3, 3, 1);
  const iv = (minMs, maxMs) => (minMs / speed) + Math.random() * ((maxMs - minMs) / speed);

  const loop = (fn, minMs, maxMs) => {
    const tick = () => {
      fn();
      const t = setTimeout(tick, iv(minMs, maxMs));
      demoTimers.push(t);
    };
    const t = setTimeout(tick, 600);
    demoTimers.push(t);
  };

  loop(() => {
    broadcast({
      t: 'comment',
      user: demoUser(),
      text: DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)]
    });
  }, 1200, 2600);

  if (config.demoGift !== false) {
    loop(() => {
      const count = [1, 1, 1, 2, 3, 5, 10, 99][Math.floor(Math.random() * 8)];
      broadcast({ t: 'gift', user: demoUser(), name: 'Rose', count, diamonds: count });
    }, 7000, 13000);
  }

  if (config.demoLike !== false) {
    loop(() => {
      broadcast({ t: 'like', user: demoUser(), count: 5 + Math.floor(Math.random() * 25) });
    }, 4000, 8000);
  }

  if (config.demoJoin !== false) {
    loop(() => broadcast({ t: 'join', user: demoUser() }), 9000, 16000);
    loop(() => broadcast({ t: 'follow', user: demoUser() }), 15000, 25000);
  }

  lastViewers = 900 + Math.floor(Math.random() * 400);
  sendStatus('Đang chạy chế độ DEMO — comment giả lập.');
  ensureHeartbeat();
}

// ---------------------------------------------------------------- stop
function stopAll(announce = true) {
  for (const t of demoTimers) clearTimeout(t);
  demoTimers = [];

  if (connection) {
    try { connection.disconnect(); } catch { /* ignore */ }
    connection = null;
  }
  mode = 'idle';
  currentUsername = '';
  lastViewers = 0;
  if (announce) {
    console.log('[server] Đã dừng kết nối.');
    sendStatus('Đã dừng.');
  }
}

process.on('SIGINT', () => {
  stopAll(false);
  process.exit(0);
});

// ---------------------------------------------------------------- boot
server.listen(config.port, () => {
  console.log('==============================================================');
  console.log('  Phật Tử Dâng Hương — TikTok Live Realtime');
  console.log(`  Cảnh (dán vào OBS):  http://localhost:${config.port}/`);
  console.log(`  Điều khiển + cài đặt: http://localhost:${config.port}/control`);
  console.log(`  Demo nhanh:           node server.js --demo`);
  console.log('==============================================================');
  if (hasFlag('--demo')) startDemo();
  else if (config.username) startLive(config.username).catch(() => {});
});
