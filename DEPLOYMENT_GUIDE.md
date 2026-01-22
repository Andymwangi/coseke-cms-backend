# Cloud Server Deployment Guide

## Server Details
- **IP**: 102.221.35.120
- **Username**: coseke
- **Password**: QRBHlJ~0P9#?8+QwH3CW
- **SSH Port**: 6402
- **Domain**: cms.coseke.cloud

## Step 1: SSH Connection

### Using Command Line (Windows)
```bash
ssh -p 6402 coseke@102.221.35.120
```
When prompted, enter password: `QRBHlJ~0P9#?8+QwH3CW`

### Using PuTTY (Windows GUI)
1. Host Name: 102.221.35.120
2. Port: 6402
3. Connection Type: SSH
4. Click "Open"
5. Login as: coseke
6. Password: QRBHlJ~0P9#?8+QwH3CW

---

## Step 2: Create Folder Structure on Server

Once connected via SSH, run these commands:

```bash
# Navigate to /var/www
cd /var/www

# Create backend folder
sudo mkdir -p cms-backend
sudo chown -R coseke:coseke cms-backend

# Create frontend folder
sudo mkdir -p cms-frontend
sudo chown -R coseke:coseke cms-frontend

# Verify folders created
ls -la /var/www
```

---

## Step 3: Transfer Backend Files

### Option A: Using SCP (from your local machine)
```bash
# Transfer entire server folder (run from your local Windows machine)
scp -P 6402 -r "C:\test\1\2\3\4\system\server" coseke@102.221.35.120:/var/www/cms-backend/

# Transfer database export
scp -P 6402 -r "C:\test\1\2\3\4\system\server\db-export" coseke@102.221.35.120:/var/www/cms-backend/
```

### Option B: Using WinSCP (Windows GUI)
1. Download WinSCP: https://winscp.net
2. File Protocol: SCP
3. Host: 102.221.35.120
4. Port: 6402
5. Username: coseke
6. Password: QRBHlJ~0P9#?8+QwH3CW
7. Drag and drop files to /var/www/cms-backend

---

## Step 4: Install Backend Dependencies

On the server (via SSH):

```bash
cd /var/www/cms-backend/server

# Install Node.js if not installed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Install PM2 globally for process management
sudo npm install -g pm2
```

---

## Step 5: Configure MongoDB Database

```bash
# Check if MongoDB is running
sudo systemctl status mongod

# If not running, start it
sudo systemctl start mongod
sudo systemctl enable mongod

# Access MongoDB shell to verify
mongosh

# In MongoDB shell, check databases
show dbs
exit
```

---

## Step 6: Import Database

```bash
cd /var/www/cms-backend/server

# Update importDatabase.js with local MongoDB URI
# Edit the file to use: mongodb://localhost:27017/undefined

# Run import script
node importDatabase.js
```

---

## Step 7: Configure Backend Environment

Create production .env file:

```bash
cd /var/www/cms-backend/server

# Create .env file
nano .env
```

Add this configuration:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/
CRON_SCHEDULE="00 08 * * *"
JWT_SECRET=ContratcmMs2534176245182635482734
SMTP_USER=cyprianmwendam@gmail.com
SMTP_PASS=xqpc ttbb foiu adkr
OTP_SECRET=123@intel
GEMINI_API_KEY=AIzaSyDrqhAvu5Hqh_jV60i5Ybu-DLXn_Z9jjfY
ENCRYPTION_KEY=5VZWaJeB9YQuD5TiogUBLvLdjsTRZLdB
FRONTEND_URL=https://cms.coseke.cloud
FROM_EMAIL=csk.contracts@coseke.com
```

Save: Ctrl+X, then Y, then Enter

---

## Step 8: Start Backend with PM2

```bash
cd /var/www/cms-backend/server

# Start with ecosystem config if available
pm2 start ecosystem.config.js

# OR start directly
pm2 start index.js --name "cms-backend"

# View logs
pm2 logs cms-backend

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

---

## Step 9: Transfer and Build Frontend

### Transfer Frontend Files (from local machine)
```bash
scp -P 6402 -r "C:\test\1\2\3\4\system\client" coseke@102.221.35.120:/var/www/cms-frontend/
```

### Build Frontend (on server)
```bash
cd /var/www/cms-frontend/client

# Install dependencies
npm install

# Update API URL to point to backend
# Edit .env or configuration file to use:
# REACT_APP_API_URL=http://102.221.35.120:5000/api
# OR if using reverse proxy: https://cms.coseke.cloud/api

# Build for production
npm run build

# The build folder will contain production files
```

---

## Step 10: Configure Nginx

```bash
# Install Nginx if not installed
sudo apt-get update
sudo apt-get install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/cms.coseke.cloud
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name cms.coseke.cloud;

    # Frontend - React build
    location / {
        root /var/www/cms-frontend/client/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API - Proxy to Node.js
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Socket.IO support
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/cms.coseke.cloud /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 11: Configure SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d cms.coseke.cloud

# Auto-renewal is set up automatically
```

---

## Step 12: Configure Firewall

```bash
# Allow necessary ports
sudo ufw allow 6402/tcp   # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 5000/tcp   # Backend (if direct access needed)

# Enable firewall
sudo ufw enable
```

---

## Verification Commands

```bash
# Check backend is running
pm2 status
curl http://localhost:5000

# Check frontend build exists
ls -la /var/www/cms-frontend/client/build

# Check Nginx is running
sudo systemctl status nginx

# Check MongoDB is running
sudo systemctl status mongod

# View application logs
pm2 logs cms-backend
```

---

## Troubleshooting

### Backend not starting
```bash
cd /var/www/cms-backend/server
pm2 logs cms-backend
npm test
node index.js  # Run directly to see errors
```

### MongoDB connection issues
```bash
sudo systemctl restart mongod
mongosh  # Test connection
```

### Nginx issues
```bash
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
tail -f /var/log/nginx/error.log
```

---

## Maintenance Commands

```bash
# Restart backend
pm2 restart cms-backend

# Update backend code (after transferring new files)
cd /var/www/cms-backend/server
npm install
pm2 restart cms-backend

# Update frontend (after transferring new files)
cd /var/www/cms-frontend/client
npm install
npm run build
sudo systemctl reload nginx
```
