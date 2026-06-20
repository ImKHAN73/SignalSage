/* ═══════════════════════════════════════════════════
   SignalSage — Main Application JS
   Multi-Signal AI Trading Agent · Bitget Hackathon
   ═══════════════════════════════════════════════════ */

// ── CONFIG ──────────────────────────────────────────
const COINS = [
  'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC',
  'LINK','UNI','ATOM','LTC','FIL','APT','ARB','OP','NEAR','INJ',
  'SUI','SEI','TIA','JUP','WIF','PEPE','FLOKI','BONK','RENDER','FET',
  'AGIX','OCEAN','BLUR','STRK'
];

const BASE_PRICES = {
  BTC:67500,ETH:3520,SOL:148,BNB:595,XRP:0.53,ADA:0.46,DOGE:0.125,AVAX:28.5,
  DOT:6.8,MATIC:0.58,LINK:14.2,UNI:7.5,ATOM:8.9,LTC:72,FIL:5.8,APT:8.2,
  ARB:0.85,OP:2.1,NEAR:5.6,INJ:24.5,SUI:1.35,SEI:0.48,TIA:8.5,JUP:0.72,
  WIF:2.1,PEPE:0.000011,FLOKI:0.000165,BONK:0.000022,RENDER:5.8,FET:1.45,
  AGIX:0.72,OCEAN:0.68,BLUR:0.28,STRK:0.82
};

const REFRESH_MS = 30000;

// ── STATE ───────────────────────────────────────────
const state = {
  coins: {},
  decisionLog: [],
  trades: [],
  history: [],
  wallet: null,
  tradeMode: 'spot',
  whaleAlerts: [],
  fearGreed: null,
  selectedCoin: null,
  logFilters: { time: 'all', coin: '', action: 'ALL' },
  marketFilter: 'ALL',
  autoTimer: null,
  pnlHistory: [],
  peakEquity: 10000,
  dataReady: false,
};

// ── INIT ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  try {
    initTheme();
    initNav();
    initControls();
    initTrade();
    initLog();
    initChat();
    loadState();

    // Generate simulated data IMMEDIATELY so page is never blank
    generateSimulatedData();
    processSignals();
    generateWhaleAlerts();
    generateFearGreed();
    state.dataReady = true;
    renderAll();
    logDecisions();
    updateStats();

    // Then try live data in background
    fetchLiveData();
    startAutoRefresh();
  } catch(err) {
    console.error('SignalSage init error:', err);
    // Still show something
    document.getElementById('homeStats').innerHTML = '<div class="stat-card"><span class="sc-label">Error</span><strong class="sc-val sell-c">' + err.message + '</strong></div>';
  }
});

// ── SIMULATED DATA (immediate) ──────────────────────
function generateSimulatedData() {
  COINS.forEach(c => {
    const base = BASE_PRICES[c] || 1;
    const change = (Math.random() - 0.47) * 10;
    const price = base * (1 + change / 100);
    const spread = base * (0.02 + Math.random() * 0.06);
    state.coins[c] = {
      price: price,
      change24h: change,
      high: price + spread / 2,
      low: price - spread / 2,
      vol: Math.random() * 2e9 + 1e7,
      signals: {},
      composite: 0,
      decision: 'HOLD',
      conf: 50,
      reasoning: '',
    };
  });
}

function generateFearGreed() {
  const val = Math.floor(Math.random() * 60) + 20;
  const labels = ['Extreme Fear','Fear','Neutral','Greed','Extreme Greed'];
  const idx = val <= 20 ? 0 : val <= 40 ? 1 : val <= 60 ? 2 : val <= 80 ? 3 : 4;
  state.fearGreed = { value: val, label: labels[idx] };
}

// ── LIVE DATA FETCH ─────────────────────────────────
async function fetchLiveData() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.bitget.com/api/v2/spot/market/tickers', { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code === '00000' && data.data) {
      const map = {};
      data.data.forEach(t => { map[t.symbol.replace('USDT','')] = t; });
      let updated = 0;
      COINS.forEach(c => {
        const t = map[c];
        if (t && t.lastPr) {
          state.coins[c].price = parseFloat(t.lastPr);
          state.coins[c].change24h = parseFloat(t.change24h || 0) * 100;
          state.coins[c].high = parseFloat(t.high24h || t.lastPr);
          state.coins[c].low = parseFloat(t.low24h || t.lastPr);
          state.coins[c].vol = parseFloat(t.quoteVolume || 0);
          updated++;
        }
      });
      if (updated > 0) {
        processSignals();
        generateWhaleAlerts();
        renderAll();
        logDecisions();
        updateStats();
        saveState();
      }
    }
  } catch(e) { /* keep simulated data */ }

  // Fear & Greed
  try {
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 4000);
    const res2 = await fetch('https://api.alternative.me/fng/?limit=1', { signal: controller2.signal });
    clearTimeout(timeout2);
    const data2 = await res2.json();
    if (data2.data && data2.data[0]) {
      state.fearGreed = { value: parseInt(data2.data[0].value), label: data2.data[0].value_classification };
    }
  } catch(e) {}

  renderHome(); // update F&G display
}

// ── THEME ───────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('ss_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ss_theme', next);
  });
}

// ── NAVIGATION ──────────────────────────────────────
function initNav() {
  function switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn, .mm-item').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('tab-' + tab);
    if (panel) panel.classList.add('active');
    document.querySelectorAll('[data-tab="'+tab+'"]').forEach(b => b.classList.add('active'));
    closeMobileMenu();
  }
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').hidden = false;
  });
  document.getElementById('mmClose').addEventListener('click', closeMobileMenu);
}
function closeMobileMenu() { document.getElementById('mobileMenu').hidden = true; }

