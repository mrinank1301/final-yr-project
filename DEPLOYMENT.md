# Deployment Guide - AWS ($100 Credits, 2+ Months)

Complete guide to deploy this video calling application on an AWS EC2 instance with Docker Compose, self-hosted LiveKit, Nginx HTTPS reverse proxy, and Let's Encrypt SSL.

---

## Architecture Overview

```
Internet
   |
   |-- HTTPS (443) --> Nginx --+-- / -----------> Frontend (Next.js :3000)
   |                           +-- /api/token --> Node Backend (Express :3001)
   |                           +-- /api/room ---> Node Backend (Express :3001)
   |                           +-- /api/* ------> Python Backend (FastAPI :5000)
   |                           +-- /ws/* -------> Python Backend WebSocket
   |                           +-- livekit.* ---> LiveKit Server (:7880)
   |
   |-- UDP (3478) -----------------> LiveKit TURN Server
   |-- TCP (5349) -----------------> LiveKit TURN TLS
   +-- UDP (50000-50200) ----------> LiveKit WebRTC Media
```

All services run in Docker containers on a single EC2 instance, orchestrated by Docker Compose.

---

## Cost Breakdown (Staying Under $50/month)

| Resource | Monthly Cost |
|----------|-------------|
| EC2 t3.medium (2 vCPU, 4GB RAM) | ~$30 |
| EBS 30 GB gp3 SSD | ~$2.40 |
| Elastic IP (attached to running instance) | ~$3.60 |
| Data transfer (first 100 GB free) | ~$0 |
| **Total** | **~$36/month** |

> **$100 / $36 = ~2.8 months** -- comfortably over 2 months.
>
> **Budget alternative**: Use `t3.small` (2 vCPU, 2GB RAM, ~$15/month) to stretch to **~4.7 months**. The deploy script automatically adds 2GB swap to handle lower RAM.

---

## Prerequisites

