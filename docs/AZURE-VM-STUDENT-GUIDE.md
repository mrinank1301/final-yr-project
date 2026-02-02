# Azure VM + Deployment Guide (Student Subscription)

Step-by-step guide to create an Azure VM and deploy this app using an **Azure for Students** (or Azure for Students Starter) subscription.

---

## Part 1: About Azure for Students

- **Azure for Students**: Free credit (e.g. $100) for 12 months, no credit card required with a valid school email.
- **Azure for Students Starter**: Limited set of free services, no credit card.
- **Limits**: Student subscriptions can have **regional and SKU restrictions**. B1s/B1ms are often **not available in East US 2**. Use **Ubuntu Server** and a **B-series** or **free-tier** VM size to stay within limits.

If you hit “subscription not allowed” for a size, see **Part 1 options below** for alternative regions and VM sizes (B1ls, B2s, A1_v2, etc.).

### If B1s / B1ms is not available (e.g. East US 2)

**Option A – Try a different region**

Create the VM in a region where student subscription allows small sizes. Try (in order): **East US**, **West US 2**, **West Europe**, **Central India**, **Southeast Asia**. Set **Region** to one of these (e.g. **East US** instead of East US 2), then pick **Standard_B1s** or **Standard_B1ms** again.

**Option B – Try other cheap VM sizes**

In the VM create screen → **Size** → **See all sizes**. Try these (pick the first that is available):

| Size | vCPU | RAM | Notes |
|------|------|-----|--------|
| **Standard_B2ats_v2** | 2 | 4 GiB | **Free eligible**; Ampere Altra (Arm) – use **Ubuntu 22.04 LTS Arm64** image |
| **Standard_B2ts_v2** | 2 | 4 GiB | **Free eligible** on student subscription; use standard Ubuntu 22.04 LTS |
| **Standard_B1ls** | 1 | 0.5 GiB | Cheapest B-series; often available when B1s is not |
| **Standard_B2s** | 2 | 4 GiB | Often allowed on student subs |
| **Standard_B2ms** | 2 | 8 GiB | More RAM |
| **Standard_A1_v2** | 1 | 2 GiB | Older A-series, often allowed |
| **Standard_A2_v2** | 2 | 4 GiB | Same |
| **Standard_D2s_v3** | 2 | 8 GiB | Check quota |

If your subscription shows **B2ats_v2** or **B2ts_v2** as free eligible, use one of those first (2 vCPU, 4 GiB is enough for this app). Filter by "Burstable" or sort by cost; pick any size that shows as available.

**Option C – Check quota**

**Subscriptions** → your subscription → **Usage + quotas** → search "Virtual Machines" to see vCPU quotas per region.

**Recommendation:** If **B2ats_v2** or **B2ts_v2** are free eligible for you, use one of those (2 vCPU, 4 GiB). Otherwise try **East US** with **Standard_B1s**, then **Standard_B1ls** or **Standard_B2s**.

---

## Part 2: Create the VM in Azure Portal

### Step 1: Sign in to Azure