// ── CONTROLS ────────────────────────────────────────
function initControls() {
  document.getElementById('refreshBtn').addEventListener('click', () => {
    toast('Refreshing...','');
    generateSimulatedData();
    processSignals();
    generateWhaleAlerts();
    generateFearGreed();
    renderAll();
    logDecisions();
    updateStats();
    fetchLiveData();
  });
  document.getElementById('autoRefresh').addEventListener('change', e => {
    e.target.checked ? startAutoRefresh() : stopAutoRefresh();
  });
}
function startAutoRefresh() {
  stopAutoRefresh();
  state.autoTimer = setInterval(() => {
    generateSimulatedData();
    processSignals();
    generateWhaleAlerts();
    generateFearGreed();
    renderAll();
    logDecisions();
    updateStats();
    fetchLiveData();
  }, REFRESH_MS);
}
function stopAutoRefresh() { if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; } }

// ── SIGNAL ENGINE (7 streams) ───────────────────────
function processSignals() {
  Object.keys(state.coins).forEach(c => {
    const d = state.coins[c];
    if (!d || !d.price) return;
    const momentum = d.change24h;
    const momScore = clamp(momentum / 10, -1, 1);
    const range = d.high && d.low ? (d.high - d.low) / d.price : 0.04;
    const volScore = range > 0.08 ? -0.3 : range < 0.03 ? 0.3 : 0;
    const volNorm = Math.min(d.vol / 1e9, 1);
    const volSignal = volNorm > 0.5 ? 0.2 : -0.1;
    const sentiment = generateSentiment(c, d.change24h);
    const mid = (d.high + d.low) / 2;
    const reversion = mid > 0 ? (mid - d.price) / mid : 0;
    const revScore = clamp(reversion * 5, -1, 1);
    const trend = d.change24h > 2 ? 0.4 : d.change24h < -2 ? -0.4 : 0;
    const whaleSignal = Math.random() > 0.8 ? (Math.random() > 0.5 ? 0.5 : -0.5) : 0;
    const composite = momScore*0.25 + volScore*0.1 + volSignal*0.1 + sentiment*0.2 + revScore*0.15 + trend*0.1 + whaleSignal*0.1;
    let decision, conf;
    if (composite > 0.2) { decision = 'BUY'; conf = Math.min(Math.abs(composite)*100, 95); }
    else if (composite < -0.2) { decision = 'SELL'; conf = Math.min(Math.abs(composite)*100, 95); }
    else { decision = 'HOLD'; conf = 50 + Math.abs(composite)*50; }
    d.signals = { momentum: momScore, volatility: volScore, volume: volSignal, sentiment, reversion: revScore, trend, whale: whaleSignal };
    d.composite = composite;
    d.decision = decision;
    d.conf = Math.round(conf);
    d.reasoning = buildReasoning(c, d);
  });
}
function generateSentiment(coin, change) {
  const base = clamp(change / 15, -1, 1);
  const noise = (Math.random() - 0.5) * 0.4;
  return clamp(base + noise, -1, 1);
}
function buildReasoning(coin, d) {
  const p = [];
  if (d.signals.momentum > 0.3) p.push('Strong upward momentum');
  else if (d.signals.momentum < -0.3) p.push('Downward pressure');
  if (d.signals.sentiment > 0.3) p.push('Positive sentiment');
  else if (d.signals.sentiment < -0.3) p.push('Negative sentiment');
  if (d.signals.whale > 0.3) p.push('Whale accumulation');
  else if (d.signals.whale < -0.3) p.push('Whale distribution');
  if (d.signals.reversion > 0.3) p.push('Oversold — mean reversion likely');
  else if (d.signals.reversion < -0.3) p.push('Overbought — correction risk');
  if (!p.length) p.push('Mixed signals — no clear direction');
  return p.join('. ') + '.';
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── WHALE ALERTS ────────────────────────────────────
function generateWhaleAlerts() {
  const count = Math.floor(Math.random() * 4) + 1;
  state.whaleAlerts = [];
  for (let i = 0; i < count; i++) {
    const coin = COINS[Math.floor(Math.random() * 10)];
    const d = state.coins[coin];
    if (!d) continue;
    const isBuy = Math.random() > 0.45;
    const amount = (Math.random() * 500 + 10).toFixed(1);
    const usd = (parseFloat(amount) * d.price).toFixed(0);
    state.whaleAlerts.push({ coin, type: isBuy ? 'BUY' : 'SELL', amount: amount + ' ' + coin, usd: '$' + Number(usd).toLocaleString(), time: new Date(Date.now() - Math.random() * 3600000) });
  }
}

// ── RENDER ALL ──────────────────────────────────────
function renderAll() {
  try { renderHome(); } catch(e) { console.error('renderHome error:', e); }
  try { renderMarkets(); } catch(e) { console.error('renderMarkets error:', e); }
  try { renderTrade(); } catch(e) { console.error('renderTrade error:', e); }
  try { renderRisk(); } catch(e) { console.error('renderRisk error:', e); }
  try { renderLog(); } catch(e) { console.error('renderLog error:', e); }
}

// ── HOME ────────────────────────────────────────────
function renderHome() {
  const statsEl = document.getElementById('homeStats');
  const coins = Object.keys(state.coins);
  const buys = coins.filter(c => state.coins[c]?.decision === 'BUY').length;
  const sells = coins.filter(c => state.coins[c]?.decision === 'SELL').length;
  const holds = coins.filter(c => state.coins[c]?.decision === 'HOLD').length;
  const fg = state.fearGreed;

  statsEl.innerHTML = `
    <div class="stat-card"><span class="sc-label">Mode</span><strong class="sc-val sim">SIMULATION</strong></div>
    <div class="stat-card"><span class="sc-label">Coins Tracked</span><strong class="sc-val">${coins.length}</strong></div>
    <div class="stat-card"><span class="sc-label">BUY Signals</span><strong class="sc-val buy-c">${buys}</strong></div>
    <div class="stat-card"><span class="sc-label">SELL Signals</span><strong class="sc-val sell-c">${sells}</strong></div>
    <div class="stat-card"><span class="sc-label">HOLD Signals</span><strong class="sc-val hold-c">${holds}</strong></div>
    <div class="stat-card"><span class="sc-label">Fear & Greed</span><strong class="sc-val" style="color:${fg ? fgColor(fg.value) : 'inherit'}">${fg ? fg.value + ' — ' + fg.label : '—'}</strong></div>
    <div class="stat-card"><span class="sc-label">Whale Alerts</span><strong class="sc-val">${state.whaleAlerts.length}</strong></div>
    <div class="stat-card"><span class="sc-label">Last Update</span><strong class="sc-val">${new Date().toLocaleTimeString()}</strong></div>
  `;

  // Top BUY/SELL
  const sorted = coins.filter(c => state.coins[c]?.decision).sort((a, b) => state.coins[b].conf - state.coins[a].conf);
  const topBuys = sorted.filter(c => state.coins[c].decision === 'BUY').slice(0, 6);
  const topSells = sorted.filter(c => state.coins[c].decision === 'SELL').slice(0, 6);

  document.getElementById('homeBuys').innerHTML = topBuys.length ? topBuys.map(c => {
    const d = state.coins[c];
    return `<li><span class="sig-coin">${c}</span><span class="sig-conf buy">${d.conf}% · $${fmtPrice(d.price)} · <span style="color:${d.change24h>=0?'var(--green)':'var(--red)'}">${d.change24h>=0?'+':''}${d.change24h.toFixed(1)}%</span></span></li>`;
  }).join('') : '<li style="color:var(--fg3)">No BUY signals right now</li>';

  document.getElementById('homeSells').innerHTML = topSells.length ? topSells.map(c => {
    const d = state.coins[c];
    return `<li><span class="sig-coin">${c}</span><span class="sig-conf sell">${d.conf}% · $${fmtPrice(d.price)} · <span style="color:${d.change24h>=0?'var(--green)':'var(--red)'}">${d.change24h>=0?'+':''}${d.change24h.toFixed(1)}%</span></span></li>`;
  }).join('') : '<li style="color:var(--fg3)">No SELL signals right now</li>';

  // Fear & Greed gauge
  const fgEl = document.getElementById('fgGauge');
  if (fg) {
    const col = fgColor(fg.value);
    fgEl.innerHTML = `<div class="fg-value" style="color:${col}">${fg.value}</div><div><div class="fg-label" style="color:${col};font-weight:700;font-size:1.2rem">${fg.label}</div><div class="fg-label">Market Sentiment Index (0-100)</div></div>`;
  }

  // Whale Feed
  document.getElementById('whaleFeed').innerHTML = state.whaleAlerts.length ? state.whaleAlerts.map(w => `
    <div class="whale-item">
      <div class="whale-icon">${w.type === 'BUY' ? '🐋' : '📤'}</div>
      <span class="whale-coin">${w.coin}</span>
      <span class="whale-amount" style="color:${w.type==='BUY'?'var(--green)':'var(--red)'}">${w.type} ${w.amount}</span>
      <span style="color:var(--fg2)">(${w.usd})</span>
      <span class="whale-time">${timeAgo(w.time)}</span>
    </div>
  `).join('') : '<div style="color:var(--fg3);padding:12px">No whale alerts</div>';
}

function fgColor(v) { return v<=25?'var(--red)':v<=45?'#ff8c00':v<=55?'var(--yellow)':v<=75?'#90ee90':'var(--green)'; }

// ── MARKETS ─────────────────────────────────────────
function renderMarkets() {
  const list = document.getElementById('coinList');
  const search = (document.getElementById('searchInput').value || '').toUpperCase();
  const filter = state.marketFilter;

  const coins = Object.keys(state.coins)
    .filter(c => !search || c.includes(search))
    .filter(c => filter === 'ALL' || state.coins[c]?.decision === filter)
    .sort((a, b) => (state.coins[b]?.vol || 0) - (state.coins[a]?.vol || 0));

  list.innerHTML = coins.map(c => {
    const d = state.coins[c] || {};
    const ch = d.change24h || 0;
    const active = state.selectedCoin === c ? ' active' : '';
    return `<div class="coin-item${active}" data-coin="${c}">
      <span class="ci-name">${c}</span>
      <span class="ci-price">$${fmtPrice(d.price||0)}</span>
      <span class="ci-change ${ch>=0?'up':'down'}">${ch>=0?'+':''}${ch.toFixed(2)}%</span>
    </div>`;
  }).join('') || '<div style="padding:20px;color:var(--fg3);text-align:center">No coins match filter</div>';

  list.querySelectorAll('.coin-item').forEach(el => {
    el.addEventListener('click', () => selectCoin(el.dataset.coin));
  });

  document.querySelectorAll('.mf-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.mf-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.marketFilter = b.dataset.mfilter;
      renderMarkets();
    };
  });

  document.getElementById('searchInput').oninput = () => renderMarkets();

  if (!state.selectedCoin && coins.length) selectCoin(coins[0]);
}

