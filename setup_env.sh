# ── .env ─────────────────────────────────────────────────────────────────────
MANHEIM_CLIENT_ID=your_client_id_here
MANHEIM_CLIENT_SECRET=your_client_secret_here
ANTHROPIC_API_KEY=your_anthropic_key_here
DEAL_THRESHOLD_PCT=0.15    # flag listings 15%+ below MMR
SELL_TRIGGER_SCORE=70      # auto-trigger selling workflow at this score

# ── Backend setup ─────────────────────────────────────────────────────────────
cd backend/
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install fastapi uvicorn apscheduler httpx pydantic anthropic python-dotenv
python main.py
# Server starts at http://localhost:8000
# OpenAPI docs at http://localhost:8000/docs

# ── Chrome/Edge extension install ────────────────────────────────────────────
# 1. Go to chrome://extensions  (or edge://extensions)
# 2. Enable "Developer mode" (top right toggle)
# 3. Click "Load unpacked"
# 4. Select the /extension folder
# 5. Navigate to manheim.com — deal badges will appear on listings

# ── File structure ────────────────────────────────────────────────────────────
# manheim-deal-finder/
# ├── backend/
# │   ├── main.py
# │   ├── .env
# │   └── deals.db          (auto-created)
# └── extension/
#     ├── manifest.json
#     ├── content.js
#     ├── background.js
#     ├── overlay.css
#     ├── popup.html
#     └── icons/
#         ├── icon32.png
#         └── icon128.png

# ── Run backend as a persistent service (macOS/Linux) ─────────────────────────
# Option 1: tmux (quick)
tmux new -s manheim-backend
source venv/bin/activate && python main.py

# Option 2: launchd (macOS, starts on login)
# Create ~/Library/LaunchAgents/com.manheim.dealfinder.plist
# See: https://www.launchd.info/

# Option 3: systemd (Linux)
# sudo systemctl enable manheim-dealfinder

# ── Gmail MCP note ────────────────────────────────────────────────────────────
# The selling orchestrator calls Gmail via Claude's MCP integration.
# This requires you to be logged into Claude.ai with Gmail connected.
# The backend calls claude-sonnet-4-20250514 with mcp_servers pointing
# to https://gmail.mcp.claude.com/mcp — Claude then sends the email for you.

# ── SELECTOR UPDATES (important) ─────────────────────────────────────────────
# Manheim's DOM changes. If badges stop appearing, inspect a listing card
# and update SELECTORS in content.js to match current class names.
# The VIN fallback regex (/\b[A-HJ-NPR-Z0-9]{17}\b/) catches most cases.
