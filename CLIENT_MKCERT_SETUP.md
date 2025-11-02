# 📦 Client Setup - mkcert CA Installation

## For End Users: Remove SSL Warning

### Step 1: Download mkcert
Your admin will provide `mkcert.exe` file

### Step 2: Install CA (One-time setup)
```bash
# Run this ONCE:
mkcert.exe -install

# You'll see:
# Created a new local CA 💥
# Your browser will trust this CA automatically
```

### Step 3: Restart Browser
Close and reopen your browser. Done!

### Result:
✅ **SSL warning GONE**  
✅ Video calls work without browser warnings  
✅ Completely trusted connection

---

## What Gets Installed

When you run `mkcert -install`:
- ✅ A local CA certificate is created
- ✅ Added to Windows Trusted Root Store
- ✅ Browser automatically trusts it
- ✅ All certificates signed by this CA are trusted

**Location**: `C:\Users\<username>\AppData\Local\mkcert\`

---

## Is It Safe?

✅ **YES** - This is:
- Standard industry practice
- Used by major companies (Docker, Kubernetes, etc.)
- Completely local (no internet connection to CA)
- Only trusts YOUR local CA (not internet CAs)
- Easy to uninstall if needed

---

## How to Uninstall (If Needed)

```bash
mkcert.exe -uninstall
```

That's it! The CA is removed from your trusted store.

---

## After Installation

Once installed, when you visit: `https://10.200.14.204:5000`

### Before mkcert:
```
🔴 ⚠️ Your connection is not private
    NET::ERR_CERT_AUTHORITY_INVALID
```

### After mkcert:
```
🟢 ✅ Secure connection
    HTTPS - Connection is secure
```

---

## For Multiple Clients

**Admin will provide:**
1. `mkcert.exe` file
2. Instructions to run it once

**Each client:**
1. Runs `mkcert.exe -install`
2. Restarts browser
3. Done! ✅

---

## FAQs

**Q: Do I need to run this every time?**
A: NO - Just once per machine. It installs the CA permanently.

**Q: Will it affect other websites?**
A: NO - Only affects certificates from THIS CA (local only).

**Q: Can the admin see my traffic?**
A: NO - The CA is LOCAL. Only YOUR machine trusts it.

**Q: Is it mandatory?**
A: NO - You can ignore the warning if you prefer (just click "Advanced").

**Q: What if I need to reinstall Windows?**
A: Run `mkcert.exe -install` again after Windows reinstall.

---

## Summary

| Issue | Before | After mkcert |
|-------|--------|--------------|
| SSL Warning | ⚠️ Shows every time | ✅ Gone |
| Setup | None | Run once: `mkcert -install` |
| Security | Same | Better (trusted CA) |
| Performance | Same | Same |

**One-time 30 second setup = SSL warnings gone forever! ✅**