function selectCoin(coin) {
  state.selectedCoin = coin;
  document.querySelectorAll('.coin-item').forEach(el => el.classList.toggle('active', el.dataset.coin === coin));
  renderCoinDetail(coin);
}

function renderCoinDetail(coin) {
  const panel = document.getElementById('detailPanel');
  const d = state.coins[coin];
  if (!d) { panel.innerHTML = '<div class="loading">No data</div>'; return; }
  const ch = d.change24h || 0;
  const sig = d.signals || {};
  const bars = [
    ['Momentum', sig.momentum], ['Sentiment', sig.sentiment], ['Volume', sig.volume],
    ['Reversion', sig.reversion], ['Trend', sig.trend], ['Whale', sig.whale], ['Volatility', sig.volatility]
  ];
  panel.innerHTML = `
    <div class="detail-head">
      <div><h3>${coin}/USDT</h3><div class="detail-change ${ch>=0?'buy-c':'sell-c'}">${ch>=0?'+':''}${ch.toFixed(2)}% (24h)</div></div>
      <div style="text-align:right"><div class="detail-price">$${fmtPrice(d.price)}</div><div class="decision-badge ${d.decision}">${d.decision} · ${d.conf}%</div></div>
    </div>
    <div class="signal-bars">
      ${bars.map(([label, val]) => {
        const v = val || 0;
        const pct = Math.abs(v * 50 + 50);
        const col = v > 0.1 ? 'var(--green)' : v < -0.1 ? 'var(--red)' : 'var(--yellow)';
        return `<div class="sig-bar"><div class="sig-bar-label">${label}</div><div class="sig-bar-val">${v.toFixed(2)}</div><div class="sig-bar-meter"><div class="sig-bar-fill" style="width:${pct}%;background:${col}"></div></div></div>`;
      }).join('')}
    </div>
    <div style="margin-top:14px;padding:12px;background:var(--bg3);border-radius:6px;font-size:.8rem;line-height:1.6">
      <strong>Agent Reasoning:</strong> ${d.reasoning}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="primary" onclick="openTradeModal('${coin}','buy')">Buy ${coin}</button>
      <button class="danger" onclick="openTradeModal('${coin}','sell')">Sell ${coin}</button>
    </div>
  `;
}

