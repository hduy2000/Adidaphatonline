// effects.js — khói hương, burst hoa hồng, popup 🌹xN, hoa sen khi like, dòng chữ bay
'use strict';

const Effects = (() => {
  const { W, H, LAYOUT } = Scene;

  let smoke = [];       // khói hương
  let roses = [];       // hoa hồng bay
  let lotus = [];       // cánh hoa sen (like)
  let popups = [];      // chữ bay (🌹 xN, ✨ join, 💖 follow)
  let sparkles = [];    // lấp lánh

  // ---------------------------------------------------------- khói hương
  function addSmoke(x, y, strength) {
    smoke.push({
      x: x + (Math.random() - 0.5) * 8,
      y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -26 - Math.random() * 26,
      life: 0,
      maxLife: 2.2 + Math.random() * 1.4,
      size: 6 + Math.random() * 6,
      strength: strength || 1
    });
    if (smoke.length > 140) smoke.splice(0, smoke.length - 140);
  }

  // ---------------------------------------------------------- hoa hồng (gift)
  function roseBurst(x, y, count) {
    const n = Math.min(6 + Math.floor(count / 5), 18);
    for (let i = 0; i < n; i++) {
      roses.push({
        x: x + (Math.random() - 0.5) * 90,
        y: y - 40 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 130,
        vy: -160 - Math.random() * 170,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 5,
        size: 20 + Math.random() * 16,
        life: 0,
        maxLife: 1.5 + Math.random() * 0.8
      });
    }
    popups.push({
      text: `🌹 x${count}`,
      x, y: y - 190,
      vy: -46,
      life: 0, maxLife: 1.8,
      size: 54, gold: true
    });
    for (let i = 0; i < 14; i++) {
      sparkles.push({
        x: x + (Math.random() - 0.5) * 120,
        y: y - 60 - Math.random() * 120,
        vy: -40 - Math.random() * 60,
        life: 0, maxLife: 0.9,
        size: 3 + Math.random() * 5
      });
    }
  }

  // ---------------------------------------------------------- hoa sen (like)
  function lotusBurst(count) {
    const n = Math.min(count, 14);
    for (let i = 0; i < n; i++) {
      const fromLeft = Math.random() < 0.5;
      lotus.push({
        x: fromLeft ? 90 + Math.random() * 260 : W - 350 + Math.random() * 260,
        y: H - 60 - Math.random() * 240,
        vy: -70 - Math.random() * 90,
        sway: Math.random() * Math.PI * 2,
        size: 14 + Math.random() * 12,
        rot: (Math.random() - 0.5),
        life: 0,
        maxLife: 2.4 + Math.random() * 1.2,
        color: Math.random() < 0.5 ? 'rgba(255,150,190,0.95)' : 'rgba(255,205,220,0.95)'
      });
    }
  }

  // ---------------------------------------------------------- dòng chữ bay (join/follow)
  function floatText(text, gold) {
    popups.push({
      text,
      x: 240 + Math.random() * (W - 480),
      y: H - 430 - Math.random() * 220,
      vy: -55,
      life: 0, maxLife: 2.2,
      size: 34, gold: !!gold
    });
    if (popups.length > 14) popups.splice(0, popups.length - 14);
  }

  // ---------------------------------------------------------- update + draw
  function update(dt, time) {
    for (const p of smoke) {
      p.life += dt;
      p.x += p.vx + Math.sin(time * 0.002 + p.y * 0.02) * 0.5;
      p.y += p.vy * dt;
      p.size += dt * 9;
    }
    smoke = smoke.filter(p => p.life < p.maxLife);

    for (const r of roses) {
      r.life += dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy += 190 * dt;          // rơi dần
      r.rot += r.vr * dt;
    }
    roses = roses.filter(r => r.life < r.maxLife);

    for (const l of lotus) {
      l.life += dt;
      l.y += l.vy * dt;
      l.x += Math.sin(time * 0.003 + l.sway) * 1.4;
      l.vy *= (1 - dt * 0.25);
    }
    lotus = lotus.filter(l => l.life < l.maxLife);

    for (const p of popups) {
      p.life += dt;
      p.y += p.vy * dt;
    }
    popups = popups.filter(p => p.life < p.maxLife);

    for (const s of sparkles) {
      s.life += dt;
      s.y += s.vy * dt;
    }
    sparkles = sparkles.filter(s => s.life < s.maxLife);
  }

  function drawBack(c) {
    // khói — dưới phật tử
    for (const p of smoke) {
      const t = p.life / p.maxLife;
      const a = (1 - t) * 0.21 * p.strength;
      c.fillStyle = `rgba(225,215,205,${a})`;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawFront(c) {
    // hoa hồng bay
    for (const r of roses) {
      const t = r.life / r.maxLife;
      c.save();
      c.translate(r.x, r.y);
      c.rotate(r.rot);
      c.globalAlpha = 1 - Math.max(0, t - 0.6) / 0.4;
      c.font = `${r.size}px serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🌹', 0, 0);
      c.restore();
    }
    c.globalAlpha = 1;

    // cánh hoa sen (like) — bay lên phía tượng
    for (const l of lotus) {
      const t = l.life / l.maxLife;
      c.save();
      c.translate(l.x, l.y);
      c.rotate(l.rot + Math.sin(l.life * 2 + l.sway) * 0.3);
      c.globalAlpha = (1 - t) * 0.95;
      c.fillStyle = l.color;
      // cánh sen đơn
      c.beginPath();
      c.moveTo(0, -l.size);
      c.quadraticCurveTo(l.size * 0.8, 0, 0, l.size * 0.7);
      c.quadraticCurveTo(-l.size * 0.8, 0, 0, -l.size);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.globalAlpha = 1;

    // lấp lánh
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const s of sparkles) {
      const a = 1 - s.life / s.maxLife;
      c.globalAlpha = a;
      c.fillStyle = '#ffe9a8';
      c.beginPath();
      c.arc(s.x, s.y, s.size * a + 1, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    c.globalAlpha = 1;

    // popup chữ (🌹 xN, join, follow)
    for (const p of popups) {
      const t = p.life / p.maxLife;
      c.save();
      c.globalAlpha = t < 0.15 ? t / 0.15 : (1 - Math.max(0, t - 0.6) / 0.4);
      c.font = `800 ${p.size}px "Segoe UI", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.strokeStyle = 'rgba(40,12,4,0.85)';
      c.strokeText(p.text, p.x, p.y);
      c.fillStyle = p.gold ? '#ffd24a' : '#ffffff';
      c.fillText(p.text, p.x, p.y);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  return { addSmoke, roseBurst, lotusBurst, floatText, update, drawBack, drawFront };
})();
