# 🔒 Automatic SSL Certificate Setup Guide

## What Changed?

**Good news!** Shadow Nexus now **automatically generates SSL certificates** when you click the "Connect" button! ✅

No more manual setup needed. Just run the client and connect - the certificates are created automatically.

---

## How It Works

### First Time You Connect:

1. **Click "Connect" button** in the login screen
2. **Client checks for certificates** (`cert.pem` and `key.pem`)
3. **If certificates don't exist:**
   - Client automatically installs mkcert (if needed)
   - Installs the local Certificate Authority
   - Generates trusted SSL certificates for your IP
4. **Connection proceeds** ✅

### Subsequent Connections:

- Certificates are already in place
- Everything works immediately ✅

---

## What Gets Set Up?

The automatic setup includes:

✅ **mkcert Installation**
- Downloaded and installed automatically
- Works on Windows, Mac, and Linux

✅ **Local Certificate Authority**
- Installed and trusted on your system
- No browser warnings on your machine

✅ **SSL Certificates**
- Generated for `localhost` and your server IP
- Valid for 10 years
- Ready to use immediately

---

## For Your Friends

When your friends connect to your video call IP, they may see a browser warning. Here's why and how to fix it:

### Why They See a Warning:

- Your friend doesn't have your local CA installed on their machine
- Their browser doesn't recognize your certificate as trusted

### Solutions:

#### Option 1: Install Your CA (Permanent Solution - Recommended)

Your friends only need to do this **once**, then they'll never see warnings again!

**Windows:**
1. Find the CA certificate location:
   ```
   Run mkcert -CAROOT
   ```
   This shows a path like: `C:\Users\YourName\AppData\Local\mkcert\`

2. Copy `rootCA.pem` from that folder
3. Send it to your friend via email or USB
4. Friend double-clicks `rootCA.pem`
5. Friend clicks "Install Certificate"
6. Friend selects "Place all certificates in Trusted Root Certification Authorities"
7. Done! ✅

**Mac:**
1. Same as Windows to get `rootCA.pem`
2. Friend double-clicks it
3. It's automatically added to their Keychain
4. Done! ✅

**Linux:**
1. Copy `rootCA.pem` to: `/usr/local/share/ca-certificates/`
2. Run: `sudo update-ca-certificates`
3. Done! ✅

#### Option 2: Quick Connect (Temporary)

Friends can proceed without installing:
1. See "This connection is not private"
2. Click "Advanced"
3. Click "Proceed to (IP) (unsafe)"
4. Video loads fine ✅

(The connection IS secure, just not "recognized" by their system)

---

## Troubleshooting

### Issue: "mkcert: command not found"

**Solution:**
The client will attempt to install mkcert automatically. If it fails:

**Windows:**
```powershell
# Using Chocolatey
choco install mkcert

# OR using Scoop
scoop install mkcert
```

**Mac:**
```bash
brew install mkcert
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install mkcert

# Fedora
sudo dnf install mkcert

# Arch
sudo pacman -S mkcert
```

### Issue: Still Getting Browser Warnings

**Solutions:**
1. **Clear browser cache:** Settings → Privacy → Clear browsing data
2. **Restart browser** completely (close all windows)
3. **Restart computer** (sometimes needed for cert installation to take effect)
4. **Regenerate certificates:** Delete `cert.pem` and `key.pem`, then reconnect

### Issue: "Permission Denied" During Setup

**Solution:**
Run Shadow Nexus **as Administrator** (or with `sudo` on Mac/Linux):

**Windows:**
- Right-click `ShadowNexusClient.bat` → "Run as Administrator"

**Mac/Linux:**
```bash
sudo python client.py
```

---

## File Information

### New Files Created:

- **`cert_manager.py`** - Handles automatic certificate generation and mkcert installation
- **`cert.pem`** - Your SSL certificate (auto-generated)
- **`key.pem`** - Your certificate's private key (auto-generated)

### Modified Files:

- **`client.py`** - Now calls certificate setup when you click Connect

---

## Security Notes

### Is This Safe?

✅ **Yes, completely safe!**

- mkcert is from a trusted developer (Filippo Valsorda)
- Certificates only work locally on your network
- No data leaves your system
- No security keys exposed
- Perfect for development/local use

### For Production:

⚠️ **Mkcert is for development only**

For a public production server, use:
- **Let's Encrypt** (free)
- **Commercial CA** (paid)
- **AWS Certificate Manager** (if hosting on AWS)

---

## How to Share With Friends

### For Your Friends Who Get Browser Warnings:

**Send them this:**

> "Here's how to get rid of the SSL warning when connecting to my video calls:
>
> 1. I'll send you a file called `rootCA.pem`
> 2. On Windows: Double-click it → Install Certificate → Choose "Trusted Root Certification Authorities"
> 3. On Mac: Double-click it → It's automatically added to Keychain
> 4. On Linux: Copy to `/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`
> 5. Restart your browser - no more warnings! ✅
>
> This only needs to be done once per computer."

---

## FAQs

**Q: Do I need to do anything manually?**
A: No! Just click Connect and it's all automatic. ✅

**Q: Will it slow down the connection?**
A: No, setup takes ~2-5 seconds on first connect. ✅

**Q: Can I turn off the automatic setup?**
A: It only runs if certificates are missing. Once they exist, it's skipped.

**Q: Do my friends need to run this?**
A: They can either:
- Install your CA (recommended, one-time)
- Click "Advanced" and proceed (every time)

**Q: What if mkcert can't be installed?**
A: The app still works! You'll get a warning but can continue. The app will use existing certificates or generate self-signed ones.

**Q: How long are the certificates valid?**
A: 10 years! You won't need to regenerate them for a very long time.

---

## Success Checklist

After first connect, verify:

- [ ] No errors during certificate setup
- [ ] `cert.pem` and `key.pem` files exist
- [ ] Browser shows lock icon 🔒 (not warning)
- [ ] Video calls work without prompts
- [ ] Camera/microphone permissions work

---

## Need Help?

If certificates don't generate automatically:

1. **Check the terminal output** - Look for error messages
2. **Try manual setup:**
   ```bash
   python cert_manager.py
   ```
3. **Check your IP:** Make sure `.env` has the correct `SERVER_IP`
4. **Restart the app** with administrator privileges

---

**You're all set! Enjoy your video calls without SSL warnings!** 🎉
