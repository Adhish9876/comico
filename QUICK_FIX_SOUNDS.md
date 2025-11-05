# ⚡ QUICK FIX: Sound Loading Issue

## Problem
```
❌ Sounds not playing
❌ Error: net::ERR_CERT_AUTHORITY_INVALID
❌ Audio files blocked by browser
```

## Root Cause
Browser doesn't trust the self-signed SSL certificate on Flask server (port 5000)

---

## 🚀 SOLUTION (30 seconds)

### Step 1: Accept Certificate
```
1. Open browser
2. Type: https://localhost:5000
3. Click "Advanced"
4. Click "Proceed to localhost" or "Accept Risk"
```

### Step 2: Restart Client
```powershell
python client.py
```

### Step 3: Test
```
Send message → ✅ Should hear "ting" sound
```

---

## ✅ That's It!

Once you accept the certificate, sounds work perfectly offline.

---

## Alternative: Use mkcert (Better)

If you want NO security warnings:

```powershell
# Install mkcert
choco install mkcert

# Create trusted certificates
mkcert -install
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1

# Restart server
python video_module.py
```

---

## Why This Works

Browser blocks untrusted HTTPS resources (like audio files).

After you accept the certificate:
- ✅ Browser trusts the server
- ✅ Audio files load successfully
- ✅ Sounds play without errors

---

## Verification

Open browser console (F12) and send a message:

**✅ Success:**
```
[MESSAGE] ✓ Message sent sound played
```

**❌ Still broken:**
```
Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID
```

If still broken, try:
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Restart video_module.py

