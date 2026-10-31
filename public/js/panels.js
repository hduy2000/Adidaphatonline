// panels.js — bảng vàng dâng hương (top 5) + panel "Người quen đã dâng lại" + tổng quà
'use strict';

const Panels = (() => {
  let contributors = new Map();  // uid -> { nick, pic, count, roses }
  let recent = [];               // [{ uid, nick, pic, count, at }]
  let totalRoses = 0;
  let totalPeople = new Set();
  let dirty = true;
  let titles = { leaderboard: 'BẢNG VÀNG DÂNG HƯƠNG', recent: 'Người quen đã dâng lại' };

  let elBoard, elBoardBody, elRecent, elRecentBody, elTotals;
  let renderTimer = null;

  function ensureDom() {
    elBoard = document.getElementById('leaderboard');
    elBoardBody = document.getElementById('leaderboard-body');
    elRecent = document.getElementById('recent');
    elRecentBody = document.getElementById('recent-body');
    elTotals = document.getElementById('totals');

    if (elBoard) {
      elBoard.querySelector('.panel-title').textContent = titles.leaderboard;
      elRecent.querySelector('.panel-title').textContent = titles.recent;
    }
  }

  function record(user, roses, isGift) {
    const key = user.uid || user.id || user.nick;
    if (!key) return;
    let entry = contributors.get(key);
    if (!entry) {
      entry = { nick: user.nick || user.id || 'Khách', pic: user.pic || '', count: 0, roses: 0 };
      contributors.set(key, entry);
      totalPeople.add(key);
    }
    entry.count += 1;
    entry.roses += roses || 0;
    if (user.pic) entry.pic = user.pic;

    totalRoses += roses || 0;

    let r = recent.find(x => x.uid === key);
    if (!r) {
      r = { uid: key, nick: entry.nick, pic: entry.pic, count: 0 };
      recent.unshift(r);
      if (recent.length > 5) recent.pop();
    }
    r.nick = entry.nick;
    r.pic = entry.pic;
    r.count += 1;

    dirty = true;
  }

  function avatarHtml(pic, nick) {
    if (pic) {
      return `<img src="${escapeHtml(pic)}" referrerpolicy="no-referrer" alt="">`;
    }
    const letter = (nick || '?').trim().charAt(0).toUpperCase();
    return `<span class="avatar-letter">${escapeHtml(letter)}</span>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function render() {
    if (!elBoard || !dirty) return;
    dirty = false;

    // top 5 theo số hoa dâng
    const top = [...contributors.values()].sort((a, b) => b.roses - a.roses).slice(0, 5);
    elBoardBody.innerHTML = top.map((e, i) => `
      <div class="rank-row ${i === 0 ? 'first' : ''}">
        <span class="rank-no">${i + 1}</span>
        ${avatarHtml(e.pic, e.nick)}
        <span class="rank-name">${escapeHtml(short(e.nick, 14))}</span>
        <span class="rank-roses">🌹 ${e.roses}</span>
      </div>`).join('');

    elRecentBody.innerHTML = recent.map(e => `
      <div class="recent-row">
        ${avatarHtml(e.pic, e.nick)}
        <span class="recent-name">${escapeHtml(short(e.nick, 12))}</span>
        <span class="recent-count">đã dâng ${e.count}</span>
      </div>`).join('');

    elTotals.innerHTML = `🌹 <b>${totalRoses}</b> hoa · <b>${totalPeople.size}</b> phật tử đã dâng hương`;
  }

  function short(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  // xóa sạch dữ liệu đã tích lũy (khi chuyển giữa LIVE <-> DEMO để không trộn data giả với thật)
  function clear() {
    contributors.clear();
    recent = [];
    totalRoses = 0;
    totalPeople.clear();
    dirty = true;
  }

  function init(config) {
    if (config) {
      titles.leaderboard = config.leaderboardTitle || titles.leaderboard;
      titles.recent = config.recentTitle || titles.recent;
    }
    contributors.clear();
    recent = [];
    totalRoses = 0;
    totalPeople.clear();
    dirty = true;
    ensureDom();
    if (!renderTimer) renderTimer = setInterval(render, 400);
    applyConfig(config);
  }

  // áp cài đặt live: tiêu đề + chế độ hiện/ẩn panel (không reset dữ liệu)
  let panelCfg = { panelMode: 'occasional', panelEveryMinutes: 3, panelShowSeconds: 30 };
  let cycleTimer = null, hideTimer = null;

  function setPanelVisible(el, show) {
    if (!el) return;
    el.classList.toggle('panel-hidden', !show);
  }

  function stopPanelCycle() {
    if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  // điều phối hiện/ẩn 2 bảng theo chế độ cài đặt
  function startPanelCycle() {
    stopPanelCycle();
    const mode = panelCfg.panelMode;
    if (mode === 'hidden') {
      setPanelVisible(elBoard, false);
      setPanelVisible(elRecent, false);
      return;
    }
    if (mode === 'always') {
      setPanelVisible(elBoard, true);
      setPanelVisible(elRecent, true);
      return;
    }
    // occasional: ẩn mặc định, thỉnh thoảng hiện ra một lúc rồi lại ẩn
    setPanelVisible(elBoard, false);
    setPanelVisible(elRecent, false);
    const everyMs = Math.max(1, panelCfg.panelEveryMinutes || 3) * 60000;
    const showMs = Math.max(5, panelCfg.panelShowSeconds || 30) * 1000;
    const showOnce = () => {
      setPanelVisible(elBoard, true);
      setPanelVisible(elRecent, true);
      hideTimer = setTimeout(() => {
        setPanelVisible(elBoard, false);
        setPanelVisible(elRecent, false);
        cycleTimer = setTimeout(showOnce, everyMs);
      }, showMs);
    };
    // lần đầu hiện sớm (30s) để dễ kiểm tra, sau đó theo chu kỳ cài đặt
    cycleTimer = setTimeout(showOnce, Math.min(30000, everyMs));
  }

  function applyConfig(cfg) {
    if (!cfg) return;
    titles.leaderboard = cfg.leaderboardTitle || titles.leaderboard;
    titles.recent = cfg.recentTitle || titles.recent;
    if (cfg.panelMode) panelCfg.panelMode = cfg.panelMode;
    if (cfg.panelEveryMinutes) panelCfg.panelEveryMinutes = cfg.panelEveryMinutes;
    if (cfg.panelShowSeconds) panelCfg.panelShowSeconds = cfg.panelShowSeconds;
    ensureDom();
    if (elBoard) elBoard.querySelector('.panel-title').textContent = titles.leaderboard;
    if (elRecent) elRecent.querySelector('.panel-title').textContent = titles.recent;
    if (elTotals) elTotals.style.display = cfg.showTotals === false ? 'none' : '';
    startPanelCycle();
    dirty = true;
  }

  return { init, record, applyConfig, clear };
})();
