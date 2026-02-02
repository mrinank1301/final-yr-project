# Deployment: Azure VM + Docker Compose + Nginx + GitHub CI/CD

This project runs on a single Azure VM using Docker Compose, with Nginx as a reverse proxy. Pushes to `main` trigger an automatic deploy via GitHub Actions.

**Using an Azure for Students subscription?** See **[docs/AZURE-VM-STUDENT-GUIDE.md](docs/AZURE-VM-STUDENT-GUIDE.md)** for a step-by-step guide (create VM, open ports, SSH, Docker, deploy).

## Architecture

- **Nginx** (port 80): reverse proxy
  - `/` → Next.js frontend (port 3000)
  - `/api/token` → Node server (port 3001, LiveKit tokens)
  - `/api/*` (except `/api/token`) → Python server (port 5000)
  - `/ws/*` → Python server (WebSockets)
  - `/docs`, `/redoc` → Python API docs
- **Frontend**: Next.js (standalone)
- **Node**: Express, LiveKit token API
- **Python**: FastAPI, AI + code execution + WebSockets

## 1. Azure VM setup

1. Create an Ubuntu 22.04 LTS VM in Azure (e.g. Standard_B2s).
2. Open port **22** (SSH) and **80** (HTTP) in the VM’s NSG.
3. SSH into the VM and install Docker and Docker Compose:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and back in for docker without sudo
```

4. Install Git and clone the repo (replace with your repo URL and path):

```bash
sudo apt-get install -y git
mkdir -p /home/azureuser/app
cd /home/azureuser/app
git clone https://github.com/YOUR_ORG/final-yr-project.git .
```

5. Create `.env` in the app directory (same folder as `docker-compose.yml`):

```bash
nano .env
```

Use the variables from `.env.example` (see below). **Required:**

- `PUBLIC_URL` – base URL of the app (e.g. `https://yourdomain.com` or `http://YOUR_VM_PUBLIC_IP`)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

6. Build and start:

```bash
docker compose build --no-cache
docker compose up -d
```

7. (Optional) Point a domain to the VM’s public IP and use HTTPS (e.g. Certbot with Nginx).

## 2. Environment variables

Copy `.env.example` to `.env` on the VM and fill in values. Summary:

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_URL` | Yes | Base URL (e.g. `https://yourdomain.com` or `http://VM_IP`). Used by the frontend for API/WS. |
| `LIVEKIT_URL` | Yes | LiveKit server URL |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `GEMINI_API_KEY` | No | Gemini AI (optional) |
| `GROQ_API_KEY` | No | Groq AI (optional) |
| `AZURE_SPEECH_KEY` | No | Azure Speech (optional) |
| `AZURE_SPEECH_REGION` | No | Azure Speech region (optional) |

### "Failed to connect to the server" in the app

This means the **browser** could not reach the **Node** backend at `/api/token`. Check:

1. **Containers running:** `docker compose ps` — `node` and `nginx` must be Up.
2. **Same-origin:** The frontend now calls the same host you open in the browser (e.g. `http://YOUR_VM_IP`). Rebuild the frontend if you changed anything: `docker compose build --no-cache frontend && docker compose up -d`.
3. **Node env:** In `.env`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_URL` must be set; the Node container reads them.

### LiveKit (self-hosted by default)

This stack runs **self-hosted LiveKit** in Docker. No separate config file is needed: the LiveKit container uses the same `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` from `.env`.

- In `.env` set:
  - `LIVEKIT_URL=http://YOUR_VM_IP/livekit` (or `https://yourdomain.com/livekit` if you use TLS).
  - `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (any string you choose; e.g. generate random values).
- Nginx proxies `/livekit` to the LiveKit server. LiveKit runs with **host network** (no UDP port mapping) to avoid Docker proxy errors on small VMs. Open **UDP 50000–60000** in the VM’s NSG so WebRTC media works (Azure Portal → VM → Networking → Add inbound rule: UDP, port range 50000–60000).

## 3. GitHub Actions CI/CD

The workflow `.github/workflows/deploy-azure-vm.yml` runs on every push to `main` and deploys via SSH to the VM.

### GitHub secrets to add

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret | Description |
|--------|-------------|
| `AZURE_VM_HOST` | VM public IP or hostname |
| `AZURE_VM_USER` | SSH user (e.g. `azureuser`) |
| `AZURE_VM_SSH_KEY` | Full private key content (e.g. from `cat ~/.ssh/id_rsa`) |
| `AZURE_VM_SSH_PORT` | (Optional) SSH port, default 22 |
| `AZURE_VM_APP_PATH` | (Optional) App directory on VM, default `/home/azureuser/app` |

The workflow does **not** inject env vars into the VM; it only runs `git pull` and `docker compose up`. All env vars must be in the VM’s `.env` file (step 1.5 above).

### SSH key setup (one-time)

On your laptop (or wherever you run GitHub Actions from), generate a key and add the public part to the VM:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f github_actions_key -N ""
# Copy public key to VM
ssh-copy-id -i github_actions_key.pub azureuser@YOUR_VM_IP
```

In GitHub Secrets, set `AZURE_VM_SSH_KEY` to the **private** key content:

```bash
cat github_actions_key
```

(Do not commit the private key.)

## 4. Manual deploy on the VM

```bash
cd /home/azureuser/app   # or AZURE_VM_APP_PATH
git pull origin main
docker compose build --no-cache
docker compose up -d
```

## 5. Useful commands

```bash
# Logs
docker compose logs -f

# Restart one service
docker compose restart nginx

# Stop all
docker compose down
```

## 6. Nginx config

Nginx config is in `nginx/nginx.conf`. After editing, reload:

```bash
docker compose exec nginx nginx -s reload
```

Or rebuild and restart:

```bash
docker compose up -d --force-recreate nginx
```

## 7. HTTPS (optional)

For HTTPS on the VM:

1. Install Certbot on the host or in an Nginx container with cert volume.
2. Update `nginx/nginx.conf` with a `server` block listening on 443 and SSL cert paths.
3. Ensure port 443 is open in the Azure NSG.

You can also put the app behind Azure Application Gateway or another TLS termination layer and keep Nginx on 80 internally.