1. Go to [https://portal.azure.com](https://portal.azure.com).
2. Sign in with your **Microsoft account** (the one linked to your student subscription).
3. In the top search bar, type **Subscriptions** and open it. Confirm you see your **Azure for Students** (or similar) subscription and note its name.

### Step 2: Create a resource group

1. In the search bar, type **Resource groups** → open it.
2. Click **+ Create**.
3. **Subscription**: Your student subscription.
4. **Resource group**: e.g. `rg-finalyrproject`.
5. **Region**: Choose a close region (e.g. East US, West Europe). Student credit usually works in all regions.
6. Click **Review + create** → **Create**.

### Step 3: Create a virtual machine

1. In the search bar, type **Virtual machines** → open it.
2. Click **+ Create** → **Azure virtual machine**.

Fill the tabs as below.

**Basics**

| Field | Value |
|--------|--------|
| **Subscription** | Your student subscription |
| **Resource group** | `rg-finalyrproject` (or the one you created) |
| **Virtual machine name** | e.g. `vm-finalyrproject` |
| **Region** | Prefer **East US** or **West Europe** if East US 2 does not allow B1s (see Part 1 – VM size alternatives) |
| **Security type** | Standard |
| **Image** | **Ubuntu Server 22.04 LTS** (if you pick **B2ats_v2**, choose **Ubuntu Server 22.04 LTS – Arm64** instead) |
| **Size** | **Standard_B2ats_v2** or **Standard_B2ts_v2** if free eligible; else **Standard_B1s**, **Standard_B1ls**, **Standard_B2s** (see Part 1 for full list) |
| **Authentication type** | **SSH public key** (recommended) or Password |
| **Username** | e.g. `azureuser` |
| **SSH public key source** | Generate new key pair (or Use existing if you have one) |
| **Key pair name** | e.g. `vm-finalyrproject-key` |

- If you chose **Generate new key pair**, click **Download private key and create resource** and save the `.pem` file; you’ll use it to SSH.
- If you chose **Password**, set a strong password and remember it.

**Disks**

- Leave defaults (Premium SSD or Standard SSD, 30 GiB is enough).

**Networking**

| Field | Value |
|--------|--------|
| **Virtual network** | (new) e.g. `vnet-finalyrproject` |
| **Subnet** | default |
| **Public IP** | (new) – default |
| **NIC network security group** | **Advanced** (we’ll add a rule for port 80 next) |
| **Public inbound ports** | **Allow selected ports** |
| **Select inbound ports** | **SSH (22)** |

We’ll add port 80 right after creating the VM.

**Other tabs**

- Leave **Management**, **Monitoring**, **Advanced**, **Tags** as default unless you know you need something else.

3. Click **Review + create**.
4. After validation, click **Create**.
5. If you generated a new key, download the `.pem` file when prompted and store it somewhere safe (e.g. `~/Downloads/vm-finalyrproject-key.pem`).

### Step 4: Open port 80 for HTTP

1. After the VM is created, go to **Virtual machines** and click your VM (`vm-finalyrproject`).
2. In the left menu, under **Settings**, click **Networking** (or **Networking** → **Networking**).
3. Click **Create port rule** → **Inbound port rule** (or **+ Add inbound port rule**).
4. Set:
   - **Source**: Any
   - **Source port ranges**: *
   - **Destination**: Any
   - **Service**: HTTP
   - **Destination port ranges**: 80
   - **Protocol**: TCP
   - **Action**: Allow
   - **Priority**: 1010 (or any free number)
   - **Name**: e.g. `AllowHTTP`
5. Click **Add**.

You should now see rules for **SSH (22)** and **HTTP (80)**.

### Step 5: Get the VM’s public IP

1. On the VM’s **Overview** page, find **Public IP address** (e.g. `20.123.45.67`).
2. Copy and save it; you’ll use it as `YOUR_VM_IP`=='40.81.27.217' for SSH and for `PUBLIC_URL` in `.env`.

---

## Part 3: Connect to the VM (SSH)

### On Windows (PowerShell or Command Prompt)

If you used **SSH key**:

1. Move the downloaded `.pem` to a simple path, e.g. `C:\Users\YourName\.ssh\vm-finalyrproject-key.pem`.
2. Set permissions so only you can read it (optional but recommended):
   - Right-click the file → Properties → Security → Advanced → Disable inheritance → Remove all except your user → give yourself Read.
3. Connect (replace path and IP):

```powershell
ssh -i "C:\Users\YourName\.ssh\vm-finalyrproject-key.pem" azureuser@YOUR_VM_IP
```

If you used **Password**:

```powershell
ssh azureuser@YOUR_VM_IP
```

Type the password when prompted.

### On macOS / Linux

**Key:**

```bash
chmod 400 ~/Downloads/vm-finalyrproject-key.pem
ssh -i ~/Downloads/vm-finalyrproject-key.pem azureuser@YOUR_VM_IP
```

**Password:**

```bash
ssh azureuser@YOUR_VM_IP
```

When asked “Are you sure you want to continue connecting?”, type `yes`.

You should see a prompt like: `azureuser@vm-finalyrproject:~$`

---

## Part 4: Install Docker and Docker Compose on the VM

Run these on the VM (one block at a time). You can paste multiple lines together.

```bash
# Update packages
sudo apt-get update
sudo apt-get upgrade -y
```

```bash
# Add Docker’s official repo
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

```bash
# Install Docker Engine and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

```bash
# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER
```

```bash
# Apply group change (or log out and back in)
newgrp docker
```

```bash
# Check
docker --version
docker compose version
```

You should see version lines for both.

---

## Part 5: Clone the repo and set environment variables

```bash
# Install Git if needed
sudo apt-get install -y git
```

```bash
# Create app directory (change path/name if you like)
mkdir -p ~/app
cd ~/app
```

```bash
# Clone your repo (replace with your actual repo URL)
git clone https://github.com/YOUR_USERNAME/final-yr-project.git .
```

If the repo is private, use a **Personal Access Token** instead of password:

- GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic).
- Give it `repo` scope.
- When Git asks for password, paste the token.