// ── TRADE ───────────────────────────────────────────
function initTrade() {
  document.getElementById('setupConfirm').addEventListener('click', () => {
    const bal = parseFloat(document.getElementById('setupBalance').value) || 10000;
    state.wallet = { cash: bal, startBalance: bal };
    document.getElementById('demoSetup').hidden = true;
    document.getElementById('demoBody').hidden = false;
    renderTrade();
    toast('Demo wallet: $' + bal.toLocaleString(), 'success');
    saveState();
  });
  document.querySelectorAll('.setup-presets button').forEach(b => {
    b.addEventListener('click', () => { document.getElementById('setupBalance').value = b.dataset.preset; });
  });
  document.querySelectorAll('.mode-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.tradeMode = b.dataset.mode;
      document.getElementById('launchTitle').textContent = 'Trade — ' + (state.tradeMode === 'spot' ? 'Spot' : 'Futures');
      renderTradeCoinGrid();
    });
  });
  document.getElementById('resetWallet').addEventListener('click', () => {
    state.wallet = null; state.trades = []; state.history = [];
    document.getElementById('demoSetup').hidden = false;
    document.getElementById('demoBody').hidden = true;
    saveState(); toast('Wallet reset', 'success');
  });
  document.getElementById('clearHistory').addEventListener('click', () => {
    state.history = []; renderTradeHistory(); renderStats(); saveState();
  });
  document.querySelectorAll('.pos-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.pos-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); renderPositions(b.dataset.pos);
    });
  });
  document.querySelectorAll('.stats-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.stats-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); renderStats(b.dataset.stats);
    });
  });
  document.getElementById('tradeSearch').addEventListener('input', renderTradeCoinGrid);
  if (state.wallet) {
    document.getElementById('demoSetup').hidden = true;
    document.getElementById('demoBody').hidden = false;
  }
}

function renderTrade() {
  if (!state.wallet) return;
  renderWallet(); renderTradeCoinGrid(); renderPositions(); renderTradeHistory(); renderStats();
}
function renderWallet() {
  if (!state.wallet) return;
  const eq = calcEquity();
  const pnl = eq - state.wallet.startBalance;
  const pct = (pnl / state.wallet.startBalance) * 100;
  document.getElementById('wTotal').textContent = '$' + fmtNum(eq);
  document.getElementById('wReturn').textContent = (pnl>=0?'+':'') + pct.toFixed(2) + '%';
  document.getElementById('wReturn').style.color = pnl>=0?'var(--green)':'var(--red)';
  document.getElementById('wCash').textContent = '$' + fmtNum(state.wallet.cash);
  document.getElementById('wPnl').textContent = (pnl>=0?'+':'') + '$' + fmtNum(Math.abs(pnl));
  document.getElementById('wPnl').style.color = pnl>=0?'var(--green)':'var(--red)';
  document.getElementById('wPnlPct').textContent = (pnl>=0?'+':'') + pct.toFixed(2) + '%';
  document.getElementById('wPnlPct').style.color = pnl>=0?'var(--green)':'var(--red)';
  state.pnlHistory.push({ time: Date.now(), equity: eq });
  if (eq > state.peakEquity) state.peakEquity = eq;
}
function calcEquity() {
  if (!state.wallet) return 0;
  let eq = state.wallet.cash;
  state.trades.forEach(t => {
    const d = state.coins[t.coin];
    const cur = d ? d.price : t.entry;
    if (t.type === 'spot') eq += t.amount * cur;
    else {
      const dir = t.side === 'long' ? 1 : -1;
      eq += t.amount * t.entry + (cur - t.entry) * t.amount * (t.leverage||1) * dir;
    }
  });
  return eq;
}
function renderTradeCoinGrid() {
  const grid = document.getElementById('tradeCoinGrid');
  const search = (document.getElementById('tradeSearch').value || '').toUpperCase();
  grid.innerHTML = COINS.filter(c => !search || c.includes(search)).map(c => {
    const d = state.coins[c] || {};
    return `<button class="trade-coin-btn" onclick="openTradeModal('${c}')">${c}<br><span style="font-size:.65rem;color:var(--fg2)">$${fmtPrice(d.price||0)}</span></button>`;
  }).join('');
}

