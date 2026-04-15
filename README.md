# Type For Your Life

Fullstack app:

- `frontend/`: Vite client (UI + gameplay + lobby UX)
- `backend/`: Express API (rooms, players, realtime room updates via SSE, words/sequences)

## Local dev

1. Install deps:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

2. Run frontend + backend:

```bash
npm run dev
```

- Backend: `http://localhost:3001`
- Frontend (Vite): `http://localhost:5173`

## Deployment (recommended: Nginx + pm2 on a Linux VPS)

This is the simplest “one server” production setup:

- Nginx serves the built frontend (`frontend/dist`)
- Nginx reverse-proxies `/api` to the backend (Node/Express on localhost)
- pm2 keeps the backend running
- Optional: Let’s Encrypt HTTPS

### 1) Server prerequisites

On your server (Ubuntu/Debian examples), install Node.js + Nginx.

```bash
sudo apt update
sudo apt install -y nginx curl

# Install Node.js 20.x (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Process manager
sudo npm i -g pm2
```

### 2) Copy the app onto the server

From your local machine, you can use git (recommended) or `scp`.

**Option A: git clone (recommended)**

```bash
cd /var/www
sudo mkdir -p typeforyourlife
sudo chown -R "$USER":"$USER" /var/www/typeforyourlife
git clone <YOUR_REPO_URL> /var/www/typeforyourlife
cd /var/www/typeforyourlife
```

**Option B: scp**

```bash
# run this locally (adjust user/host)
scp -r . user@your-server:/var/www/typeforyourlife
```

### 3) Install dependencies + build the frontend

The frontend reads `VITE_API_BASE_URL` **at build time**.

For a single-domain deploy with Nginx proxying `/api`, set it to **`/api`**.

```bash
cd /var/www/typeforyourlife

npm ci --prefix backend
npm ci --prefix frontend

# Build frontend for production (same-origin API)
VITE_API_BASE_URL=/api npm run build --prefix frontend
```

### 4) Run the backend with pm2

The backend listens on `PORT` (defaults to `3001`).

```bash
cd /var/www/typeforyourlife/backend
PORT=3001 pm2 start src/server.js --name typeforyourlife-backend
pm2 save
pm2 startup
```

Verify it’s running:

```bash
curl -s http://127.0.0.1:3001/api/health
```

### 5) Configure Nginx (static frontend + `/api` proxy)

Create an Nginx site config (replace `example.com` with your domain; if you don’t have one, you can use the server IP in `server_name`).

```nginx
server {
  listen 80;
  server_name example.com;

  root /var/www/typeforyourlife/frontend/dist;
  index index.html;

  # Serve SPA routes
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API proxy
  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE (EventSource) needs buffering disabled
    proxy_buffering off;
    proxy_cache off;
  }
}
```

Enable it:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo tee /etc/nginx/sites-available/typeforyourlife >/dev/null <<'EOF'
<PASTE_THE_SERVER_BLOCK_HERE>
EOF
sudo ln -sf /etc/nginx/sites-available/typeforyourlife /etc/nginx/sites-enabled/typeforyourlife
sudo nginx -t
sudo systemctl reload nginx
```

### 6) Add HTTPS (Let’s Encrypt)

If you have a domain pointed at your server:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

### 7) Updates / redeploy

```bash
cd /var/www/typeforyourlife
git pull

npm ci --prefix backend
npm ci --prefix frontend
VITE_API_BASE_URL=/api npm run build --prefix frontend

pm2 restart typeforyourlife-backend
sudo systemctl reload nginx
```

## Config / environment variables

### Frontend

- **`VITE_API_BASE_URL`**: API base used by the browser.
  - Recommended in production (same domain): **`/api`**
  - Example (separate API domain): `https://api.example.com/api`

### Backend

- **`PORT`**: port for Express to listen on (default: `3001`)

## API overview

- `GET /api/health` health check
- `POST /api/rooms` create room and creator player
- `POST /api/rooms/:roomCode/join` join room
- `POST /api/rooms/:roomCode/start` start game (creator only)
- `PATCH /api/rooms/:roomCode/players/:playerId` update score/health/typing signals
- `POST /api/rooms/:roomCode/leave` leave room
- `GET /api/rooms/:roomCode/events` realtime room SSE stream
- `GET /api/words` available words pool

## Notes

- Multiplayer state currently uses **in-memory rooms** in the backend service; restarting the backend clears rooms.
- For production persistence, replace room storage with Redis/PostgreSQL.
