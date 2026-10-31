// scene.js — vẽ nền chùa bằng code (tĩnh 1 lần) + các hiệu ứng động của nền
// Kích thước logic: 1080 x 1920 (dọc 9:16 cho TikTok)
'use strict';

const Scene = (() => {
  const W = 1080, H = 1920;

  // Tọa độ mốc của cảnh (monk.js/effects.js đọc từ đây)
  let photoMode = false;      // dùng ảnh nền (true) hay cảnh vẽ code (false)
  let cushionSprite = null;
  let cushionImg = null;      // bồ đoàn do người dùng cung cấp

  function computeSlots() {
    // chế độ ảnh: sàn phản chiếu bắt đầu sâu hơn (~1307) -> các bồ đoàn lùi xuống
    const rows = photoMode ? [1360, 1450, 1540, 1630] : [1150, 1265, 1385, 1500];
    const cols = [4, 5, 5, 6];
    const gap = photoMode ? [160, 150, 148, 140] : [168, 152, 152, 142];
    const list = [];
    rows.forEach((y, r) => {
      for (let i = 0; i < cols[r]; i++) {
        list.push({ x: W / 2 + (i - (cols[r] - 1) / 2) * gap[r], y: y + (i % 2 ? 5 : -5) });
      }
    });
    LAYOUT.slots = list;
  }

  const LAYOUT = {
    altarFrontY: 1060,        // mép trước đàn hương
    burner: { x: 540, y: 1005 },   // vị trí lư hương
    slots: [],                // các bồ đoàn trước đàn hương
    spawnY: H + 80            // điểm spawn dưới đáy màn hình
  };
  computeSlots();

  let canvas, ctx, bgCanvas;
  let petals = [];            // cánh hoa bay nền
  let dust = [];              // bụi vàng lơ lửng
  let frame = 0;

  // ---------------------------------------------------------- helpers
  function lerp(a, b, t) { return a + (b - a) * t; }

  function radialGlow(c, x, y, r, inner, outer) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---------------------------------------------------------- nền tĩnh
  function paintBackground(c) {
    // --- tường phía sau: nâu đỏ trầm ---
    const wall = c.createLinearGradient(0, 0, 0, 1000);
    wall.addColorStop(0, '#160605');
    wall.addColorStop(0.5, '#3a1008');
    wall.addColorStop(1, '#57200e');
    c.fillStyle = wall;
    c.fillRect(0, 0, W, 1000);

    // hào quang lớn sau tượng Phật
    radialGlow(c, 540, 560, 640, 'rgba(255,196,90,0.55)', 'rgba(120,40,10,0)');

    // --- vòm vàng (mandorla) sau tượng ---
    c.save();
    c.translate(540, 620);
    const arch = c.createLinearGradient(0, -560, 0, 560);
    arch.addColorStop(0, 'rgba(255,226,140,0.9)');
    arch.addColorStop(0.55, 'rgba(255,170,60,0.45)');
    arch.addColorStop(1, 'rgba(140,50,15,0)');
    c.fillStyle = arch;
    c.beginPath();
    c.ellipse(0, 0, 330, 560, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,230,150,0.8)';
    c.lineWidth = 10;
    c.stroke();
    c.restore();

    // --- tượng Phật ---
    drawBuddha(c, 540, 600, 1.05);

    // --- cửa vòm tối hai bên tượng ---
    for (const sx of [180, 900]) {
      c.fillStyle = 'rgba(20,6,4,0.85)';
      c.beginPath();
      c.moveTo(sx - 70, 980);
      c.lineTo(sx - 70, 420);
      c.quadraticCurveTo(sx, 300, sx + 70, 420);
      c.lineTo(sx + 70, 980);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(230,160,60,0.5)';
      c.lineWidth = 6;
      c.stroke();
      // chân đèn thờ nhỏ trong hốc
      radialGlow(c, sx, 620, 90, 'rgba(255,180,80,0.35)', 'rgba(0,0,0,0)');
    }

    // --- cột đỏ hai bên ---
    drawColumn(c, 108);
    drawColumn(c, W - 108);

    // --- hàng phật tử tí hon phía xa (tạo chiều sâu) ---
    drawTinyCrowd(c);

    // --- đèn lồng đỏ treo ---
    drawLantern(c, 130, 210, 1.0);
    drawLantern(c, W - 130, 210, 1.0);
    drawLantern(c, 300, 120, 0.7);
    drawLantern(c, W - 300, 120, 0.7);

    // --- sàn: gradient nâu ấm + ánh vàng giữa ---
    const floor = c.createLinearGradient(0, 950, 0, H);
    floor.addColorStop(0, '#4d1a0c');
    floor.addColorStop(0.4, '#3a1108');
    floor.addColorStop(1, '#200904');
    c.fillStyle = floor;
    c.fillRect(0, 950, W, H - 950);

    // thảm đỏ centre dẫn lên đàn hương
    c.save();
    c.beginPath();
    c.moveTo(300, H);
    c.lineTo(780, H);
    c.lineTo(610, 990);
    c.lineTo(470, 990);
    c.closePath();
    const carpet = c.createLinearGradient(0, 990, 0, H);
    carpet.addColorStop(0, 'rgba(190,40,20,0.85)');
    carpet.addColorStop(1, 'rgba(120,20,10,0.95)');
    c.fillStyle = carpet;
    c.fill();
    c.strokeStyle = 'rgba(255,205,90,0.85)';
    c.lineWidth = 8;
    c.stroke();
    c.restore();

    // vân sàn hội tụ (perspective lines)
    c.strokeStyle = 'rgba(255,190,90,0.12)';
    c.lineWidth = 3;
    for (let i = -6; i <= 6; i++) {
      c.beginPath();
      c.moveTo(540 + i * 40, 1000);
      c.lineTo(540 + i * 260, H);
      c.stroke();
    }
    for (let y = 1100; y < H; y += 130) {
      const spread = lerp(60, 480, (y - 1000) / 920);
      c.beginPath();
      c.moveTo(540 - spread, y);
      c.lineTo(540 + spread, y);
      c.stroke();
    }

    // --- đàn hương 3 bậc ---
    drawAltar(c);

    // --- lư hương trung tâm ---
    drawBurner(c, LAYOUT.burner.x, LAYOUT.burner.y);

    // --- nến hai bên đàn ---
    drawCandle(c, 400, 1010);
    drawCandle(c, 680, 1010);

    // --- mâm lễ vật ---
    drawOfferingPlate(c, 320, 1035);
    drawOfferingPlate(c, 760, 1035);

    // vignette làm tối mép
    const vig = c.createRadialGradient(540, 900, 500, 540, 960, 1150);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------- tượng Phật
  function drawBuddha(c, cx, cy, s) {
    // cy = tâm hào quang (ngay sau đầu Phật)
    c.save();
    c.translate(cx, cy);
    c.scale(s, s);

    const LINE = 'rgba(105,62,14,0.45)';

    // ---------- hào quang tròn ----------
    const haloR = 132;
    const halo = c.createRadialGradient(0, 0, 40, 0, 0, haloR + 30);
    halo.addColorStop(0, 'rgba(255,246,205,0.95)');
    halo.addColorStop(0.55, 'rgba(255,215,125,0.5)');
    halo.addColorStop(1, 'rgba(255,190,80,0)');
    c.fillStyle = halo;
    c.beginPath(); c.arc(0, 0, haloR + 30, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(160,105,30,0.8)';
    c.lineWidth = 5;
    c.beginPath(); c.arc(0, 0, haloR, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,232,165,0.85)';
    c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, haloR - 7, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,226,140,0.9)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.arc(Math.cos(a) * haloR, Math.sin(a) * haloR, 3.5, 0, Math.PI * 2);
      c.fill();
    }

    // ---------- tòa sen ----------
    drawLotusThrone(c, 0, 330);

    // ---------- chân kiết già ----------
    const bodyG = c.createLinearGradient(-150, -280, 150, 320);
    bodyG.addColorStop(0, '#ffeab2');
    bodyG.addColorStop(0.5, '#f2c25e');
    bodyG.addColorStop(1, '#bd7d1c');

    c.fillStyle = bodyG;
    c.strokeStyle = LINE;
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, 240, 218, 88, 0, 0, Math.PI * 2);
    c.fill(); c.stroke();
    // sáng dọc đùi
    c.fillStyle = 'rgba(255,240,190,0.25)';
    c.beginPath();
    c.ellipse(0, 216, 185, 55, 0, 0, Math.PI * 2);
    c.fill();

    // hai bàn chân úp trên gối
    for (const side of [-1, 1]) {
      c.save();
      c.translate(side * 82, 218);
      c.rotate(side * -0.09);
      c.fillStyle = '#f6d68c';
      c.strokeStyle = LINE;
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(0, 0, 50, 20, 0, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.strokeStyle = 'rgba(150,92,20,0.5)';
      c.lineWidth = 2;
      for (let t = -2; t <= 2; t++) {
        c.beginPath();
        c.arc(t * 14, -6, 6.5, Math.PI * 1.25, Math.PI * 1.85);
        c.stroke();
      }
      c.restore();
    }

    // ---------- thân trên (áo) ----------
    c.fillStyle = bodyG;
    c.strokeStyle = LINE;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-108, 218);
    c.quadraticCurveTo(-126, 60, -100, -52);
    c.quadraticCurveTo(-56, -96, 0, -96);
    c.quadraticCurveTo(56, -96, 100, -52);
    c.quadraticCurveTo(126, 60, 108, 218);
    c.quadraticCurveTo(0, 258, -108, 218);
    c.closePath();
    c.fill(); c.stroke();
    // bóng nhẹ hai bên
    c.fillStyle = 'rgba(120,70,15,0.14)';
    c.beginPath();
    c.moveTo(-108, 218);
    c.quadraticCurveTo(-126, 60, -100, -52);
    c.quadraticCurveTo(-88, -80, -52, -92);
    c.quadraticCurveTo(-84, 30, -88, 222);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(108, 218);
    c.quadraticCurveTo(126, 60, 100, -52);
    c.quadraticCurveTo(88, -80, 52, -92);
    c.quadraticCurveTo(84, 30, 88, 222);
    c.closePath();
    c.fill();

    // ---------- hai tay gập vào lòng ----------
    c.lineCap = 'round';
    for (const side of [-1, 1]) {
      c.strokeStyle = '#e3b04a';
      c.lineWidth = 28;
      c.beginPath();
      c.moveTo(side * 80, -38);
      c.quadraticCurveTo(side * 104, 60, side * 22, 140);
      c.stroke();
      c.strokeStyle = 'rgba(255,233,176,0.85)';
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(side * 75, -34);
      c.quadraticCurveTo(side * 94, 56, side * 20, 132);
      c.stroke();
    }
    // bàn tay xếp chồng (ấn thiền định)
    c.fillStyle = '#f4ca6a';
    c.strokeStyle = LINE;
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(0, 150, 48, 18, 0, 0, Math.PI * 2);
    c.fill(); c.stroke();
    c.fillStyle = '#ffe6a8';
    c.beginPath();
    c.ellipse(0, 146, 32, 11, 0, 0, Math.PI * 2);
    c.fill();

    // ---------- chi tiết áo ----------
    // cổ áo V nhỏ
    c.strokeStyle = 'rgba(140,86,20,0.75)';
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-24, -88);
    c.lineTo(0, -48);
    c.lineTo(24, -88);
    c.stroke();
    // nếp áo chéo mảnh
    c.strokeStyle = 'rgba(140,85,20,0.4)';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(-72, -66);
    c.quadraticCurveTo(-20, 30, 48, 122);
    c.stroke();
    // gấu áo
    c.strokeStyle = '#a86a1c';
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(-104, 214);
    c.quadraticCurveTo(0, 252, 104, 214);
    c.stroke();

    // ---------- cổ ----------
    c.fillStyle = '#e3b054';
    c.fillRect(-13, -152, 26, 44);
    c.strokeStyle = 'rgba(140,85,20,0.45)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(-11, -138); c.quadraticCurveTo(0, -134, 11, -138); c.stroke();

    // ---------- đầu ----------
    // mặt
    c.fillStyle = '#ffe3a0';
    c.strokeStyle = LINE;
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(0, -212, 50, 56, 0, 0, Math.PI * 2);
    c.fill(); c.stroke();

    // tai dài vừa phải
    for (const side of [-1, 1]) {
      c.fillStyle = '#f2c25e';
      c.strokeStyle = LINE;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(side * 48, -206, 8, 24, 0, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.fillStyle = '#f2c25e';
      c.beginPath();
      c.arc(side * 48, -182, 6, 0, Math.PI * 2);
      c.fill();
    }

    // tóc xoắn ốc
    c.fillStyle = '#2c2440';
    c.beginPath();
    c.moveTo(-49, -222);
    c.quadraticCurveTo(-55, -268, 0, -274);
    c.quadraticCurveTo(55, -268, 49, -222);
    c.quadraticCurveTo(0, -244, -49, -222);
    c.closePath();
    c.fill();
    c.fillStyle = '#453a6b';
    for (let row = 0; row < 3; row++) {
      const ry = -266 + row * 11;
      const spread = 44 - row * 6;
      const count = 4 + row;
      for (let i = 0; i < count; i++) {
        const hx = (i - (count - 1) / 2) * (spread * 2 / count);
        c.beginPath();
        c.arc(hx, ry + (i % 2) * 2.5, 3, 0, Math.PI * 2);
        c.fill();
      }
    }
    // bụt ú
    c.fillStyle = '#2c2440';
    c.beginPath();
    c.arc(0, -282, 15, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#453a6b';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + (i / 3) * Math.PI;
      c.beginPath();
      c.arc(Math.cos(a) * 8, -282 + Math.sin(a) * 8, 2.5, 0, Math.PI * 2);
      c.fill();
    }

    // ---------- gương mặt an tịnh ----------
    c.lineCap = 'round';
    // lông mày
    c.strokeStyle = 'rgba(110,66,16,0.9)';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(-30, -228);
    c.quadraticCurveTo(-18, -234, -7, -228);
    c.stroke();
    c.beginPath();
    c.moveTo(7, -228);
    c.quadraticCurveTo(18, -234, 30, -228);
    c.stroke();
    // mắt nhắm hiền hòa
    c.strokeStyle = 'rgba(88,50,12,0.95)';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(-25, -214);
    c.quadraticCurveTo(-17, -208, -8, -213);
    c.stroke();
    c.beginPath();
    c.moveTo(8, -213);
    c.quadraticCurveTo(17, -208, 25, -214);
    c.stroke();
    // mũi
    c.strokeStyle = 'rgba(140,88,22,0.7)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(0, -212);
    c.quadraticCurveTo(4, -198, 0, -193);
    c.stroke();
    c.beginPath();
    c.moveTo(-6, -191);
    c.quadraticCurveTo(0, -187, 6, -191);
    c.stroke();
    // môi
    c.strokeStyle = 'rgba(148,58,32,0.85)';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(-9, -177);
    c.quadraticCurveTo(0, -171, 9, -177);
    c.stroke();
    // lưng yên (urna) giữa trán
    c.save();
    c.globalCompositeOperation = 'lighter';
    radialGlow(c, 0, -240, 10, 'rgba(255,255,225,0.95)', 'rgba(255,255,225,0)');
    c.restore();

    c.restore();
  }

  // tòa sen dưới Phật
  function drawLotusThrone(c, x, y) {
    c.save();
    c.translate(x, y);
    // đế
    c.fillStyle = '#8a5312';
    c.beginPath();
    c.ellipse(0, 36, 228, 32, 0, 0, Math.PI * 2);
    c.fill();
    // hai lớp cánh sen
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const px = i * 43;
      c.fillStyle = '#c8912e';
      c.strokeStyle = 'rgba(105,62,14,0.45)';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(px, 16, 23, 32, i * 0.012, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,225,150,0.55)';
      c.beginPath();
      c.ellipse(px, 4, 12, 10, 0, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = -4; i <= 4; i++) {
      const px = i * 48;
      c.fillStyle = '#e0a83e';
      c.strokeStyle = 'rgba(105,62,14,0.45)';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(px, -4, 22, 28, i * 0.014, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,232,170,0.65)';
      c.beginPath();
      c.ellipse(px, -17, 11, 8, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // bồ đoàn — vẽ 1 lần vào sprite rồi stamp theo từng vị trí (hiện trên cả ảnh nền)
  function buildCushionSprite() {
    const cv = document.createElement('canvas');
    cv.width = 120;
    cv.height = 56;
    const c = cv.getContext('2d');
    c.translate(60, 24);
    // bóng
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(0, 9, 48, 12, 0, 0, Math.PI * 2);
    c.fill();
    // thân đệm
    c.fillStyle = '#5c130c';
    c.beginPath();
    c.ellipse(0, 2, 44, 16, 0, 0, Math.PI * 2);
    c.fill();
    // mặt trên
    const g = c.createRadialGradient(-12, -12, 4, 0, -4, 50);
    g.addColorStop(0, '#b8443a');
    g.addColorStop(0.7, '#8e241a');
    g.addColorStop(1, '#5c130c');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, -4, 44, 17, 0, 0, Math.PI * 2);
    c.fill();
    // vòng kim tuyến
    c.strokeStyle = 'rgba(255,205,110,0.6)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(0, -4, 32, 11, 0, 0, Math.PI * 2);
    c.stroke();
    // nút giữa
    c.fillStyle = '#e8b13c';
    c.beginPath();
    c.arc(0, -4, 4.5, 0, Math.PI * 2);
    c.fill();
    cushionSprite = cv;
  }

  function drawCushions(c) {
    if (cushionImg) {
      // bồ đoàn do người dùng cung cấp (image/cushion.png)
      for (const p of LAYOUT.slots) {
        const s = 0.82 + 0.3 * Math.min(1, Math.max(0, (p.y - 1000) / 920));
        const w = 136 * s;
        const h = w * (cushionImg.height / cushionImg.width);
        c.drawImage(cushionImg, p.x - w / 2, p.y - h * 0.55, w, h);
      }
      return;
    }
    if (!cushionSprite) return;
    for (const p of LAYOUT.slots) {
      const s = 0.82 + 0.3 * Math.min(1, Math.max(0, (p.y - 1000) / 920));
      const w = 120 * s, h = 56 * s;
      c.drawImage(cushionSprite, p.x - w / 2, p.y - 24 * s, w, h);
    }
  }

  // ---------------------------------------------------------- ảnh nền
  // name: tên file trong /public/image/ — rỗng = dùng cảnh vẽ code
  function setBackground(name, onSlotsChanged) {
    if (!name) {
      photoMode = false;
      computeSlots();
      paintBackground(bgCanvas.getContext('2d'));
      if (onSlotsChanged) onSlotsChanged();
      return;
    }
    const img = new Image();
    img.onload = () => {
      photoMode = true;
      const c = bgCanvas.getContext('2d');
      // phủ kín 1080x1920 giữ tỉ lệ (cover)
      const ir = img.width / img.height, cr = W / H;
      let dw, dh;
      if (ir > cr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
      c.clearRect(0, 0, W, H);
      c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      computeSlots();
      if (onSlotsChanged) onSlotsChanged();
    };
    img.onerror = () => {
      // không tải được ảnh -> quay lại cảnh vẽ code
      photoMode = false;
      computeSlots();
      paintBackground(bgCanvas.getContext('2d'));
      if (onSlotsChanged) onSlotsChanged();
    };
    img.src = '/image/' + encodeURIComponent(name);
  }

  // ---------------------------------------------------------- chi tiết chùa
  function drawColumn(c, x) {
    const grad = c.createLinearGradient(x - 46, 0, x + 46, 0);
    grad.addColorStop(0, '#5c0f08');
    grad.addColorStop(0.45, '#a52a14');
    grad.addColorStop(0.7, '#c23c1c');
    grad.addColorStop(1, '#4a0c06');
    c.fillStyle = grad;
    c.fillRect(x - 46, 0, 92, 1010);

    // chạm vàng cột
    c.fillStyle = 'rgba(255,205,90,0.85)';
    for (const y of [80, 500, 920]) {
      c.fillRect(x - 50, y, 100, 16);
    }
    // đầu + đế cột
    c.fillStyle = '#8a5312';
    c.fillRect(x - 60, 0, 120, 30);
    c.fillRect(x - 60, 980, 120, 34);

    // ánh đèn hắt lên cột
    radialGlow(c, x, 800, 150, 'rgba(255,170,70,0.28)', 'rgba(0,0,0,0)');
  }

  function drawLantern(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    // dây
    c.strokeStyle = '#7a3b12';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(0, -120);
    c.lineTo(0, -44);
    c.stroke();
    // thân đèn
    const body = c.createRadialGradient(-10, -10, 4, 0, 0, 52);
    body.addColorStop(0, '#ff8b5e');
    body.addColorStop(0.6, '#e03a20');
    body.addColorStop(1, '#96180c');
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(0, 0, 46, 56, 0, 0, Math.PI * 2);
    c.fill();
    // nan đèn
    c.strokeStyle = 'rgba(255,220,140,0.55)';
    c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, 0, 18, 56, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(0, 0, 34, 56, 0, 0, Math.PI * 2); c.stroke();
    // nắp + tua
    c.fillStyle = '#e8b13c';
    c.fillRect(-20, -52, 40, 12);
    c.fillRect(-16, 50, 32, 10);
    c.strokeStyle = '#e8b13c';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, 60);
    c.lineTo(0, 92);
    c.stroke();
    // sáng đèn
    radialGlow(c, 0, 0, 90, 'rgba(255,120,50,0.4)', 'rgba(0,0,0,0)');
    c.restore();
  }

  function drawTinyCrowd(c) {
    // hàng người tí hon đứng sau đàn
    for (let row = 0; row < 2; row++) {
      const y = 908 + row * 34;
      const count = 11 - row;
      for (let i = 0; i < count; i++) {
        const x = 540 + (i - (count - 1) / 2) * (72 - row * 8);
        const sc = 0.4 - row * 0.08;
        c.save();
        c.translate(x + (i % 2 ? 6 : -6), y);
        c.scale(sc, sc);
        c.fillStyle = row ? 'rgba(240,230,210,0.9)' : 'rgba(232,176,84,0.9)';
        c.beginPath();
        c.moveTo(-30, 40);
        c.quadraticCurveTo(-36, -30, 0, -40);
        c.quadraticCurveTo(36, -30, 30, 40);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(255,215,150,0.95)';
        c.beginPath();
        c.arc(0, -52, 17, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
  }

  function drawAltar(c) {
    // 3 bậc thềm
    const tiers = [
      { y: 990, w: 700, h: 46, top: '#c98d3f', front: '#7c4a16' },
      { y: 1036, w: 820, h: 52, top: '#b87f34', front: '#6b3c11' },
      { y: 1088, w: 940, h: 58, top: '#a8702b', front: '#5c320d' }
    ];
    for (const t of tiers) {
      // mặt trên
      c.fillStyle = t.top;
      c.beginPath();
      c.moveTo(540 - t.w / 2 + 28, t.y);
      c.lineTo(540 + t.w / 2 - 28, t.y);
      c.lineTo(540 + t.w / 2, t.y + t.h);
      c.lineTo(540 - t.w / 2, t.y + t.h);
      c.closePath();
      c.fill();
      // mặt trước
      c.fillStyle = t.front;
      c.fillRect(540 - t.w / 2, t.y + t.h, t.w, 26);
      // đinh vàng trang trí
      c.fillStyle = 'rgba(255,215,120,0.9)';
      for (let i = 0; i < 8; i++) {
        c.beginPath();
        c.arc(540 - t.w / 2 + 40 + (i * (t.w - 80)) / 7, t.y + t.h + 13, 4, 0, Math.PI * 2);
        c.fill();
      }
    }
    // ánh sáng trước đàn
    radialGlow(c, 540, 1060, 320, 'rgba(255,190,90,0.30)', 'rgba(0,0,0,0)');
  }

  function drawBurner(c, x, y) {
    c.save();
    c.translate(x, y);
    // thân lư đồng
    const bronze = c.createLinearGradient(-60, 0, 60, 0);
    bronze.addColorStop(0, '#6e4a18');
    bronze.addColorStop(0.4, '#c99a3f');
    bronze.addColorStop(1, '#6e4a18');
    c.fillStyle = bronze;
    c.beginPath();
    c.ellipse(0, 0, 64, 44, 0, 0, Math.PI * 2);
    c.fill();
    // miệng lư
    c.fillStyle = '#3a2408';
    c.beginPath();
    c.ellipse(0, -26, 50, 16, 0, 0, Math.PI * 2);
    c.fill();
    // nắp lư
    c.fillStyle = '#c99a3f';
    c.beginPath();
    c.ellipse(0, -38, 46, 18, 0, Math.PI, 0);
    c.fill();
    c.beginPath();
    c.arc(0, -62, 9, 0, Math.PI * 2);
    c.fill();
    // 3 chân
    c.fillStyle = '#6e4a18';
    for (const dx of [-44, 0, 44]) {
      c.fillRect(dx - 8, 34, 16, 26);
    }
    // quai
    c.strokeStyle = '#8a5f1d';
    c.lineWidth = 8;
    c.beginPath(); c.arc(-60, -18, 14, Math.PI * 0.4, Math.PI * 1.6); c.stroke();
    c.beginPath(); c.arc(60, -18, 14, -Math.PI * 0.6, Math.PI * 0.6); c.stroke();
    // tàn hương trong lư
    c.fillStyle = 'rgba(255,150,60,0.65)';
    c.beginPath();
    c.ellipse(0, -28, 38, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawCandle(c, x, y) {
    c.save();
    c.translate(x, y);
    c.fillStyle = '#b3231a';
    c.fillRect(-14, -70, 28, 70);
    c.fillStyle = 'rgba(255,205,90,0.9)';
    c.fillRect(-18, -6, 36, 10);
    // ngọn nến (vẽ đè động ở layer frame)
    c.fillStyle = '#f7e9b0';
    c.beginPath();
    c.ellipse(0, -70, 14, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawOfferingPlate(c, x, y) {
    c.save();
    c.translate(x, y);
    c.fillStyle = '#c99a3f';
    c.beginPath();
    c.ellipse(0, 0, 52, 16, 0, 0, Math.PI * 2);
    c.fill();
    // trái cây
    const fruits = [['#e8862c', -22, -10], ['#d9c33c', 0, -14], ['#c2462a', 22, -10], ['#7ea83c', 8, -6]];
    for (const [col, dx, dy] of fruits) {
      c.fillStyle = col;
      c.beginPath();
      c.arc(dx, dy, 14, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // ---------------------------------------------------------- lớp động mỗi frame
  function paintDynamic(c, time) {
    // các hiệu ứng vẽ đè chỉ dành cho nền vẽ code (ảnh nền đã có sẵn ánh sáng)
    if (!photoMode) {
      // tia sáng nghiêng từ trên cao (god rays) — nhấp nháy chậm
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = 0.05 + 0.035 * Math.sin(time * 0.0006 + i * 1.7);
        const x = 260 + i * 180;
        c.fillStyle = `rgba(255,220,140,${a})`;
        c.beginPath();
        c.moveTo(x - 40, 0);
        c.lineTo(x + 40, 0);
        c.lineTo(x + 190, 900);
        c.lineTo(x + 40, 900);
        c.closePath();
        c.fill();
      }
      // vòng hào quang quay chậm sau đầu Phật
      const haloPulse = 0.35 + 0.1 * Math.sin(time * 0.001);
      radialGlow(c, 540, 380, 210, `rgba(255,240,190,${haloPulse})`, 'rgba(255,200,90,0)');
      c.restore();

      // ngọn nến lóe
      for (const cx of [400, 680]) {
        const flick = Math.sin(time * 0.02 + cx) * 0.5 + Math.random() * 0.5;
        const fh = 26 + flick * 10;
        c.save();
        c.globalCompositeOperation = 'lighter';
        radialGlow(c, cx, 1010 - 76 - fh / 2, 34, 'rgba(255,200,80,0.75)', 'rgba(255,120,20,0)');
        c.fillStyle = 'rgba(255,235,160,0.95)';
        c.beginPath();
        c.ellipse(cx, 1010 - 76 - fh / 2, 6, fh / 2, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    // khói lư hương luôn phiêu (đúng vị trí lư ở cả 2 chế độ)
    if (frame % 14 === 0) {
      Effects.addSmoke(LAYOUT.burner.x + (Math.random() - 0.5) * 30, LAYOUT.burner.y - 40, 0.5);
    }

    // cánh hoa sen bay trong không khí
    for (const p of petals) {
      p.y += p.vy;
      p.x += Math.sin(time * 0.001 + p.phase) * 0.6;
      p.rot += p.vr;
      if (p.y > H + 40) { p.y = -40; p.x = Math.random() * W; }
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.globalAlpha = p.alpha;
      c.fillStyle = p.color;
      c.beginPath();
      c.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.globalAlpha = 1;

    // bụi vàng lơ lửng
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      d.y -= d.vy;
      d.x += Math.sin(time * 0.0008 + d.phase) * 0.3;
      if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
      c.globalAlpha = 0.15 + 0.12 * Math.sin(time * 0.002 + d.phase);
      c.fillStyle = '#ffe6a0';
      c.beginPath();
      c.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    c.globalAlpha = 1;
  }

  // ---------------------------------------------------------- init & loop
  function init(sceneCanvas) {
    canvas = sceneCanvas;
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');

    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W;
    bgCanvas.height = H;
    paintBackground(bgCanvas.getContext('2d'));
    buildCushionSprite();

    // nạp bồ đoàn ảnh nếu người dùng có bỏ vào /image/cushion.png
    const ci = new Image();
    ci.onload = () => { cushionImg = ci; };
    ci.src = '/image/cushion.png';

    // cánh hoa nền
    const colors = ['rgba(255,170,190,0.8)', 'rgba(255,220,225,0.8)', 'rgba(255,200,120,0.65)'];
    for (let i = 0; i < 34; i++) {
      petals.push({
        x: Math.random() * W, y: Math.random() * H,
        vy: 0.4 + Math.random() * 0.9, size: 8 + Math.random() * 12,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.03,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.35 + Math.random() * 0.4
      });
    }
    for (let i = 0; i < 36; i++) {
      dust.push({
        x: Math.random() * W, y: Math.random() * H,
        vy: 0.15 + Math.random() * 0.35, size: 1 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function render(time) {
    frame++;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bgCanvas, 0, 0);
    drawCushions(ctx);
    paintDynamic(ctx, time);
  }

  return { W, H, LAYOUT, init, render, setBackground };
})();
