// main.js — WebSocket client + vòng lặp render chính của cảnh
'use strict';

(() => {
  window.CONFIG = {
    background: '', maxMonks: 20, bubbleSeconds: 5, walkSpeed: 1,
    panelMode: 'occasional', panelEveryMinutes: 3, panelShowSeconds: 30, showTotals: true,
    leaderboardTitle: 'BẢNG VÀNG DÂNG HƯƠNG', recentTitle: 'Người quen đã dâng lại'
  };

  const canvas = document.getElementById('scene');
  const stage = document.getElementById('stage');

  // scale 1080x1920 vừa cửa sổ (OBS browser source 1080x1920 -> scale 1)
  function fit() {
    const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  Scene.init(canvas);
  Monks.init(window.CONFIG.maxMonks);
  Panels.init(window.CONFIG);
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------- event -> scene
  function handleEvent(msg) {
    switch (msg.t) {
      case 'comment':
        Monks.spawnComment(msg.user, msg.text);
        Panels.record(msg.user, 0, false);
        break;
      case 'gift':
        Monks.spawnGift(msg.user, msg.count, (m) => {
          Effects.roseBurst(m.x, m.y, msg.count);
        });
        Panels.record(msg.user, msg.count, true);
        break;
      case 'like':
        Effects.lotusBurst(msg.count);
        break;
      case 'join':
        Effects.floatText('✨ ' + short(msg.user.nick) + ' đã gia nhập');
        break;
      case 'follow':
        Effects.floatText('💖 ' + short(msg.user.nick) + ' vừa theo dõi', true);
        break;
    }
  }

  function short(s) {
    s = String(s || '');
    return s.length > 16 ? s.slice(0, 15) + '…' : s;
  }

  // áp cấu hình từ server (hello / lưu cài đặt mới) — không reset cảnh đang chạy
  let currentBg;
  function applyConfig(cfg) {
    if (!cfg) return;
    window.CONFIG = { ...window.CONFIG, ...cfg };
    // đổi ảnh nền -> đổi layout bồ đoàn theo sàn của ảnh
    const bg = window.CONFIG.background || '';
    if (currentBg !== bg) {
      currentBg = bg;
      Scene.setBackground(bg, () => Monks.init(window.CONFIG.maxMonks));
    }
    Monks.setMaxMonks(window.CONFIG.maxMonks);
    Monks.setSpeed(window.CONFIG.walkSpeed);
    Panels.applyConfig(window.CONFIG);
  }

  // ---------------------------------------------------------- websocket
  let ws = null;
  let reconnectDelay = 1000;
  let lastMode = null;

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);

    ws.onopen = () => { reconnectDelay = 1000; };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'hello' || msg.t === 'config') {
        applyConfig(msg.config);
        return;
      }
      if (msg.t === 'status') {
        // chuyển LIVE <-> DEMO <-> idle: xóa data cũ để không trộn dữ liệu giả với thật
        const m = msg.mode || 'idle';
        if (m !== lastMode) {
          if (m === 'live' || m === 'demo') Panels.clear();
          lastMode = m;
        }
        const badge = document.getElementById('demo-badge');
        if (badge) badge.style.display = (m === 'demo') ? 'flex' : 'none';
        return;
      }
      handleEvent(msg);
    };

    ws.onclose = () => {
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.6, 8000);
    };
    ws.onerror = () => ws.close();
  }
  connect();

  // ---------------------------------------------------------- loop
  function tick(dt, now) {
    const steps = Math.max(1, Math.min(20, Math.ceil(dt / 0.05)));
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) {
      Monks.update(sub, now);
      Effects.update(sub, now);
    }
  }

  let last = performance.now();
  function loop(now) {
    // dt thực; khi tab bị throttle (fps rất thấp) vẫn giữ mô phỏng bám theo thời gian thực
    const raw = Math.min(1.0, Math.max(0, (now - last) / 1000));
    last = now;
    tick(raw, now);

    Scene.render(now);          // nền + hiệu ứng động của nền
    Effects.drawBack(ctx);      // khói hương
    Monks.draw(ctx, now);       // phật tử + bubble comment
    Effects.drawFront(ctx);     // hoa hồng, hoa sen, popup (trên cùng)

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // dự phòng: khi tab bị ẩn, rAF dừng hẳn — dùng setInterval để mô phỏng chạy tiếp
  setInterval(() => {
    const now = performance.now();
    const raw = Math.min(1.0, Math.max(0, (now - last) / 1000));
    if (raw > 0.1) { last = now; tick(raw, now); }
  }, 250);
})();