window.openTradeModal = function(coin, forceSide) {
  if (!state.wallet) { toast('Create demo wallet first','error'); return; }
  const d = state.coins[coin]; if (!d) return;
  const isFut = state.tradeMode === 'futures';
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-box">
    <h3>Trade ${coin}/USDT ${isFut?'(Futures)':'(Spot)'}</h3>
    <div class="modal-field"><label>Side</label><select id="mSide">${isFut?'<option value="long">Long</option><option value="short">Short</option>':'<option value="buy">Buy</option><option value="sell">Sell</option>'}</select></div>
    <div class="modal-field"><label>Amount (USDT)</label><input type="number" id="mAmt" value="100" min="1"/></div>
    ${isFut?'<div class="modal-field"><label>Leverage</label><select id="mLev"><option>1</option><option>2</option><option>5</option><option selected>10</option><option>20</option></select></div>':''}
    <div style="font-size:.75rem;color:var(--fg2);margin:8px 0">Price: $${fmtPrice(d.price)} · Signal: <span class="${d.decision.toLowerCase()}-c">${d.decision} (${d.conf}%)</span></div>
    <div class="modal-actions"><button class="danger" onclick="this.closest('.modal-overlay').remove()">Cancel</button><button class="primary" id="mConfirm">Confirm</button></div>
  </div>`;
  document.getElementById('modalRoot').appendChild(modal);
  if (forceSide) { const s=modal.querySelector('#mSide'); if(isFut) s.value=forceSide==='buy'?'long':'short'; else s.value=forceSide; }
  modal.querySelector('#mConfirm').addEventListener('click', () => {
    executeTrade(coin, modal.querySelector('#mSide').value, parseFloat(modal.querySelector('#mAmt').value), isFut?parseInt(modal.querySelector('#mLev').value):1);
    modal.remove();
  });
  modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
};

function executeTrade(coin, side, usdAmt, lev) {
  const d = state.coins[coin]; if (!d || !state.wallet) return;
  const cost = Math.min(usdAmt, state.wallet.cash);
  if (cost < 1) { toast('Insufficient balance','error'); return; }
  state.wallet.cash -= cost;
  state.trades.push({ id:Date.now(), coin, type:state.tradeMode, side:state.tradeMode==='spot'?(side==='buy'?'long':'short'):side, amount:cost/d.price, entry:d.price, leverage:lev, cost, time:new Date() });
  toast(`${state.tradeMode} ${side.toUpperCase()} ${coin} @ $${fmtPrice(d.price)}`,'success');
  renderTrade(); saveState();
}

function renderPositions(filter) {
  const body = document.getElementById('positionsBody');
  const f = filter || 'all';
  const pos = state.trades.filter(t => f==='all'||t.type===f);
  if (!pos.length) { body.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--fg3);padding:20px">No open positions</td></tr>'; return; }
  body.innerHTML = pos.map(t => {
    const d = state.coins[t.coin]||{};
    const cur = d.price||t.entry;
    let pnl, pct;
    if (t.type==='spot') { pnl=(cur-t.entry)*t.amount; pct=((cur-t.entry)/t.entry)*100; }
    else { const dir=t.side==='long'?1:-1; pnl=(cur-t.entry)*t.amount*t.leverage*dir; pct=((cur-t.entry)/t.entry)*100*t.leverage*dir; }
    return `<tr><td><strong>${t.coin}</strong></td><td>${t.type.toUpperCase()}</td><td>${t.amount.toFixed(4)}</td><td>$${fmtPrice(t.entry)}</td><td>$${fmtPrice(cur)}</td><td>${t.leverage}x</td><td>$${fmtNum(t.amount*cur)}</td><td style="color:${pnl>=0?'var(--green)':'var(--red)'}">${pnl>=0?'+':''}$${fmtNum(Math.abs(pnl))}</td><td style="color:${pct>=0?'var(--green)':'var(--red)'}">${pct>=0?'+':''}${pct.toFixed(2)}%</td><td><button class="close-btn" onclick="closePosition(${t.id})">Close</button></td></tr>`;
  }).join('');
}

window.closePosition = function(id) {
  const idx = state.trades.findIndex(t=>t.id===id); if (idx===-1) return;
  const t = state.trades[idx];
  const d = state.coins[t.coin]||{};
  const cur = d.price||t.entry;
  let pnl;
  if (t.type==='spot') pnl=(cur-t.entry)*t.amount;
  else { const dir=t.side==='long'?1:-1; pnl=(cur-t.entry)*t.amount*t.leverage*dir; }
  state.wallet.cash += t.amount*t.entry+pnl;
  state.history.push({...t, exit:cur, pnl, pnlPct:(pnl/t.cost)*100, closeTime:new Date(), status:pnl>=0?'WIN':'LOSS'});
  state.trades.splice(idx,1);
  toast(`Closed ${t.coin}: ${pnl>=0?'+':''}$${fmtNum(Math.abs(pnl))}`, pnl>=0?'success':'error');
  renderTrade(); saveState();
};

function renderTradeHistory() {
  const body = document.getElementById('historyBody');
  if (!state.history.length) { body.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--fg3);padding:20px">No closed trades</td></tr>'; return; }
  body.innerHTML = state.history.slice().reverse().map(t => `<tr><td>${new Date(t.closeTime||t.time).toLocaleTimeString()}</td><td><strong>${t.coin}</strong></td><td>${t.type.toUpperCase()}</td><td>$${fmtPrice(t.entry)}</td><td>$${fmtPrice(t.exit)}</td><td>${t.leverage}x</td><td style="color:${t.pnl>=0?'var(--green)':'var(--red)'}">${t.pnl>=0?'+':''}$${fmtNum(Math.abs(t.pnl))}</td><td style="color:${t.pnlPct>=0?'var(--green)':'var(--red)'}">${t.pnlPct>=0?'+':''}${t.pnlPct.toFixed(2)}%</td><td style="color:${t.status==='WIN'?'var(--green)':'var(--red)'}">${t.status}</td></tr>`).join('');
}

function renderStats(mode) {
  const m = mode||'spot';
  const trades = state.history.filter(t=>t.type===m);
  const wins = trades.filter(t=>t.pnl>0);
  const losses = trades.filter(t=>t.pnl<=0);
  const totalPnl = trades.reduce((s,t)=>s+t.pnl,0);
  const avgWin = wins.length?wins.reduce((s,t)=>s+t.pnl,0)/wins.length:0;
  const avgLoss = losses.length?Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length):0;
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-mini"><span class="sm-label">Trades</span><span class="sm-val">${trades.length}</span></div>
    <div class="stat-mini"><span class="sm-label">Win Rate</span><span class="sm-val">${trades.length?((wins.length/trades.length)*100).toFixed(1)+'%':'—'}</span></div>
    <div class="stat-mini"><span class="sm-label">Total P/L</span><span class="sm-val" style="color:${totalPnl>=0?'var(--green)':'var(--red)'}">${totalPnl>=0?'+':''}$${fmtNum(Math.abs(totalPnl))}</span></div>
    <div class="stat-mini"><span class="sm-label">Avg Win</span><span class="sm-val buy-c">$${fmtNum(avgWin)}</span></div>
    <div class="stat-mini"><span class="sm-label">Avg Loss</span><span class="sm-val sell-c">$${fmtNum(avgLoss)}</span></div>
    <div class="stat-mini"><span class="sm-label">Profit Factor</span><span class="sm-val">${avgLoss>0?(avgWin/avgLoss).toFixed(2):'—'}</span></div>
  `;
}

