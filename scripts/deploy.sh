#!/bin/bash
# ============================================================
# EC2 / VM Deployment Script
# Installs Docker, Docker Compose, configures firewall,
# adds swap, and prepares the server for the application.
# Works on Ubuntu 22.04 LTS (AWS EC2, GCP, Azure, etc.)
# ============================================================
set -euo pipefail

echo "============================================"
echo "  Video Calling App - Server Setup"
echo "============================================"

# ── 1. System update ──
echo ""
echo "[1/7] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ── 2. Install Docker ──
echo ""
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "  Docker installed. You may need to log out and back in for group changes."
else
    echo "  Docker already installed: $(docker --version)"
fi

# ── 3. Install Docker Compose (standalone, if plugin not found) ──
echo ""
echo "[3/7] Verifying Docker Compose..."
if docker compose version &> /dev/null; then
    echo "  Docker Compose plugin found: $(docker compose version)"
else
    echo "  Installing Docker Compose standalone..."
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
    sudo curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "  Docker Compose installed: $(docker-compose --version)"
fi

# ── 4. Configure UFW Firewall ──
echo ""
echo "[4/7] Configuring firewall (UFW)..."
sudo apt-get install -y ufw

sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (essential - don't lock yourself out!)
sudo ufw allow 22/tcp comment 'SSH'

# HTTP/HTTPS for Nginx
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# LiveKit TURN (UDP for WebRTC media relay)
sudo ufw allow 3478/udp comment 'LiveKit TURN UDP'
sudo ufw allow 5349/tcp comment 'LiveKit TURN TLS'

# LiveKit WebRTC media ports
sudo ufw allow 50000:50200/udp comment 'LiveKit WebRTC media'

sudo ufw --force enable
sudo ufw status verbose

# ── 5. System security hardening ──
echo ""
echo "[5/7] Applying security hardening..."

# Disable root SSH login and password auth
sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Kernel tuning for WebRTC performance
sudo tee /etc/sysctl.d/99-app-tuning.conf > /dev/null <<'SYSCTL'
# Increase UDP buffer sizes for WebRTC
net.core.rmem_max = 2500000
net.core.wmem_max = 2500000
net.core.rmem_default = 1000000
net.core.wmem_default = 1000000

# Connection tracking
net.netfilter.nf_conntrack_max = 131072

# File descriptors
fs.file-max = 1000000
SYSCTL
sudo sysctl --system

# ── 6. Add swap space (critical for t3.small / low-RAM instances) ──
echo ""
echo "[6/7] Setting up 2GB swap space..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    # Reduce swappiness so swap is only used under pressure
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.d/99-app-tuning.conf
    sudo sysctl -p /etc/sysctl.d/99-app-tuning.conf
    echo "  2GB swap created and activated."
else
    echo "  Swap already exists."
fi
free -h

# ── 7. Create required directories ──
echo ""
echo "[7/7] Creating required directories..."
mkdir -p certbot/conf certbot/www

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Log out and back in (for Docker group)"
echo "  2. Copy .env.example to .env and fill in values"
echo "     cp .env.example .env && nano .env"
echo "  3. Run: bash scripts/init-ssl.sh"
echo "  4. Run: docker compose up -d --build"
echo ""
echo "============================================"
