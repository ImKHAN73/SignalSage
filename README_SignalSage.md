# SignalSage — Multi-Signal AI Trading Agent

> **Bitget AI Base Camp Hackathon S1 · Track 1**

SignalSage is an autonomous AI trading agent that fuses **7 signal streams** — momentum, sentiment, volume, mean reversion, trend, whale activity, and volatility — into actionable trading decisions across **34 crypto pairs**. It features a professional-grade trading terminal with spot and futures paper trading, real-time risk management, and an AI-powered chat assistant.

**Live Demo:** [https://v8q8s6fx.mule.page/](https://v8q8s6fx.mule.page/)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Signal Engine](#signal-engine)
- [Installation](#installation)
- [API Integration](#api-integration)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Features

### 🏠 Dashboard
- Real-time stats: 34 coins tracked, BUY/SELL/HOLD signal counts
- Live BTC price card with 24h change
- Fear & Greed Index (live from alternative.me API)
- Top BUY and SELL signals ranked by confidence
- Whale alert feed with simulated on-chain activity
- Full-width coin grid with signal badges

### 💹 Spot Trading
- Professional order form (Limit / Market orders)
- Auto-filled price from live market data
- Real-time order summary (value, fees)
- Open Orders table with fill status
- Holdings tracker with avg price, PnL, PnL %
- One-click close positions

### ⚡ Futures Trading
- Leverage slider (1x–50x)
- Long / Short positions
- Position size calculator
- Liquidation price estimator
- Lower fees (0.04% vs 0.1% spot)
- Open positions table with ROE %

### 🛡️ Risk Management
- Portfolio VaR (95% confidence)
- Max Drawdown tracking
- Sharpe Ratio calculation
- Portfolio exposure monitoring
- Automated risk alerts (drawdown, exposure, sentiment)

### 📋 Decision Log
- Every signal across all 34 coins logged per refresh cycle
- Filter by action (BUY/HOLD/SELL)
- Export to CSV or JSON
- Timestamps, confidence scores, reasoning

### 🤖 AI Trading Assistant
- Grounded on live signal data
- Market overview, coin analysis, comparisons
- Whale alerts, risk assessment, best entries
- Natural language chat interface

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SignalSage Frontend                    │
│                  (Single HTML File)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Dashboard │  │  Spot    │  │ Futures  │  ...        │
│  │   Page    │  │ Trading  │  │ Trading  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────▼──────────────▼──────────────▼─────┐             │
│  │          State Management               │             │
│  │  (coins, trades, wallet, log, whales)   │             │
│  └────┬──────────────┬──────────────┬─────┘             │
│       │              │              │                    │
│  ┌────▼─────┐  ┌─────▼────┐  ┌─────▼─────┐             │
│  │  Signal  │  │  Order   │  │   Risk    │             │
│  │  Engine  │  │ Executor │  │  Manager  │             │
│  │ (7-stream│  │(Spot/Fut)│  │(VaR,DD,  │             │
│  │  fusion) │  │          │  │ Sharpe)   │             │
│  └────┬─────┘  └─────┬────┘  └─────┬─────┘             │
│       │              │              │                    │
│  ┌────▼──────────────▼──────────────▼─────┐             │
│  │         Data Layer (Fetch)              │             │
│  │  Bitget API  ·  Fear & Greed API       │             │
│  │  + Simulated fallback data             │             │
│  └────────────────────────────────────────┘             │
│                                                          │
│  ┌────────────────────────────────────────┐             │
│  │     Persistence (localStorage)          │             │
│  │  wallet · trades · history · log        │             │
│  └────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

---

## Signal Engine

The core of SignalSage is a **7-signal weighted fusion engine** that produces a composite score for each coin:

| Signal | Weight | Description |
|--------|--------|-------------|
| **Momentum** | 25% | 24h price change normalized to [-1, 1] |
| **Sentiment** | 20% | Simulated sentiment correlated with price action |
| **Reversion** | 15% | Mean reversion signal based on high/low midpoint |
| **Volume** | 10% | Normalized 24h volume strength |
| **Volatility** | 10% | High-low range as risk indicator |
| **Trend** | 10% | Directional persistence signal |
| **Whale** | 10% | Simulated large transaction activity |

**Decision Logic:**
- Composite > 0.2 → **BUY** (confidence = |score| × 100, capped at 95%)
- Composite < -0.2 → **SELL** (confidence = |score| × 100, capped at 95%)
- Otherwise → **HOLD** (confidence = 50 + |score| × 50)

---

## Installation

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- A local HTTP server (any static file server)
- Node.js v16+ (optional, for `npx serve`)
- Python 3.6+ (optional, for `python -m http.server`)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/signalsage.git
cd signalsage

# 2. Serve the project locally (choose one method)

# Option A: Python
python3 -m http.server 3000

# Option B: Node.js (npx)
npx serve .

# Option C: Node.js (http-server)
npx http-server . -p 3000

# 3. Open in browser
# Navigate to http://localhost:3000
```

### No Server? Open Directly

Since SignalSage is a single self-contained HTML file with no external dependencies (except Google Fonts and the Bitget API), you can also open `index.html` directly in your browser:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

> **Note:** When opening directly, some API calls may be blocked by CORS. The app will fall back to simulated data automatically.

---

## API Integration

### Bitget Public API (Live Prices)

SignalSage fetches live spot market data from Bitget's public API:

```
GET https://api.bitget.com/api/v2/spot/market/tickers
```

**Response mapping:**

| Bitget Field | SignalSage Field |
|-------------|-----------------|
| `lastPr` | Current price |
| `change24h` | 24h % change |
| `high24h` | 24h high |
| `low24h` | 24h low |
| `quoteVolume` | 24h volume (USDT) |

**Rate limits:** Bitget public API allows 20 requests/second. SignalSage refreshes every 30 seconds (well within limits).

**Timeout handling:** API calls use `AbortSignal.timeout(5000)` — if the request takes longer than 5 seconds, it falls back to simulated data.

### Fear & Greed Index API

```
GET https://api.alternative.me/fng/?limit=1
```

Returns the crypto market sentiment index (0–100):
- 0–24: Extreme Fear
- 25–49: Fear
- 50–74: Neutral
- 75–100: Greed / Extreme Greed

### Fallback Behavior

If either API is unreachable:
- **Bitget API fails** → Simulated prices based on realistic base prices for all 34 coins
- **Fear & Greed API fails** → Random value between 20–80
- The app continues to function fully with simulated data

---

## Usage Guide

### Dashboard (Home)

The dashboard provides a full-width overview:

1. **Hero Section** — Headline, description, CTA buttons, BTC price card, Fear & Greed card
2. **Stats Row** — 8 metric cards (Mode, Coins, BUY, SELL, HOLD, Fear & Greed, Whales, Updated)
3. **Top Coins Grid** — 12 coins by volume, each showing price, 24h change, signal badge
4. **Signal Panels** — Top 6 BUY and SELL signals ranked by confidence
5. **Whale Alerts** — Simulated large transactions with coin, type, amount, USD value, timestamp

### Spot Trading

1. Click **Spot** in the navigation
2. Select a coin from the pair tabs (BTC, ETH, SOL, etc.)
3. Price auto-fills from live data
4. Enter amount in USDT (default: $100)
5. Click **BUY** or **SELL**
6. View results in:
   - **Open Orders** table — shows fill status, close button
   - **My Holdings** table — shows all coins held with PnL

### Futures Trading

1. Click **Futures** in the navigation
2. Select a coin
3. Adjust **leverage** (1x–50x) using the slider
4. Enter amount in USDT
5. Click **LONG** or **SHORT**
6. View results in **Open Positions** table with ROE%, liquidation price

### Positions

1. Click **Positions** in the navigation
2. View **Portfolio Summary** (total equity, P/L %)
3. **Spot Positions** table — all open spot trades with PnL
4. **Futures Positions** table — all open futures trades with leverage, ROE%, liquidation
5. **Trade History** — all closed trades with entry/exit/PnL/status

### Risk Management

1. Click **Risk** in the navigation
2. View 4 risk cards: VaR, Max Drawdown, Sharpe Ratio, Exposure
3. Read automated risk alerts (✅ OK / ⚠️ Warning / ⛔ Critical)

### Decision Log

1. Click **Log** in the navigation
2. Filter by action (ALL / BUY / HOLD / SELL)
3. View all logged decisions with timestamps, confidence, reasoning
4. Export: **CSV** or **JSON**
5. Clear log to reset

### AI Assistant

1. Click **AI** in the navigation
2. Use quick-action chips or type a question
3. Examples:
   - "Market overview" — full market summary
   - "Should I buy BTC?" — detailed signal breakdown
   - "Compare SOL vs ETH" — head-to-head comparison
   - "Whale alerts" — recent whale activity
   - "Risk assessment" — portfolio risk analysis
   - "Best entries" — top BUY signals ranked

---

## Project Structure

```
signalsage/
├── index.html          # Complete application (HTML + CSS + JS in single file)
├── README.md           # This file
└── LICENSE             # MIT License
```

The entire application is contained in a **single `index.html` file** (~57KB) with:
- Inline CSS (~250 lines)
- Inline JavaScript (~400 lines)
- No build step required
- No npm dependencies
- No external JS libraries

---

## Configuration

### Modifying Tracked Coins

Edit the `COINS` array in the `<script>` section:

```javascript
const COINS = ['BTC', 'ETH', 'SOL', 'BNB', /* add/remove coins here */];
```

### Modifying Base Prices (Simulated Fallback)

Edit the `BASE` object:

```javascript
const BASE = {
  BTC: 67500,
  ETH: 3520,
  SOL: 148,
  // ... add base prices for any new coins
};
```

### Adjusting Signal Weights

In the `calcSignals()` function, modify the weights:

```javascript
var comp = mom * 0.25      // Momentum: 25%
         + vol * 0.1       // Volatility: 10%
         + vs * 0.1        // Volume: 10%
         + sent * 0.2      // Sentiment: 20%
         + rev * 0.15      // Reversion: 15%
         + trend * 0.1     // Trend: 10%
         + wh * 0.1;       // Whale: 10%
```

### Adjusting Decision Thresholds

```javascript
if (comp > 0.2) {        // BUY threshold (lower = more BUY signals)
  dec = 'BUY';
} else if (comp < -0.2) { // SELL threshold (higher = more SELL signals)
  dec = 'SELL';
} else {
  dec = 'HOLD';
}
```

### Refresh Interval

```javascript
setInterval(function() {
  // ... refresh logic
}, 30000);  // Change from 30000 (30s) to any value in ms
```

---

## Development

### Local Development

```bash
# Clone
git clone https://github.com/your-username/signalsage.git
cd signalsage

# Serve with hot reload (optional)
npx serve .

# Or use Python
python3 -m http.server 3000
```

### Browser DevTools

Open browser DevTools (F12) to see:
- Signal engine calculations in console
- API fetch status and errors
- State object: `console.log(coins, trades, wallet)`

### Adding New Features

Since everything is in one file, adding features is straightforward:

1. **New page/tab:** Add a `<div class="page" id="page-newtab">` in HTML and a nav button
2. **New signal:** Add to `calcSignals()` and update weights
3. **New coin:** Add to `COINS` array and `BASE` prices
4. **New API:** Add fetch call in `fetchLive()` with timeout handling

---

## Deployment

### Static Hosting (Recommended)

Since SignalSage is a single HTML file, deploy to any static host:

**Vercel:**
```bash
npm i -g vercel
vercel --prod
```

**Netlify:**
```bash
# Drag and drop the folder into Netlify dashboard
# Or use CLI:
netlify deploy --prod --dir=.
```

**GitHub Pages:**
1. Push to `main` branch
2. Settings → Pages → Source: `main` branch, root directory
3. Your site will be live at `https://username.github.io/signalsage/`

**Cloudflare Pages:**
```bash
# Connect repo in Cloudflare dashboard
# Build command: (none needed)
# Output directory: .
```

### Mule Pages

```bash
# Using MuleRun CLI
python3 publish.py ./output
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5 + CSS3 + ES6 JavaScript |
| **Styling** | Custom CSS with CSS variables, Grid, Flexbox |
| **Fonts** | Google Fonts (Inter) |
| **Data** | Bitget Public API v2, alternative.me Fear & Greed API |
| **State** | In-memory JavaScript objects |
| **Persistence** | Browser localStorage |
| **Charts** | No chart library (pure CSS/HTML visualizations) |
| **Build** | None required — single file, zero dependencies |

---

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Full support |
| Firefox 90+ | ✅ Full support |
| Safari 15+ | ✅ Full support |
| Edge 90+ | ✅ Full support |

---

## Disclaimer

> **Educational simulation only.** SignalSage is a paper trading tool built for the Bitget AI Base Camp Hackathon. No real funds are used. Signals are generated using simulated sentiment and whale data. This is not financial advice.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Acknowledgments

- **Bitget** — Public market data API
- **alternative.me** — Fear & Greed Index API
- **MuleRun** — Hosting and deployment platform
- Built for **Bitget AI Base Camp Hackathon Season 1, Track 1: Trading Agent**