// ── RISK ────────────────────────────────────────────
function renderRisk() {
  const eq = state.wallet ? calcEquity() : 10000;
  const start = state.wallet ? state.wallet.startBalance : 10000;
  const returns = [];
  for (let i=1;i<state.pnlHistory.length;i++) returns.push((state.pnlHistory[i].equity-state.pnlHistory[i-1].equity)/state.pnlHistory[i-1].equity);
  const avgR = returns.length?returns.reduce((a,b)=>a+b,0)/returns.length:0;
  const std = returns.length>1?Math.sqrt(returns.reduce((s,r)=>s+(r-avgR)**2,0)/(returns.length-1)):0.02;
  const var95 = eq*(avgR-1.645*std);
  let peak=start, maxDD=0;
  const ddPts=[{time:0,dd:0}];
  state.pnlHistory.forEach(p=>{if(p.equity>peak)peak=p.equity;const dd=((peak-p.equity)/peak)*100;if(dd>maxDD)maxDD=dd;ddPts.push({time:p.time,dd});});
  const sharpe = std>0?(avgR/std)*Math.sqrt(365):0;
  const exposure = state.wallet?((state.wallet.startBalance-state.wallet.cash)/state.wallet.startBalance)*100:0;

  document.getElementById('riskVar').textContent='$'+fmtNum(Math.abs(Math.min(var95,0)));
  document.getElementById('riskVar').style.color=var95<0?'var(--red)':'var(--green)';
  document.getElementById('riskDD').textContent=maxDD.toFixed(2)+'%';
  document.getElementById('riskDD').style.color=maxDD>10?'var(--red)':maxDD>5?'var(--yellow)':'var(--green)';
  document.getElementById('riskSharpe').textContent=sharpe.toFixed(2);
  document.getElementById('riskSharpe').style.color=sharpe>1?'var(--green)':sharpe>0?'var(--yellow)':'var(--red)';
  document.getElementById('riskExposure').textContent=exposure.toFixed(1)+'%';
  document.getElementById('riskExposure').style.color=exposure>80?'var(--red)':exposure>50?'var(--yellow)':'var(--green)';

  renderDrawdownChart(ddPts);
  renderRadarChart();
  renderRiskAlerts(maxDD, exposure, var95);
}