- An AWS account with $100 credits activated
- A domain name (cheap options: Namecheap ~$1/yr for `.xyz`, or free from Freenom)
- Your API keys ready:
  - Groq API Key (https://console.groq.com)
  - Gemini API Key (https://aistudio.google.com)
  - Azure Speech Key (Azure Portal)

---

## Step 1: Launch an EC2 Instance

1. Sign in to the **AWS Console** -> **EC2** -> **Launch Instance**

2. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `video-call-app` |
| **AMI** | Ubuntu Server 22.04 LTS (64-bit x86) |
| **Instance type** | `t3.medium` (or `t3.small` for budget) |
| **Key pair** | Create new -> Download the `.pem` file (keep it safe!) |
| **Network settings** | See Security Group below |
| **Storage** | 30 GB gp3 |

3. **Security Group** - Click "Edit" under Network settings and add these rules:

| Type | Protocol | Port Range | Source | Description |
|------|----------|-----------|--------|-------------|
| SSH | TCP | 22 | My IP | SSH access |
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP (redirects to HTTPS) |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS traffic |
| Custom UDP | UDP | 3478 | 0.0.0.0/0 | LiveKit TURN |
| Custom TCP | TCP | 5349 | 0.0.0.0/0 | LiveKit TURN TLS |
| Custom UDP | UDP | 50000-50200 | 0.0.0.0/0 | LiveKit WebRTC media |

4. Click **Launch Instance**

---

## Step 2: Allocate an Elastic IP

An Elastic IP prevents your public IP from changing on reboot.

1. Go to **EC2** -> **Elastic IPs** -> **Allocate Elastic IP address**
2. Click **Allocate**
3. Select the new IP -> **Actions** -> **Associate Elastic IP address**
4. Choose your `video-call-app` instance -> **Associate**
5. Note down this IP address (e.g., `3.xx.xx.xx`)

> An Elastic IP is free while associated with a running instance. It costs $3.60/month if the instance is stopped, so release it if you stop the VM long-term.

---

## Step 3: Configure DNS

Go to your domain registrar (Namecheap, GoDaddy, Route53, etc.) and create these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` (or `yourdomain.com`) | `YOUR_ELASTIC_IP` | 300 |
| A | `livekit` | `YOUR_ELASTIC_IP` | 300 |

This creates:
- `yourdomain.com` -> your EC2 instance
- `livekit.yourdomain.com` -> same instance (for LiveKit WebSocket)

Verify DNS propagation (wait 5-10 min):
```bash
nslookup yourdomain.com
nslookup livekit.yourdomain.com
```

---

## Step 4: SSH into Your EC2 Instance

### From Windows (PowerShell):
```powershell
# Move the key file somewhere safe and set permissions
icacls "C:\path\to\your-key.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"

ssh -i "C:\path\to\your-key.pem" ubuntu@YOUR_ELASTIC_IP
```

### From Mac/Linux:
```bash
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@YOUR_ELASTIC_IP
```

### From AWS Console:
1. Select your instance -> **Connect** -> **EC2 Instance Connect** -> **Connect**

---

## Step 5: Clone the Repository

```bash
# Install git if not present
sudo apt-get update && sudo apt-get install -y git

# Clone your repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

---

## Step 6: Run the Server Setup Script

```bash
# Make scripts executable
chmod +x scripts/deploy.sh scripts/init-ssl.sh

# Run the setup (installs Docker, firewall, security hardening, swap)
bash scripts/deploy.sh
```

This script:
- Installs Docker and Docker Compose
- Configures UFW firewall
- Hardens SSH (disables root login, password auth)
- Tunes kernel for WebRTC UDP performance
- Adds 2GB swap space (important for t3.small instances)

**After it finishes, log out and back in** for Docker group permissions:
```bash
exit
# SSH back in
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
cd YOUR_REPO
```

---

## Step 7: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Generate strong LiveKit credentials
echo "LIVEKIT_API_KEY: $(openssl rand -hex 12)"
echo "LIVEKIT_API_SECRET: $(openssl rand -hex 24)"

# Edit the .env file
nano .env
```

Fill in ALL values:
```env
DOMAIN=yourdomain.com
LIVEKIT_DOMAIN=livekit.yourdomain.com
EMAIL=your-email@example.com
PUBLIC_IP=3.xx.xx.xx               # Your Elastic IP

LIVEKIT_API_KEY=paste_generated_key
LIVEKIT_API_SECRET=paste_generated_secret

GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
SARVAM_API_KEY=your_sarvam_key
GEMINI_API_KEY=your_gemini_key
AZURE_SPEECH_KEY=your_azure_key
AZURE_SPEECH_REGION=eastasia
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

---

## Step 8: Obtain SSL Certificates

```bash
bash scripts/init-ssl.sh
```

This script:
1. Replaces domain placeholders in `nginx/nginx.conf` and `livekit.yaml`
2. Starts a temporary nginx for the Let's Encrypt ACME challenge
3. Obtains SSL certificates
4. Cleans up

> **If this fails**: Ensure DNS records point to your Elastic IP and have propagated. Test with `nslookup yourdomain.com`.

---

## Step 9: Launch the Application

```bash
# Build all images and start containers
docker compose up -d --build
```

First build takes 5-10 minutes. Subsequent starts are fast.

---

## Step 10: Verify Everything Works

```bash
# Check all containers are running and healthy
docker compose ps

# View logs for any issues
docker compose logs --tail=50

# Test health endpoints
curl -s https://yourdomain.com/health/node | head
curl -s https://yourdomain.com/health/python | head

# Check LiveKit
docker compose logs livekit --tail=20
```

Open **https://yourdomain.com** in your browser -- your app should be live!

---

## Troubleshooting

### Container not starting

```bash
# See full logs for a specific service
docker compose logs -f python-backend
docker compose logs -f node-backend
docker compose logs -f frontend
docker compose logs -f livekit
docker compose logs -f nginx

# Rebuild a single service
docker compose up -d --build python-backend
```

### SSL certificate issues

```bash
# Check if certs exist
ls certbot/conf/live/

# If init-ssl.sh failed, check DNS first
nslookup yourdomain.com
nslookup livekit.yourdomain.com

# Manually retry cert generation
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your@email.com --agree-tos --no-eff-email \
  -d yourdomain.com -d livekit.yourdomain.com
```

### LiveKit / WebRTC not connecting

```bash
# Check LiveKit is running
docker compose logs livekit

# Verify the Security Group has UDP ports open
# Go to AWS Console -> EC2 -> Security Groups -> check inbound rules

# Test TURN port from your local machine
# (PowerShell)
Test-NetConnection -ComputerName YOUR_ELASTIC_IP -Port 3478 -InformationLevel Quiet
```

### WebSocket connection errors in browser

```bash
# Check nginx logs
docker compose logs nginx --tail=50

# Common fix: restart nginx after cert renewal
docker compose restart nginx
```

### Out of memory / slow performance

```bash
# Check memory and swap usage
free -h
docker stats --no-stream

# The deploy script already adds 2GB swap, but you can add more:
sudo fallocate -l 4G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
```

### Restarting after reboot

All containers have `restart: unless-stopped`, so they auto-start on reboot. If not:
```bash
cd ~/YOUR_REPO
docker compose up -d
```

---

## Day-to-Day Maintenance

### Update the application
```bash
cd ~/YOUR_REPO
git pull origin main
docker compose up -d --build
```

### View real-time logs
```bash
docker compose logs -f                  # all services
docker compose logs -f python-backend   # specific service
```

### Restart a single service
```bash
docker compose restart node-backend
```

### SSL certificate renewal
The certbot container auto-renews every 12 hours. To force renewal:
```bash
docker compose run --rm certbot renew
docker compose exec nginx nginx -s reload
```

### Stop everything (to save costs when not using)
```bash
docker compose down
```
Then stop the EC2 instance from the AWS Console. Remember: the Elastic IP costs ~$3.60/month while the instance is stopped. Release it from **EC2 -> Elastic IPs -> Release** if stopping for a long time, and re-allocate when you restart.

---

## AWS Cost-Saving Tips

1. **Stop when not needed**: Stop the instance from AWS Console when you're done for the day. `t3.medium` costs $0.04/hr -- if you only run 12 hours/day, the cost drops to ~$15/month.

2. **Use t3.small** ($15/month instead of $30): Works fine for demos and light usage. The deploy script adds 2GB swap to compensate for lower RAM.

3. **Release Elastic IP when stopped**: If you stop the instance for days, release the Elastic IP to avoid the $3.60/month idle charge. Re-allocate a new one when you restart (you'll need to update DNS).

4. **Set a billing alarm**:
   - Go to **AWS Billing** -> **Budgets** -> **Create budget**
   - Set a monthly budget of $40 with email alerts at 80% and 100%

5. **Check your usage**:
   - **AWS Cost Explorer** shows daily spend
   - **EC2 -> Instances** shows instance uptime

---

## Security Checklist

- [x] HTTPS enforced on all endpoints (HTTP -> HTTPS redirect)
- [x] Strong SSL/TLS (TLS 1.2+ only, modern ciphers)
- [x] HSTS header enabled
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- [x] Rate limiting on API endpoints (30 req/s API, 50 req/s general)
- [x] AWS Security Group: only ports 22, 80, 443, 3478, 5349, 50000-50200 open
- [x] UFW firewall as second layer inside the VM
- [x] SSH hardened (no root login, no password auth, key-only)
- [x] Docker containers run as non-root users
- [x] API keys in .env file only (not baked into Docker images)
- [x] LiveKit credentials are strong random values
- [x] Certbot auto-renews SSL certificates
- [x] Swap space for stability under memory pressure

---

## Quick Reference Commands

```bash
# Start everything
docker compose up -d --build

# Stop everything
docker compose down

# View status
docker compose ps

# View logs
docker compose logs -f

# Restart a service
docker compose restart nginx

# Check disk space
df -h

# Check memory
free -h

# Check running containers resource usage
docker stats
```
