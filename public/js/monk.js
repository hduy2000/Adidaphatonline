// monk.js — Phật tử chibi (vẽ canvas): đi từ đáy sảnh ra bồ đoàn, ngồi khấn vái,
// dâng hương/hoa rồi hiện bubble comment, tan biến
'use strict';

const Monks = (() => {
  const { W, LAYOUT } = Scene;

  let maxMonks = 20;
  let monks = [];             // phật tử đang hoạt động
  let pending = [];           // hàng đợi chờ bồ đoàn trống
  let slots = [];             // các bồ đoàn trước đàn hương
  let speedMul = 1;           // hệ số tốc độ đi (từ cài đặt)

  const ROBES = [
    ['#e8a63c', '#a05f14'],   // áo vàng
    ['#e8a63c', '#a05f14'],
    ['#f2ead8', '#b3a482'],   // áo trắng
    ['#cfc4b0', '#8d8168'],   // áo xám
    ['#d9772f', '#8f4715']    // áo cam đất
  ];

  // ---------------------------------------------------------- sprite phật tử (ảnh trong /image/)
  // có đủ walk.png + sit.png thì dùng ảnh, thiếu thì tự quay về vẽ code
  const Sprites = { imgs: {}, ready: false };
  (function loadSprites() {
    const names = ['walk', 'walk-2', 'sit', 'sit-gift'];
    let pending = names.length;
    for (const n of names) {
      const img = new Image();
      img.onload = img.onerror = () => {
        if (img.naturalWidth) Sprites.imgs[n] = img;
        if (--pending === 0) Sprites.ready = true;
      };
      img.src = '/image/' + n + '.png';
    }
  })();
  const hasSprite = (n) => Sprites.ready && Sprites.imgs[n];
  const spriteMode = () => hasSprite('walk') && hasSprite('sit');

  // biến tông màu nhẹ để các phật tử không lặp y hệt
  const HUE_FILTERS = ['none', 'none', 'none', 'hue-rotate(-18deg)', 'hue-rotate(14deg)', 'brightness(1.07)'];

  // ---------------------------------------------------------- bồ đoàn
  function init(max) {
    maxMonks = max || 20;
    slots = Scene.LAYOUT.slots.map(p => ({ x: p.x, y: p.y, taken: null }));
    monks = [];
    pending = [];
  }

  function takeSlot(owner) {
    const free = slots.filter(s => !s.taken);
    if (!free.length) return null;
    // ưu tiên hàng gần đàn hương
    free.sort((a, b) => (a.y + (a.x > W / 2 ? 40 : 0)) - (b.y + (b.x > W / 2 ? 40 : 0)));
    const pick = free[Math.floor(Math.random() * Math.min(free.length, 6))];
    pick.taken = owner;
    return pick;
  }

  // ---------------------------------------------------------- tạo phật tử
  // kind: 'incense' | 'gift'
  function spawn(user, text, kind, count, onArrive) {
    // hàng đợi quá dài thì bỏ event cũ (tránh trễ khi live spam)
    if (pending.length > 30) pending.shift();
    const entry = {
      user, text: String(text || ''), kind, count: count || 1, onArrive,
      robe: ROBES[Math.floor(Math.random() * ROBES.length)],
      hat: Math.random() < 0.62,
      filter: HUE_FILTERS[Math.floor(Math.random() * HUE_FILTERS.length)],
      phase: Math.random() * Math.PI * 2,
      state: 'walk',          // walk -> sit (ngồi xuống bồ đoàn) -> offer (khấn vái) -> fade
      alpha: 1,
      t: 0,
      // spawn dưới đáy màn hình
      x: 200 + Math.random() * (W - 400),
      y: LAYOUT.spawnY,
      slot: null,
      bubbleTime: 0,
      // thời gian hiện bubble lấy từ cài đặt
      bubbleDur: Math.max(2, Number(window.CONFIG && window.CONFIG.bubbleSeconds) || 5)
    };
    if (monks.length >= maxMonks || !(entry.slot = takeSlot(entry))) {
      pending.push(entry);
      return;
    }
    monks.push(entry);
  }

  function spawnComment(user, text) { spawn(user, text, 'incense', 1); }

  function spawnGift(user, count, onArrive) {
    spawn(user, '', 'gift', count, onArrive);
  }

  function release(entry) {
    if (entry.slot) entry.slot.taken = null;
    const i = monks.indexOf(entry);
    if (i >= 0) monks.splice(i, 1);
    // cho hàng đợi vào chỗ vừa trống
    while (pending.length && monks.length < maxMonks) {
      const next = pending.shift();
      next.slot = takeSlot(next);
      if (!next.slot) { pending.unshift(next); break; }
      monks.push(next);
    }
  }

  // ---------------------------------------------------------- update
  function walkTowards(m, tx, ty, dt, time) {
    const dx = tx - m.x, dy = ty - m.y;
    const dist = Math.hypot(dx, dy);
    const scale = perspectiveScale(m.y);
    const speed = 185 * speedMul * scale;
    if (dist < speed * dt) {
      m.x = tx; m.y = ty;
      return true;             // đã tới bồ đoàn
    }
    m.x += (dx / dist) * speed * dt + Math.sin(time * 0.004 + m.phase) * 0.35;
    m.y += (dy / dist) * speed * dt;
    return false;
  }

  function update(dt, time) {
    for (const m of [...monks]) {
      m.t += dt;

      if (m.state === 'walk') {
        if (walkTowards(m, m.slot.x, m.slot.y, dt, time)) {
          m.state = 'sit';
          m.t = 0;
        }
      } else if (m.state === 'sit') {
        if (m.t > 0.6) {
          m.state = 'offer';
          m.t = 0;
          if (m.onArrive) { try { m.onArrive(m); } catch { /* ignore */ } }
        }
      } else if (m.state === 'offer') {
        m.bubbleTime += dt;
        // khói từ nén hương trên tay
        if (m.kind === 'incense' && Math.random() < dt * 6) {
          const tip = incenseTip(m);
          Effects.addSmoke(tip.x, tip.y, 0.8);
        }
        if (m.bubbleTime > m.bubbleDur) { m.state = 'fade'; m.t = 0; }
      } else if (m.state === 'fade') {
        m.alpha = Math.max(0, 1 - m.t / 0.8);
        if (m.t > 0.8) release(m);
      }
    }
  }

  function perspectiveScale(y) {
    return 0.82 + 0.3 * Math.min(1, Math.max(0, (y - 1000) / 920));
  }

  function incenseTip(m) {
    const s = perspectiveScale(m.y);
    // sprite: chóp nén hương trên tay (trên-phải của ảnh ngồi)
    if (spriteMode()) return { x: m.x + 24 * s, y: m.y - 92 * s };
    return { x: m.x + 12 * s, y: m.y - 108 * s };
  }

  // ---------------------------------------------------------- vẽ
  function draw(c, time) {
    // vẽ theo thứ tự y (xa trước, gần sau)
    monks.sort((a, b) => a.y - b.y);
    for (const m of monks) {
      if (m.state === 'walk') drawWalking(c, m, time);
      else drawSeated(c, m, time);
    }
    for (const m of monks) drawBubble(c, m);
  }

  // đang đi ra bồ đoàn
  function drawWalking(c, m, time) {
    const s = perspectiveScale(m.y);
    const bob = Math.abs(Math.sin(time * 0.012 + m.phase)) * 6;
    const armSwing = Math.sin(time * 0.012 + m.phase) * 7;

    c.save();
    c.translate(m.x, m.y - bob);
    c.scale(s, s);

    // bóng đổ
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(0, 8, 40, 11, 0, 0, Math.PI * 2);
    c.fill();

    // ---- dùng ảnh sprite nếu có ----
    if (spriteMode()) {
      const two = hasSprite('walk-2') && Math.floor(time / 240 + m.phase) % 2 === 1;
      const img = two ? Sprites.imgs['walk-2'] : Sprites.imgs.walk;
      const h = 152;
      const w = h * (img.width / img.height);
      c.save();
      if (m.filter && m.filter !== 'none') c.filter = m.filter;
      c.drawImage(img, -w / 2, -h + 4, w, h);
      c.restore();
      c.restore();
      return;
    }

    drawHalo(c, m);

    // thân áo (dáng chuông)
    const robe = robeGradient(c, m);
    c.fillStyle = robe;
    c.beginPath();
    c.moveTo(-30, -118);
    c.quadraticCurveTo(-44, -50, -40, 6);
    c.quadraticCurveTo(0, 14, 40, 6);
    c.quadraticCurveTo(44, -50, 30, -118);
    c.closePath();
    c.fill();
    // gấu áo vàng
    c.fillStyle = 'rgba(255,215,120,0.9)';
    c.beginPath();
    c.moveTo(-40, 0);
    c.quadraticCurveTo(0, 12, 40, 0);
    c.lineTo(40, 6);
    c.quadraticCurveTo(0, 20, -40, 6);
    c.closePath();
    c.fill();
    // dây đan ngang
    c.strokeStyle = 'rgba(120,70,20,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-36, -46);
    c.quadraticCurveTo(0, -38, 36, -46);
    c.stroke();

    // tay vung khi đi
    c.strokeStyle = m.kind === 'gift' ? '#9c4a6e' : m.robe[1];
    c.lineWidth = 11;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-28, -70);
    c.lineTo(-38, -46 + armSwing);
    c.stroke();
    c.beginPath();
    c.moveTo(28, -70);
    c.lineTo(38, -46 - armSwing);
    c.stroke();

    drawHead(c, m, 0, -118, 0);
    c.restore();
  }

  // ngồi khấn vái trên bồ đoàn
  function drawSeated(c, m, time) {
    const s = perspectiveScale(m.y);
    // cúi lạy theo chu kỳ khi đang khấn
    let lean = 0;
    if (m.state === 'offer') {
      const bowT = (Math.sin(time * 0.0021 + m.phase) + 1) / 2;
      lean = 0.05 + bowT * 0.28;
    } else if (m.state === 'sit') {
      lean = 0.1 * Math.min(1, m.t / 0.5);
    }

    c.save();
    c.translate(m.x, m.y);
    c.scale(s, s);
    c.globalAlpha = m.alpha;

    // ---- dùng ảnh sprite nếu có ----
    if (spriteMode()) {
      const giftImg = m.kind === 'gift' && hasSprite('sit-gift');
      const img = giftImg ? Sprites.imgs['sit-gift'] : Sprites.imgs.sit;
      const h = giftImg ? 128 : 124;
      const w = h * (img.width / img.height);
      // khấn vái: lắc người nhẹ quanh hông
      const sway = m.state === 'offer' ? Math.sin(time * 0.0021 + m.phase) * 0.05 : 0;
      c.rotate(sway);
      c.save();
      if (m.filter && m.filter !== 'none' && !giftImg) c.filter = m.filter;
      c.drawImage(img, -w / 2, -h + 6, w, h);
      c.restore();
      c.restore();
      return;
    }

    drawHalo(c, m);

    // vạt áo trải rộng trên bồ đoàn
    const robe = robeGradient(c, m);
    c.fillStyle = robe;
    c.beginPath();
    c.ellipse(0, -6, 52, 21, 0, 0, Math.PI * 2);
    c.fill();
    // viền gấu áo
    c.strokeStyle = 'rgba(255,215,120,0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, -3, 46, 17, 0, Math.PI * 0.12, Math.PI * 0.88);
    c.stroke();

    // thân trên + đầu: xoay quanh hông khi vái lạy
    c.save();
    c.translate(0, -8);
    c.rotate(lean);

    // thân
    c.fillStyle = robe;
    c.beginPath();
    c.moveTo(-25, 0);
    c.quadraticCurveTo(-31, -52, -20, -80);
    c.quadraticCurveTo(0, -89, 20, -80);
    c.quadraticCurveTo(31, -52, 25, 0);
    c.closePath();
    c.fill();
    // đường khuy áo giữa
    c.strokeStyle = 'rgba(120,70,20,0.4)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(0, -70);
    c.lineTo(0, -8);
    c.stroke();

    // hai tay chắp trước ngực
    c.strokeStyle = m.kind === 'gift' ? '#9c4a6e' : m.robe[1];
    c.lineWidth = 7.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-17, -54);
    c.lineTo(7, -48);
    c.stroke();
    c.beginPath();
    c.moveTo(17, -54);
    c.lineTo(7, -48);
    c.stroke();

    // vật cầm: nén hương / bó hoa hồng
    if (m.kind === 'incense') {
      c.strokeStyle = '#6b4218';
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(7, -48);
      c.lineTo(14, -104);
      c.stroke();
      // đầu nhang đỏ lửa
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,120,40,0.9)';
      c.beginPath();
      c.arc(14, -106, 3.5, 0, Math.PI * 2);
      c.fill();
      c.restore();
    } else {
      // bó hoa hồng
      for (const [dx, dy] of [[-2, -68], [15, -74], [6, -56]]) {
        c.strokeStyle = '#3e7a2e';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(7, -50);
        c.lineTo(dx, dy + 7);
        c.stroke();
        c.fillStyle = '#d92b45';
        c.beginPath();
        c.arc(dx, dy, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,150,160,0.8)';
        c.beginPath();
        c.arc(dx - 2, dy - 2, 3.5, 0, Math.PI * 2);
        c.fill();
      }
    }

    drawHead(c, m, 0, -102, lean * 0.6, 21);
    c.restore(); // lean
    c.restore();
  }

  // ---------------------------------------------------------- bộ phận chung
  function robeGradient(c, m) {
    const g = c.createLinearGradient(-34, -110, 34, 0);
    g.addColorStop(0, m.kind === 'gift' ? '#f7c1d4' : m.robe[0]);
    g.addColorStop(1, m.kind === 'gift' ? '#b3557e' : m.robe[1]);
    return g;
  }

  function drawHalo(c, m) {
    if (m.kind !== 'gift') return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const halo = c.createRadialGradient(0, -70, 10, 0, -70, 90);
    halo.addColorStop(0, 'rgba(255,190,90,0.5)');
    halo.addColorStop(1, 'rgba(255,190,90,0)');
    c.fillStyle = halo;
    c.fillRect(-90, -160, 180, 180);
    c.restore();
  }

  // headY = tâm đầu; tiltX = nghiêng đầu theo lạy; r = bán kính đầu
  function drawHead(c, m, x, headY, tiltX, r = 24) {
    c.save();
    c.translate(x, headY);
    c.rotate(tiltX);

    // mặt
    c.fillStyle = '#ffd9a8';
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();

    // mắt + miệng
    c.fillStyle = '#5a3312';
    c.beginPath();
    c.arc(-r * 0.33, -2, 2.6, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(r * 0.33, -2, 2.6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#a35c22';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, r * 0.33, 6, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();

    // nón / đầu trần
    if (m.hat) {
      c.fillStyle = m.kind === 'gift' ? '#f2a0bd' : '#d8b25f';
      c.beginPath();
      c.moveTo(-r * 1.25, -r * 0.5);
      c.quadraticCurveTo(0, -r * 2.75, r * 1.25, -r * 0.5);
      c.quadraticCurveTo(0, -r, -r * 1.25, -r * 0.5);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(120,80,20,0.5)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(0, -r * 2.4);
      c.lineTo(0, -r * 0.75);
      c.stroke();
    } else {
      c.fillStyle = 'rgba(90,55,20,0.85)';
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.arc(-r * 0.58 + i * r * 0.29, -r * 0.7 + (i % 2) * 4, 3.4, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  // ---------------------------------------------------------- bubble comment
  function wrapText(c, text, maxWidth, maxLines) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
        if (lines.length === maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines) {
      // cắt phần thừa
      let consumed = lines.join(' ').length;
      if (consumed < text.length) lines[maxLines - 1] += '…';
    }
    return lines;
  }

  function drawBubble(c, m) {
    if (m.state !== 'offer' || !m.text) return;
    const s = perspectiveScale(m.y);
    const nick = m.user.nick || m.user.id || 'Khách';
    const shownNick = nick.length > 16 ? nick.slice(0, 15) + '…' : nick;

    c.save();
    c.globalAlpha = m.alpha;
    c.font = '600 27px "Segoe UI", system-ui, sans-serif';
    const nickW = c.measureText(shownNick + ': ').width;
    c.font = '27px "Segoe UI", system-ui, sans-serif';
    const maxText = 430;
    const bodyLines = wrapText(c, m.text, maxText - nickW > 120 ? maxText - nickW : 300, 3);

    const padX = 22, padY = 16, lineH = 36;
    const boxW = Math.min(maxText, Math.max(160, nickW + Math.max(...bodyLines.map(l => c.measureText(l).width))) + padX * 2);
    const boxH = padY * 2 + lineH * (1 + bodyLines.length);
    // đuôi bong bóng phía trên đầu phật tử đang ngồi
    const tailY = m.y - (spriteMode() ? 140 : 150) * s;
    let bx = m.x - boxW / 2;
    const by = Math.max(60, tailY - 14 - boxH);
    bx = Math.max(14, Math.min(W - boxW - 14, bx));

    // đuôi bubble
    c.fillStyle = 'rgba(25,12,8,0.82)';
    c.beginPath();
    c.moveTo(m.x - 12, by + boxH);
    c.lineTo(m.x + 12, by + boxH);
    c.lineTo(m.x, by + boxH + 16);
    c.closePath();
    c.fill();

    // thân bubble
    roundRect(c, bx, by, boxW, boxH, 16);
    c.fillStyle = 'rgba(25,12,8,0.82)';
    c.fill();
    c.strokeStyle = '#f5c96b';
    c.lineWidth = 3;
    c.stroke();

    // dòng tên (vàng) + nội dung (trắng)
    c.textBaseline = 'top';
    c.font = '600 27px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = '#ffd24a';
    c.fillText(shownNick + ':', bx + padX, by + padY);
    c.font = '27px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = '#fff8ee';
    if (bodyLines.length) {
      c.fillText(bodyLines[0], bx + padX + nickW, by + padY);
    }
    for (let i = 1; i < bodyLines.length; i++) {
      c.fillText(bodyLines[i], bx + padX, by + padY + lineH * i);
    }
    c.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---------------------------------------------------------- api
  // đổi giới hạn WITHOUT reset cảnh đang chạy
  function setMaxMonks(n) {
    maxMonks = Math.max(1, Math.min(slots.length || 20, Math.round(Number(n) || 20)));
  }
  function setSpeed(mul) {
    speedMul = Math.max(0.3, Math.min(3, Number(mul) || 1));
  }

  return { init, spawnComment, spawnGift, update, draw, setMaxMonks, setSpeed,
    __debug: () => ({
      monks: monks.map(m => ({ x: Math.round(m.x), y: Math.round(m.y), state: m.state })),
      pending: pending.length,
      slotsFree: slots.filter(s => !s.taken).length,
      maxMonks
    }) };
})();