```bash
# Create .env from example
cp .env.example .env
nano .env
```

Edit the file. **Minimum you need:**

- `PUBLIC_URL` = `http://YOUR_VM_IP` (e.g. `http://20.123.45.67`) — same IP you use for SSH.
- `LIVEKIT_URL` = your LiveKit server URL (e.g. `wss://your-livekit.livekit.cloud`).
- `LIVEKIT_API_KEY` = your LiveKit API key.
- `LIVEKIT_API_SECRET` = your LiveKit API secret.

Save: **Ctrl+O**, Enter, then **Ctrl+X**.

---

## Part 6: Build and run with Docker Compose

On a small VM (e.g. B2ts_v2 with 4 GB RAM), a full `docker compose build` can **hang or run out of memory**. Do this instead:

### Step A: Add swap (so the build doesn’t run out of RAM)

Run once on the VM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Check: `free -h` — you should see about 2G swap.

### Step B: Stop any stuck build

In the SSH window where the build is stuck, press **Ctrl+C** to stop it.

### Step C: Build one service at a time (saves memory)

```bash
cd ~/app
docker compose build --no-cache node
docker compose build --no-cache python
docker compose build --no-cache frontend
```

Each step can take several minutes. If one step hangs again, note which service (node/python/frontend) and we can tune that build.

### Step D: Start everything

```bash
docker compose up -d
```

---

**If your VM has plenty of RAM (e.g. 8 GB)** you can skip swap and build in one go:

```bash
cd ~/app
docker compose build --no-cache
docker compose up -d
```

Check that containers are running:

```bash
docker compose ps
```

You should see `frontend`, `node`, `python`, and `nginx` with state “Up”.

---

## Part 7: Test the deployment

1. Open a browser and go to: **http://YOUR_VM_IP**
2. You should see your app’s landing page.
3. Try creating a room / starting a call (requires LiveKit configured correctly).

If it doesn’t load:

- Check firewall: Azure NSG must allow **80** (done in Step 4).
- Check containers: `docker compose logs -f` (Ctrl+C to stop).
- Check Nginx: `docker compose logs nginx`.

### If you see “Failed to connect to the server”

That means the app (in your browser) could not reach the **Node** backend to get a video token. Do this:

1. **Check containers:** `docker compose ps` — `node` and `nginx` should be **Up**. If not, run `docker compose up -d` from `~/app`.
2. **Check .env:** In `~/app/.env` you must have `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` set (see Part 5). The Node container uses these.
3. **Rebuild frontend once:** The app now uses the same URL you open in the browser (e.g. `http://YOUR_VM_IP`). Rebuild so the change is in the image:  
   `docker compose build --no-cache frontend && docker compose up -d`

### LiveKit (self-hosted)

This project runs **self-hosted LiveKit** in Docker. In `~/app/.env` set:

