# 🔄 IP Address Change Checklist

## Where to Change the IP for Chat and Video/Audio Calls

### 📍 Locations to Update:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIMARY CHANGE (Do This First)              │
├─────────────────────────────────────────────────────────────────┤
│  
│  1️⃣  .env File
│     File: .env
│     Change: SERVER_IP=172.20.10.9  →  SERVER_IP=YOUR_NEW_IP
│     ⭐ This controls everything!
│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              SECONDARY CHANGES (Auto-read from .env)           │
├─────────────────────────────────────────────────────────────────┤
│
│  2️⃣  client.py (Fallback IP only)
│     File: client.py
│     Line: 22
│     Current: SERVER_IP = os.getenv('SERVER_IP', '172.20.10.9')
│     Change fallback to: '172.20.10.9'  →  'YOUR_NEW_IP'
│     ℹ️  Only needed if .env file is missing
│
│  3️⃣  video_module.py (Fallback IP only)
│     File: video_module.py
│     Line: 25
│     Current: SERVER_IP = os.getenv('SERVER_IP', '172.20.10.9')
│     Change fallback to: '172.20.10.9'  →  'YOUR_NEW_IP'
│     ℹ️  Only needed if .env file is missing
│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            TERTIARY CHANGES (UI Convenience)                   │
├─────────────────────────────────────────────────────────────────┤
│
│  4️⃣  web/index.html (Connection Form Default)
│     File: web/index.html
│     Line: 206
│     HTML: <input type="text" id="hostInput" ... value="172.20.10.9" ...>
│     Change: value="172.20.10.9"  →  value="YOUR_NEW_IP"
│     ℹ️  For better UX (optional but recommended)
│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│          QUATERNARY CHANGES (SSL - If Using HTTPS)             │
├─────────────────────────────────────────────────────────────────┤
│
│  5️⃣  SSL Certificates (cert.pem & key.pem)
│     Files: cert.pem and key.pem
│     Action: REGENERATE with new IP
│     Command: mkcert -cert-file cert.pem -key-file key.pem \
│              localhost 127.0.0.1 YOUR_NEW_IP 0.0.0.0
│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│             AUTO-UPDATED (No Manual Changes Needed)            │
├─────────────────────────────────────────────────────────────────┤
│
│  ✅  templates/video_room.html
│     (Uses server_ip passed from video_module.py)
│
│  ✅  templates/audio_room.html
│     (Uses server_ip passed from video_module.py)
│
│  ✅  web/app.js
│     (Uses hostname from connection form)
│
│  ✅  server.py
│     (Listens on 0.0.0.0, not affected)
│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Reference

### ⚡ Minimum Changes Required:
```
1. Edit .env:
   SERVER_IP=YOUR_NEW_IP

2. (Optional) Regenerate SSL certificates if using HTTPS
```

### 🔧 Best Practice - Complete Changes:
```
1. Edit .env:
   SERVER_IP=YOUR_NEW_IP

2. Edit client.py line 22 fallback IP

3. Edit video_module.py line 25 fallback IP

4. Edit web/index.html line 206 value

5. Regenerate SSL certificates:
   mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 YOUR_NEW_IP 0.0.0.0

6. Restart both server and client
```

---

## 📊 Service Connection Diagram

```
┌─────────────────┐
│   Web Client    │
│  (Eel + JS)     │
└────────┬────────┘
         │
         │ (1) User enters IP in form
         ↓
    ┌────────────┐
    │  client.py │ Reads from .env
    └────┬───────┘
         │
         ├─→ :5555 ─→ Chat Messages, Files, Groups
         │
         ├─→ :5000/api/create_session ─→ Video
         │   (Returns: https://IP:5000/video/SESSION_ID)
         │
         └─→ :5000/api/create_audio_session ─→ Audio
             (Returns: https://IP:5000/audio/SESSION_ID)

┌─────────────────────────────┐
│  Server Components          │
├─────────────────────────────┤
│                             │
│  :5555 - Chat Server        │
│  :5556 - File Transfer      │
│  :5557 - Audio Engine       │
│  :5000 - Video/Audio APIs   │
│          (Flask + SocketIO) │
│                             │
└─────────────────────────────┘
```

---

## 📋 Files to Check/Modify

| # | File Path | Component | Change Type | Priority |
|---|-----------|-----------|------------|----------|
| 1 | `.env` | Environment Var | Value | 🔴 **MUST** |
| 2 | `client.py` L22 | Fallback IP | Value | 🟠 Recommended |
| 3 | `video_module.py` L25 | Fallback IP | Value | 🟠 Recommended |
| 4 | `web/index.html` L206 | Form Default | Value | 🟡 Nice-to-have |
| 5 | `cert.pem` + `key.pem` | SSL Cert | Regenerate | 🟠 If HTTPS |
| 6 | `templates/*.html` | Templates | None | ✅ Auto-updated |
| 7 | `web/app.js` | Frontend | None | ✅ Auto-updated |
| 8 | `server.py` | Server | None | ✅ No changes |

---

## 🔐 Testing Your Changes

After updating the IP, test these connections:

```
✓ Chat Server:      telnet YOUR_NEW_IP 5555
✓ File Server:      telnet YOUR_NEW_IP 5556
✓ Audio Server:     telnet YOUR_NEW_IP 5557
✓ Video API:        curl https://YOUR_NEW_IP:5000/
✓ Ping Host:        ping YOUR_NEW_IP
```

---

## ❌ If Something Breaks

**Problem:** Client won't connect
- ✓ Check .env file exists in client.py directory
- ✓ Verify IP is reachable: `ping YOUR_NEW_IP`
- ✓ Check services are running on new IP

**Problem:** Video/Audio calls fail
- ✓ Regenerate SSL certificates with new IP
- ✓ Check firewall allows port 5000
- ✓ Verify video_module.py has correct IP in fallback

**Problem:** "SSL certificate error"
- ✓ Regenerate certificates: `mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 YOUR_NEW_IP 0.0.0.0`
- ✓ Restart services after regeneration

**Problem:** Browser connects to old IP
- ✓ Clear browser cache and localStorage
- ✓ Close all browser windows/tabs
- ✓ Start fresh client connection

---

## 💡 Pro Tips

1. **Use .env file as single source of truth** - All Python files read from it
2. **Update HTML input value** - Makes it easier for users
3. **Don't forget SSL certificates** - Required for HTTPS connections
4. **Test connectivity first** - Before starting services: `ping YOUR_NEW_IP`
5. **Keep backups** - Save old values in case you need to rollback

