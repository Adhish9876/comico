# 🚀 Quick Start: Fix Browser SSL Warnings

## Problem
When joining video calls, browser shows:
```
⚠️ Your connection is not private
NET::ERR_CERT_AUTHORITY_INVALID
```

## Solution: Use Mkcert (3 Steps)

### Step 1: Run Setup Script

Open **PowerShell as Administrator** in the project folder:

```powershell
.\setup_mkcert.ps1
```

This will:
- ✅ Install mkcert (if needed)
- ✅ Create trusted SSL certificates
- ✅ Configure for your current IP

### Step 2: Start Server

```bash
python video_module.py
```

You should see:
```
✅ Using mkcert trusted certificates
🔒 No browser warnings - certificates are trusted!
```

### Step 3: Access Video Calls

Open browser to: `https://172.20.10.9:5000`

**No warnings!** 🎉

---

## 📝 Adding New IPs

When your IP changes:

1. **Edit `.env` file:**
   ```
   SERVER_IP=192.168.1.100
   ```

2. **Run setup again:**
   ```powershell
   .\setup_mkcert.ps1
   ```

3. **Restart server:**
   ```bash
   python video_module.py
   ```

---

## 🔧 Manual Certificate Generation

If you need to add multiple IPs at once:

```powershell
# Delete old certificates
del cert.pem key.pem

# Generate with multiple IPs
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 172.20.10.9 192.168.1.100 0.0.0.0
```

---

## ✅ Works Offline

Mkcert certificates work completely offline - no internet required!

---

## 📚 Full Documentation

See **MKCERT_SETUP.md** for:
- Detailed setup instructions
- Troubleshooting
- Network configuration
- Security notes

---

## 🆘 Troubleshooting

### "mkcert: command not found"

Install Chocolatey first, then run setup script again.

### Still seeing warnings?

1. Clear browser cache
2. Restart browser completely
3. Run setup script again

### Works on localhost but not IP?

Make sure your IP is in the certificate:
```powershell
.\setup_mkcert.ps1
```

---

## 🎯 Summary

**Before:** Browser warnings every time  
**After:** Trusted certificates, no warnings, works offline

**Command:** `.\setup_mkcert.ps1`  
**Time:** ~2 minutes  
**Result:** Professional, secure video calls