- `LIVEKIT_URL=http://YOUR_VM_IP/livekit` (use your VM’s public IP; or `https://yourdomain.com/livekit` if you use HTTPS).
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` — any secure strings (e.g. random 32-character strings). The same values are used by the Node backend and the LiveKit container.

**For video to work**, open **UDP ports 50000–60000** on the VM (Azure NSG): Azure Portal → VM → Networking → Add inbound port rule → Protocol **UDP**, port range **50000–60000**, Source **Any**. This allows WebRTC media.

---

## Part 8: (Optional) Set up GitHub Actions for auto-deploy

So that every push to `main` deploys to this VM:

1. **Generate an SSH key pair** (on your laptop, not on the VM):

   - Windows (PowerShell): `ssh-keygen -t ed25519 -C "github-actions" -f "$env:USERPROFILE\.ssh\github_actions_key" -N '""'`
   - Mac/Linux: `ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key -N ""`

2. **Copy the public key to the VM** (from your laptop):

   ```bash
   # Replace with your VM IP and key path
   ssh-copy-id -i ~/.ssh/github_actions_key.pub azureuser@YOUR_VM_IP
   ```

   On Windows without `ssh-copy-id`, copy the **contents** of `github_actions_key.pub` and on the VM run:

   ```bash
   mkdir -p ~/.ssh
   echo "PASTE_PUBLIC_KEY_CONTENT_HERE" >> ~/.ssh/authorized_keys
   ```

3. **Add GitHub Secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):

   | Name | Value |
   |------|--------|
   | `AZURE_VM_HOST` | Your VM’s public IP (e.g. `20.123.45.67`) |
   | `AZURE_VM_USER` | `azureuser` |
   | `AZURE_VM_SSH_KEY` | Entire content of **private** key: `github_actions_key` (no `.pub`) |
   | `AZURE_VM_APP_PATH` | `/home/azureuser/app` (or the path where you ran `git clone`) |

4. Push to `main`; the workflow in `.github/workflows/deploy-azure-vm.yml` will SSH to the VM, pull the repo, and run `docker compose build --no-cache` and `docker compose up -d`.

---

## Quick reference

| What | Command / value |
|------|------------------|
| SSH into VM | `ssh -i path/to/key.pem azureuser@YOUR_VM_IP` |
| App directory on VM | `~/app` or `/home/azureuser/app` |
| View logs | `docker compose logs -f` |
| Restart all | `docker compose restart` |
| Rebuild and start | `docker compose build --no-cache && docker compose up -d` |
| Stop all | `docker compose down` |
| Public URL | `http://YOUR_VM_IP` |

---

## Troubleshooting (Student subscription)

- **“Resource was disallowed by Azure” / “RequestDisallowedByAzure” / “policy maintains a set of best available regions”**  
  Your subscription can only create resources in **certain regions**. The region you chose (e.g. East US 2) is not in that list.  
  **Fix:** Create the VM in an **allowed region**. Try **East US**, **West Europe**, **West US 2**, or **Central US**. When creating the VM (and resource group), pick **Region** from the dropdown and choose one of these; avoid regions that gave you this error. If you’re unsure which regions are allowed, try **East US** or **West Europe** first.

- **“This subscription cannot use this VM size”**  
  Try **B1s** or **B1ms**. If still not allowed, pick the smallest size your subscription offers in that region (e.g. **B2ats_v2**, **B2ts_v2**).

- **“Quota exceeded”**  
  Student subscriptions have limits. Use one VM, one region, and a small size (B1s).

- **Out of credit**  
  Azure for Students has a limited credit amount. Check **Cost Management + Billing** in the portal; stop or delete the VM when not in use to avoid extra cost.

- **Can’t SSH**  
  - Check NSG: Inbound rule for **port 22** (SSH).  
  - Check VM is **Running** in the portal.  
  - On Windows, use the correct path to the `.pem` and the correct username (`azureuser`).

- **Port 80 not working**  
  Confirm an inbound NSG rule for **TCP port 80** (HTTP) as in Step 4.

- **“Error fetching token” / “Failed to connect to the server”**  
  On the VM run:  
  `curl -X POST http://localhost/api/token -H "Content-Type: application/json" -d '{"roomName":"test","participantName":"user"}'`  
  - If you see `{"error":"Server configuration error: Missing LiveKit credentials"}` → set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_URL` in `~/app/.env`, then `docker compose up -d`.  
  - If connection refused → run `docker compose ps` and `docker compose logs node`.  
  - Open the app at `http://YOUR_VM_IP` (not localhost from your PC).

- **Python container “Restarting”**  
  Run `docker compose logs python` to see the crash reason. Fix the error (often missing env). Token/video work without Python; Python is for AI and code execution.

If you tell me your exact error message or screen (e.g. “subscription not allowed”, “connection refused”), I can give step-by-step fixes for that.
