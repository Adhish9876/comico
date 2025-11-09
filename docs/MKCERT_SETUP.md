# 🔒 Mkcert SSL Setup Guide

## Overview
This guide helps you set up **trusted SSL certificates** using **mkcert** to eliminate browser security warnings when accessing video/audio calls. The certificates will work **offline** and be trusted by your system.

---

## 🎯 What This Fixes

### Before (Current Issue):
- Browser shows "Your connection is not private" warning
- Must click "Advanced" → "Proceed to site (unsafe)" every time
- Annoying for users joining video calls

### After (With Mkcert):
- ✅ No browser warnings
- ✅ Trusted SSL certificates
- ✅ Works offline
- ✅ Professional user experience

---

## 📋 Prerequisites

- Windows 10/11
- PowerShell
- Administrator access (for initial setup)

---

## 🚀 Quick Setup (Automated)

### Step 1: Run the Setup Script

Open PowerShell **as Administrator** in the project directory and run:

```powershell
.\setup_mkcert.ps1
```

This script will:
1. ✅ Check for Chocolatey (package manager)
2. ✅ Install mkcert if not present
3. ✅ Install local Certificate Authority
4. ✅ Read your SERVER_IP from `.env`
5. ✅ Generate trusted SSL certificates

### Step 2: Start the Server

```bash
python video_module.py
```

### Step 3: Access Without Warnings

Open your browser and go to:
```
https://172.20.10.9:5000
```

**No warnings!** 🎉

---

## 🛠️ Manual Setup (Alternative)

If you prefer manual installation:

### 1. Install Chocolatey (if not installed)

Open PowerShell **as Administrator**:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### 2. Install Mkcert

```powershell
choco install mkcert -y
```

### 3. Install Local CA

```powershell
mkcert -install
```

This installs a local Certificate Authority that your system trusts.

### 4. Generate Certificates

Navigate to your project directory and run:

```powershell
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 172.20.10.9 0.0.0.0
```

Replace `172.20.10.9` with your actual SERVER_IP from `.env`.

---

## 🔄 Adding New IPs or Domains

When you need to trust a new IP address:

### Method 1: Update .env and Re-run Script

1. Edit `.env` file:
   ```
   SERVER_IP=192.168.1.100
   ```

2. Run setup script again:
   ```powershell
   .\setup_mkcert.ps1
   ```

### Method 2: Manual Certificate Generation

Delete old certificates and generate new ones:

```powershell
# Delete old certificates
del cert.pem
del key.pem

# Generate new certificates with additional IPs
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 172.20.10.9 192.168.1.100 0.0.0.0
```

### Method 3: Multiple IPs at Once

You can add multiple IPs in one command:

```powershell
mkcert -cert-file cert.pem -key-file key.pem `
  localhost `
  127.0.0.1 `
  172.20.10.9 `
  192.168.1.100 `
  10.0.0.50 `
  0.0.0.0
```

---

## 📝 Configuration File Reference

### Where to Add New IPs

**File: `.env`**
```bash
# Server Configuration
SERVER_IP=172.20.10.9
```

**To trust multiple IPs:**
1. Set your primary IP in `.env`
2. Generate certificates with all IPs manually:
   ```powershell
   mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 IP1 IP2 IP3 0.0.0.0
   ```

---

## 🔍 Verification

### Check if Certificates are Trusted

1. Start the server:
   ```bash
   python video_module.py
   ```

2. Open browser to: `https://172.20.10.9:5000`

3. Check the address bar:
   - ✅ **Trusted**: Lock icon 🔒 (no warning)
   - ❌ **Not Trusted**: Warning triangle ⚠️

### View Certificate Details

In Chrome:
1. Click the lock icon 🔒 in address bar
2. Click "Certificate"
3. Check "Issued by" should show "mkcert"

---

## 🌐 Network Setup

### For Local Network Access

If other devices on your network need to access the server:

1. **Find your local IP:**
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.1.100`)

2. **Update .env:**
   ```
   SERVER_IP=192.168.1.100
   ```

3. **Regenerate certificates:**
   ```powershell
   .\setup_mkcert.ps1
   ```

4. **On other devices:**
   - They will still see warnings (mkcert only trusts on the machine it's installed on)
   - For full trust, install mkcert CA on those devices too (see below)

### Trusting on Other Devices

To eliminate warnings on other devices:

1. **Export the CA certificate from the main machine:**
   ```powershell
   mkcert -CAROOT
   ```
   This shows the CA certificate location (e.g., `C:\Users\YourName\AppData\Local\mkcert`)

2. **Copy `rootCA.pem` to the other device**

3. **On the other device:**
   - **Windows**: Double-click `rootCA.pem` → Install Certificate → Place in "Trusted Root Certification Authorities"
   - **Android**: Settings → Security → Install from storage
   - **iOS**: Settings → General → Profile → Install Profile

---

## 🐛 Troubleshooting

### Issue: "mkcert: command not found"

**Solution:**
```powershell
# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Or restart PowerShell
```

### Issue: "Access Denied" when running mkcert -install

**Solution:**
- Run PowerShell **as Administrator**
- Right-click PowerShell → "Run as Administrator"

### Issue: Browser still shows warning

**Solutions:**
1. **Clear browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files

2. **Restart browser completely:**
   - Close all browser windows
   - Reopen and try again

3. **Check certificate includes your IP:**
   ```powershell
   # View certificate details
   openssl x509 -in cert.pem -text -noout | findstr "DNS\|IP"
   ```

4. **Regenerate certificates:**
   ```powershell
   del cert.pem key.pem
   .\setup_mkcert.ps1
   ```

### Issue: Certificate expired

**Solution:**
Mkcert certificates are valid for 10 years, but if expired:
```powershell
del cert.pem key.pem
.\setup_mkcert.ps1
```

### Issue: Works on localhost but not on IP

**Solution:**
Ensure your IP is included in the certificate:
```powershell
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 YOUR_IP 0.0.0.0
```

---

## 🔐 Security Notes

### Is This Safe?

✅ **Yes, for local development:**
- Mkcert creates a local Certificate Authority (CA)
- The CA is only trusted on your machine
- Certificates only work on your local network
- No external trust or security risks

### Should I Commit Certificates to Git?

❌ **No:**
- Add to `.gitignore`:
  ```
  cert.pem
  key.pem
  ```
- Each developer should generate their own certificates
- The CA private key should never be shared

### Production Use

⚠️ **For production:**
- Use proper SSL certificates from Let's Encrypt or a commercial CA
- Mkcert is for **development only**

---

## 📚 Additional Resources

- **Mkcert GitHub**: https://github.com/FiloSottile/mkcert
- **Chocolatey**: https://chocolatey.org/
- **Let's Encrypt** (for production): https://letsencrypt.org/

---

## ✅ Success Checklist

After setup, verify:

- [ ] Mkcert installed: `mkcert -version`
- [ ] Local CA installed: `mkcert -CAROOT` shows path
- [ ] Certificates generated: `cert.pem` and `key.pem` exist
- [ ] Server starts without errors: `python video_module.py`
- [ ] Browser shows lock icon 🔒 (no warning)
- [ ] Video calls work without security prompts
- [ ] Camera/microphone permissions work

---

## 🎉 You're Done!

Your video calls now have trusted SSL certificates and work offline without browser warnings!

**Quick Reference:**
- **Start server**: `python video_module.py`
- **Access**: `https://YOUR_IP:5000`
- **Add new IP**: Edit `.env` → Run `.\setup_mkcert.ps1`
- **Regenerate**: `del cert.pem key.pem` → Run `.\setup_mkcert.ps1`