function renderDrawdownChart(pts) {
  const c=document.getElementById('drawdownChart'); if(!c||typeof Chart==='undefined')return;
  if(c._chart)c._chart.destroy();
  c._chart=new Chart(c.getContext('2d'),{type:'line',data:{labels:pts.map((_,i)=>i),datasets:[{label:'Drawdown %',data:pts.map(p=>-p.dd),borderColor:'#ff4757',backgroundColor:'rgba(255,71,87,0.1)',fill:true,tension:0.3,pointRadius:0}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#8892a4',callback:v=>v.toFixed(1)+'%'}}}}});
}

function renderRadarChart() {
  const c=document.getElementById('radarChart'); if(!c||typeof Chart==='undefined')return;
  if(c._chart)c._chart.destroy();
  const labels=['Momentum','Sentiment','Volume','Reversion','Trend','Whale'];
  const keys=['momentum','sentiment','volume','reversion','trend','whale'];
  const vals=keys.map(k=>{const coins=Object.values(state.coins).filter(c=>c.signals);if(!coins.length)return 0;return Math.abs(coins.reduce((s,c)=>s+(c.signals[k]||0),0)/coins.length)*100;});
  c._chart=new Chart(c.getContext('2d'),{type:'radar',data:{labels,datasets:[{label:'Signal Strength',data:vals,borderColor:'#00ffa3',backgroundColor:'rgba(0,255,163,0.1)',pointBackgroundColor:'#00ffa3',pointRadius:3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{r:{grid:{color:'rgba(255,255,255,0.06)'},angleLines:{color:'rgba(255,255,255,0.06)'},ticks:{display:false},pointLabels:{color:'#8892a4',font:{size:10}}}}}});
}

function renderRiskAlerts(maxDD, exposure, var95) {
  const a=[];
  if(maxDD>15)a.push({l:'crit',i:'⛔',m:`Max drawdown ${maxDD.toFixed(1)}% exceeds 15% limit`});
  else if(maxDD>8)a.push({l:'warn',i:'⚠️',m:`Drawdown at ${maxDD.toFixed(1)}% — approaching limit`});
  else a.push({l:'ok',i:'✅',m:`Drawdown ${maxDD.toFixed(1)}% — safe`});
  if(exposure>80)a.push({l:'crit',i:'⛔',m:`${exposure.toFixed(0)}% deployed — over-allocated`});
  else if(exposure>50)a.push({l:'warn',i:'⚠️',m:`${exposure.toFixed(0)}% deployed — moderate`});
  else a.push({l:'ok',i:'✅',m:`${exposure.toFixed(0)}% deployed — conservative`});
  a.push({l:state.trades.length>10?'warn':'ok',i:state.trades.length>10?'⚠️':'✅',m:`${state.trades.length} open positions`});
  const fg=state.fearGreed?.value||50;
  if(fg<20)a.push({l:'warn',i:'⚠️',m:`Extreme fear (${fg}) — opportunity or decline`});
  else if(fg>80)a.push({l:'warn',i:'⚠️',m:`Extreme greed (${fg}) — overextended`});
  else a.push({l:'ok',i:'✅',m:`Sentiment neutral (${fg})`});
  document.getElementById('riskAlerts').innerHTML=a.map(x=>`<div class="risk-alert ${x.l}"><span class="risk-alert-icon">${x.i}</span><span>${x.m}</span></div>`).join('');
}

// ── DECISION LOG ────────────────────────────────────
function logDecisions() {
  const now=new Date();
  Object.keys(state.coins).forEach(c=>{
    const d=state.coins[c]; if(!d?.decision)return;
    state.decisionLog.push({time:now,coin:c,action:d.decision,conf:d.conf,price:d.price,change24h:d.change24h,sentiment:(d.signals?.sentiment||0).toFixed(2),reasoning:d.reasoning});
  });
  if(state.decisionLog.length>5000)state.decisionLog=state.decisionLog.slice(-5000);
}

function initLog() {
  document.querySelectorAll('.time-btn').forEach(b=>{b.addEventListener('click',()=>{document.querySelectorAll('.time-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.logFilters.time=b.dataset.time;renderLog();});});
  document.querySelectorAll('.action-btn').forEach(b=>{b.addEventListener('click',()=>{b.classList.toggle('active');renderLog();});});
  document.getElementById('coinFilter').addEventListener('change',e=>{state.logFilters.coin=e.target.value;renderLog();});
  document.getElementById('downloadCsv').addEventListener('click',()=>{
    const h='Time,Coin,Action,Conf,Price,24h%,Sentiment,Reasoning\n';
    const r=state.decisionLog.map(d=>`"${new Date(d.time).toISOString()}","${d.coin}","${d.action}",${d.conf},${d.price},${d.change24h},${d.sentiment},"${d.reasoning}"`).join('\n');
    dlFile(h+r,'signalsage_log.csv','text/csv');
  });
  document.getElementById('downloadJson').addEventListener('click',()=>{dlFile(JSON.stringify(state.decisionLog,null,2),'signalsage_log.json','application/json');});
  document.getElementById('clearLog').addEventListener('click',()=>{state.decisionLog=[];renderLog();saveState();});
}

function renderLog() {
  const sel=document.getElementById('coinFilter');
  const cv=sel.value;
  const coins=[...new Set(state.decisionLog.map(d=>d.coin))].sort();
  sel.innerHTML='<option value="">All coins</option>'+coins.map(c=>`<option value="${c}"${c===cv?' selected':''}>${c}</option>`).join('');
  let log=[...state.decisionLog];
  const now=Date.now();
  const tm={'1h':3600000,'6h':21600000,'24h':86400000,'7d':604800000};
  if(state.logFilters.time!=='all'&&tm[state.logFilters.time]){const cut=now-tm[state.logFilters.time];log=log.filter(d=>new Date(d.time).getTime()>cut);}
  if(state.logFilters.coin)log=log.filter(d=>d.coin===state.logFilters.coin);
  const aa=[];document.querySelectorAll('.action-btn.active').forEach(b=>aa.push(b.dataset.action));
  if(!aa.includes('ALL'))log=log.filter(d=>aa.includes(d.action));
  document.getElementById('totalCount').textContent=state.decisionLog.length;
  document.getElementById('filteredCount').textContent=log.length;
  const recent=log.slice(-100).reverse();
  document.getElementById('logBody').innerHTML=recent.length?recent.map(d=>`<tr><td>${new Date(d.time).toLocaleString()}</td><td><strong>${d.coin}</strong></td><td><span class="decision-badge ${d.action}" style="font-size:.7rem;padding:2px 8px">${d.action}</span></td><td>${d.conf}%</td><td>$${fmtPrice(d.price)}</td><td style="color:${d.change24h>=0?'var(--green)':'var(--red)'}">${d.change24h>=0?'+':''}${d.change24h.toFixed(2)}%</td><td>${d.sentiment}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.reasoning)}">${d.reasoning}</td></tr>`).join(''):'<tr><td colspan="8" style="text-align:center;color:var(--fg3);padding:20px">No decisions yet</td></tr>';
}

function dlFile(content,name,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);toast('Downloaded '+name,'success');}

// ── AI CHAT ─────────────────────────────────────────
function initChat() {
  document.getElementById('chatForm').addEventListener('submit',e=>{
    e.preventDefault();
    const inp=document.getElementById('chatInput');
    const q=inp.value.trim(); if(!q)return;
    addMsg('user',q); inp.value='';
    setTimeout(()=>addMsg('agent',aiResponse(q)),400);
  });
  document.querySelectorAll('.chip[data-q]').forEach(b=>{
    b.addEventListener('click',()=>{addMsg('user',b.dataset.q);setTimeout(()=>addMsg('agent',aiResponse(b.dataset.q)),400);});
  });
  document.getElementById('clearChat').addEventListener('click',()=>{document.getElementById('chatThread').innerHTML='';});
  addMsg('agent',"Hi — I'm <strong>SignalSage</strong>. I analyze 34 crypto pairs using 7 fused signal streams. Ask me about any coin, market overview, whale alerts, risk, or best entries.");
}

function addMsg(role,html){const t=document.getElementById('chatThread');const d=document.createElement('div');d.className='chat-msg '+role;d.innerHTML=`<div class="chat-bubble">${html}</div>`;t.appendChild(d);t.scrollTop=t.scrollHeight;}

function aiResponse(q) {
  const ql=q.toLowerCase();
  const coins=Object.keys(state.coins);

  if(ql.includes('overview')||ql.includes('market')||ql.includes('summary')){
    const buys=coins.filter(c=>state.coins[c]?.decision==='BUY');
    const sells=coins.filter(c=>state.coins[c]?.decision==='SELL');
    const fg=state.fearGreed;
    return `<strong>Market Overview</strong><br>Tracking <strong>${coins.length}</strong> coins. <span class="buy-c">${buys.length} BUY</span>, <span class="hold-c">${coins.length-buys.length-sells.length} HOLD</span>, <span class="sell-c">${sells.length} SELL</span>.<br>${fg?`Fear & Greed: <strong>${fg.value}</strong> (${fg.label}).`:''}<br>${state.whaleAlerts.length?'<br><strong>Whale Activity:</strong><br>'+state.whaleAlerts.map(w=>`• ${w.type} ${w.amount} ${w.coin} (${w.usd})`).join('<br>'):''}<br><br>Top: ${buys.slice(0,3).map(c=>`${c}(${state.coins[c].conf}%)`).join(', ')||'None'}.`;
  }
  if(ql.includes('whale')){
    return state.whaleAlerts.length?'<strong>Whale Alerts:</strong><br>'+state.whaleAlerts.map(w=>`• <span class="${w.type==='BUY'?'buy-c':'sell-c'}">${w.type}</span> ${w.amount} ${w.coin} (${w.usd}) — ${timeAgo(w.time)}`).join('<br>'):'No whale alerts right now.';
  }
  if(ql.includes('risk')){
    const eq=state.wallet?calcEquity():10000;
    const exp=state.wallet?((state.wallet.startBalance-state.wallet.cash)/state.wallet.startBalance*100):0;
    return `<strong>Risk Assessment</strong><br>• Positions: ${state.trades.length}<br>• Exposure: ${exp.toFixed(1)}%<br>• Equity: $${fmtNum(eq)}<br>• Fear & Greed: ${state.fearGreed?.value||'—'} (${state.fearGreed?.label||'—'})<br>• Regime: ${state.fearGreed?.value>60?'Risk-on — tighter stops':state.fearGreed?.value<40?'Risk-off — defensive':'Neutral — standard'}`;
  }
  const coinMatch=coins.find(c=>ql.includes(c.toLowerCase()));
  if(coinMatch){
    const d=state.coins[coinMatch]; if(!d)return 'No data for '+coinMatch;
    if(ql.includes('vs')||ql.includes('compare')){
      const other=coins.find(c=>c!==coinMatch&&ql.includes(c.toLowerCase()));
      if(other){const d2=state.coins[other];return `<strong>${coinMatch} vs ${other}</strong><br>${coinMatch}: $${fmtPrice(d.price)} (${d.change24h>=0?'+':''}${d.change24h.toFixed(2)}%) — ${d.decision}(${d.conf}%)<br>${other}: $${fmtPrice(d2.price)} (${d2.change24h>=0?'+':''}${d2.change24h.toFixed(2)}%) — ${d2.decision}(${d2.conf}%)<br><br>${d.conf>d2.conf?coinMatch:other} has stronger signals.`;}
    }
    const s=d.signals;
    return `<strong>${coinMatch}/USDT</strong><br>Price: <strong>$${fmtPrice(d.price)}</strong> (${d.change24h>=0?'+':''}${d.change24h.toFixed(2)}%)<br>Signal: <span class="${d.decision.toLowerCase()}-c"><strong>${d.decision}</strong></span> (${d.conf}%)<br><br>Momentum: ${s.momentum.toFixed(2)} · Sentiment: ${s.sentiment.toFixed(2)} · Volume: ${s.volume.toFixed(2)} · Reversion: ${s.reversion.toFixed(2)} · Trend: ${s.trend.toFixed(2)} · Whale: ${s.whale.toFixed(2)}<br><br><em>${d.reasoning}</em>`;
  }
  if(ql.includes('entry')||ql.includes('best')||ql.includes('buy')){
    const buys=coins.filter(c=>state.coins[c]?.decision==='BUY').sort((a,b)=>state.coins[b].conf-state.coins[a].conf).slice(0,5);
    return buys.length?'<strong>Best Entries:</strong><br>'+buys.map((c,i)=>`${i+1}. <strong>${c}</strong> — $${fmtPrice(state.coins[c].price)} (${state.coins[c].change24h>=0?'+':''}${state.coins[c].change24h.toFixed(2)}%) — ${state.coins[c].conf}% conf`).join('<br>'):'No strong BUY signals right now.';
  }
  return `I can help with:<br>• <strong>Market overview</strong><br>• <strong>Any coin</strong> — e.g. "Analyze SOL"<br>• <strong>Compare</strong> — e.g. "SOL vs AVAX"<br>• <strong>Whale alerts</strong><br>• <strong>Risk assessment</strong><br>• <strong>Best entries</strong>`;
}

// ── STATS UPDATE ────────────────────────────────────
function updateStats() {
  const coins=Object.keys(state.coins);
  document.getElementById('statCoins').textContent=coins.length;
  document.getElementById('statSignals').textContent=coins.filter(c=>state.coins[c]?.composite!==undefined).length;
  document.getElementById('statDecisions').textContent=state.decisionLog.length;
  document.getElementById('statTrades').textContent=state.trades.length;
  document.getElementById('statFG').textContent=state.fearGreed?state.fearGreed.value+' '+state.fearGreed.label:'—';
  document.getElementById('statWhales').textContent=state.whaleAlerts.length;
  document.getElementById('statUpdate').textContent=new Date().toLocaleTimeString();
}

// ── PERSISTENCE ─────────────────────────────────────
function saveState(){try{localStorage.setItem('ss_state',JSON.stringify({wallet:state.wallet,trades:state.trades,history:state.history,decisionLog:state.decisionLog.slice(-500),tradeMode:state.tradeMode,pnlHistory:state.pnlHistory.slice(-200),peakEquity:state.peakEquity}));}catch(e){}}
function loadState(){try{const s=JSON.parse(localStorage.getItem('ss_state'));if(s){if(s.wallet)state.wallet=s.wallet;if(s.trades)state.trades=s.trades;if(s.history)state.history=s.history;if(s.decisionLog)state.decisionLog=s.decisionLog;if(s.tradeMode)state.tradeMode=s.tradeMode;if(s.pnlHistory)state.pnlHistory=s.pnlHistory;if(s.peakEquity)state.peakEquity=s.peakEquity;}}catch(e){}}

// ── HELPERS ─────────────────────────────────────────
function fmtPrice(n){if(n>=1000)return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});if(n>=1)return n.toFixed(2);if(n>=0.01)return n.toFixed(4);return n.toFixed(6);}
function fmtNum(n){return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
function timeAgo(d){const s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return s+'s ago';if(s<3600)return Math.floor(s/60)+'m ago';return Math.floor(s/3600)+'h ago';}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg,type){const r=document.getElementById('toastRoot');const t=document.createElement('div');t.className='toast '+(type||'');t.textContent=msg;r.appendChild(t);setTimeout(()=>t.remove(),3000);}
