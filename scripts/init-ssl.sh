#!/bin/bash
# ============================================================
# SSL Certificate Initialization Script
# Obtains Let's Encrypt certificates using Certbot
# Must be run BEFORE starting the full docker-compose stack
# ============================================================
set -euo pipefail

# Load environment variables
if [ ! -f .env ]; then
    echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
    exit 1
fi
source .env

# Validate required vars
if [ -z "${DOMAIN:-}" ] || [ -z "${LIVEKIT_DOMAIN:-}" ] || [ -z "${EMAIL:-}" ]; then
    echo "ERROR: DOMAIN, LIVEKIT_DOMAIN, and EMAIL must be set in .env"
    exit 1
fi

echo "============================================"
echo "  SSL Certificate Setup"
echo "============================================"
echo "  Domain:       $DOMAIN"
echo "  LiveKit:      $LIVEKIT_DOMAIN"
echo "  Email:        $EMAIL"
echo "============================================"

# ── Step 1: Update nginx.conf with actual domain names ──
echo ""
echo "[1/4] Configuring nginx with domain names..."
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/nginx.conf
sed -i "s/LIVEKIT_DOMAIN_PLACEHOLDER/$LIVEKIT_DOMAIN/g" nginx/nginx.conf
echo "  nginx.conf updated."

# ── Step 2: Update livekit.yaml with domain ──
echo ""
echo "[2/4] Configuring LiveKit with domain..."
sed -i "s/LIVEKIT_DOMAIN_PLACEHOLDER/$LIVEKIT_DOMAIN/g" livekit.yaml
echo "  livekit.yaml updated."

# ── Step 3: Create temporary nginx config for ACME challenge ──
echo ""
echo "[3/4] Starting temporary nginx for ACME challenge..."

# Create minimal HTTP-only nginx config for initial cert generation
mkdir -p certbot/conf certbot/www

cat > /tmp/nginx-acme.conf <<NGINX_EOF
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN $LIVEKIT_DOMAIN;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'Waiting for SSL setup...';
            add_header Content-Type text/plain;
        }
    }
}
NGINX_EOF

# Start temporary nginx container
docker run -d --name nginx-acme \
    -p 80:80 \
    -v /tmp/nginx-acme.conf:/etc/nginx/nginx.conf:ro \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    nginx:alpine

# Wait for nginx to start
sleep 3

# ── Step 4: Obtain SSL certificates ──
echo ""
echo "[4/4] Requesting SSL certificates from Let's Encrypt..."
docker run --rm \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "$LIVEKIT_DOMAIN"

# Clean up temporary nginx
docker stop nginx-acme && docker rm nginx-acme
rm -f /tmp/nginx-acme.conf

echo ""
echo "============================================"
echo "  SSL Certificates obtained successfully!"
echo "============================================"
echo ""
echo "Certificates stored in: ./certbot/conf/"
echo ""
echo "Now start the application:"
echo "  docker compose up -d --build"
echo ""
echo "============================================"
