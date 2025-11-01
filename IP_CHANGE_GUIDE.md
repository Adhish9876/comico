# Complete Guide: Changing Server IP for Chat and Video/Audio Calls

When you want to change the server IP address in your Shadow Nexus application, you need to update it in **multiple locations**. Here's the complete list:

---

## 🔴 CRITICAL - Main Configuration Files (Change Here First)

### 1. **`.env` File** (Environment Variables)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\.env`

```properties
# Change this line:
SERVER_IP=172.20.10.9

# To your new IP:
SERVER_IP=YOUR_NEW_IP_ADDRESS
```

This is the **PRIMARY** source of truth. All Python files read from this.

---

## 🟠 IMPORTANT - Python Files (Read from .env)

These files automatically read from the `.env` file through `os.getenv()`, so they update automatically:

### 2. **`client.py`** (Client Connection)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\client.py`
**Line:** ~22
```python
SERVER_IP = os.getenv('SERVER_IP', '172.20.10.9')
```
- **Fallback IP (line 22):** `172.20.10.9` - Update this if `.env` file doesn't exist
- The client will connect to the chat server using this IP on port 5555

### 3. **`video_module.py`** (Video Server)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\video_module.py`
**Line:** ~25
```python
SERVER_IP = os.getenv('SERVER_IP', '172.20.10.9')
```
- **Fallback IP (line 25):** `172.20.10.9`
- Used for the video call signaling server (port 5000)
- Used when rendering video room templates

### 4. **`server.py`** (Chat Server)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\server.py`
- Does NOT directly use `SERVER_IP` for listening (listens on `0.0.0.0:5555`)
- ✅ No changes needed here

---

## 🟡 FRONTEND - HTML/JavaScript Files (Hardcoded Inputs)

### 5. **`web/index.html`** (Connection Input Field)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\web\index.html`
**Line:** ~206
```html
<input type="text" id="hostInput" placeholder="localhost" value="172.20.10.9" autocomplete="off">
```

- This is the **default value** shown in the connection form
- Users can override this at runtime by typing in the input field
- **Recommendation:** Update to your new IP for convenience

### 6. **`web/app.js`** (Frontend Logic)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\web\app.js`
- ✅ Uses hostname input from the form - **No hardcoded IPs**
- Sends the IP from the connection form to the Python backend

---

## 🟢 TEMPLATES - Server-Side Rendering

### 7. **`templates/video_room.html`** (Video Conference Page)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\templates\video_room.html`
- Uses the `server_ip` variable passed from `video_module.py`
- **Automatically updated** when you change the `.env` file

### 8. **`templates/audio_room.html`** (Audio Call Page)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\templates\audio_room.html`
- Uses the `server_ip` variable passed from `video_module.py`
- **Automatically updated** when you change the `.env` file

---

## 🔵 SSL CERTIFICATE (If Using HTTPS)

### 9. **`cert.pem` & `key.pem`** (SSL Certificates)
**Location:** `c:\Users\adhis\Downloads\comico-main\comico-main\cert.pem` and `.key`

If you're changing your IP, you may need to regenerate SSL certificates:

```powershell
# Install mkcert first (if not already installed)
choco install mkcert

# Generate new certificate with your new IP
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 YOUR_NEW_IP_ADDRESS 0.0.0.0
```

Or use the PowerShell script:
```powershell
.\install_mkcert_manual.ps1
```

---

## 📋 Summary Table

| File/Component | Location | Current IP | Needs Change | Automatic |
|---|---|---|---|---|
| `.env` | `.env` | 172.20.10.9 | ✅ YES (PRIMARY) | - |
| `client.py` (fallback) | `client.py` line 22 | 172.20.10.9 | ⚠️ Optional | ✅ Reads .env |
| `video_module.py` (fallback) | `video_module.py` line 25 | 172.20.10.9 | ⚠️ Optional | ✅ Reads .env |
| HTML Input | `web/index.html` line 206 | 172.20.10.9 | ⚠️ Recommended | ❌ Hardcoded |
| Video Templates | `templates/video_room.html` | Dynamic | - | ✅ Auto-passed |
| Audio Templates | `templates/audio_room.html` | Dynamic | - | ✅ Auto-passed |
| SSL Certificates | `cert.pem` / `key.pem` | Depends | ✅ YES (if HTTPS) | ❌ Manual |

---

## 🚀 Step-by-Step Change Process

### **Option 1: Quick Change (Recommended)**
If the `.env` file exists and is being used:

1. Edit `.env`:
   ```properties
   SERVER_IP=YOUR_NEW_IP_ADDRESS
   ```

2. (Optional) Update `web/index.html` line 206 for UI convenience:
   ```html
   <input type="text" id="hostInput" placeholder="localhost" value="YOUR_NEW_IP_ADDRESS" autocomplete="off">
   ```

3. (If using HTTPS) Regenerate SSL certificates:
   ```powershell
   mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 YOUR_NEW_IP_ADDRESS 0.0.0.0
   ```

4. Restart the server and client

### **Option 2: Manual Change (For All Scenarios)**
If you want to ensure everything works regardless of `.env`:

1. Change `.env` file (if exists)

2. Update `client.py` line 22:
   ```python
   SERVER_IP = os.getenv('SERVER_IP', 'YOUR_NEW_IP_ADDRESS')
   ```

3. Update `video_module.py` line 25:
   ```python
   SERVER_IP = os.getenv('SERVER_IP', 'YOUR_NEW_IP_ADDRESS')
   ```

4. Update `web/index.html` line 206:
   ```html
   <input type="text" id="hostInput" placeholder="localhost" value="YOUR_NEW_IP_ADDRESS" autocomplete="off">
   ```

5. Regenerate SSL certificates if needed

6. Restart both services

---

## 🔗 Connection Flow

```
User starts Client (client.py)
    ↓
Reads SERVER_IP from .env (falls back to hardcoded IP)
    ↓
User enters hostname in web/index.html form
    ↓
Connects to that hostname on port 5555 (chat)
    ↓
User initiates video call
    ↓
Client calls API: https://{hostname}:5000/api/create_session
    ↓
Video module creates session and returns link
    ↓
User joins video room at: https://{hostname}:5000/video/{session_id}
```

---

## 🎯 Port Reference

| Service | Port | Protocol | Notes |
|---|---|---|---|
| Chat Server | 5555 | TCP/Socket | Main messaging |
| File Transfer | 5556 | TCP/Socket | File uploads/downloads |
| Audio Engine | 5557 | TCP/Socket | Audio data streaming |
| Video Server | 5000 | HTTPS | Signaling & API |
| Web Interface | Port varies | HTTPS | Eel auto-finds port |

---

## ⚠️ Common Issues

### Issue: "Connection refused" or "Cannot connect"
- **Check:** Is the new IP address reachable from this machine?
- **Check:** Are the services running on the new IP?
- **Check:** Is the firewall blocking the ports?

### Issue: SSL certificate errors
- **Fix:** Regenerate certificates with the new IP address
- **Command:** `mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 YOUR_IP 0.0.0.0`

### Issue: Changed IP but client still connects to old IP
- **Check:** Make sure `.env` file is in the same directory as `client.py`
- **Check:** Restart the client completely (not just refresh)
- **Check:** Clear browser cache (localStorage)

---

## 📝 Notes

- **172.20.10.9** is currently configured as the default IP
- The `.env` file is the **single source of truth**
- Most Python files read from `.env` automatically via `os.getenv()`
- The web UI allows runtime IP changes (user can type any IP in the form)
- SSL certificates must include the IP address in their CN/SAN fields
- All components use HTTPS on port 5000 (video/audio APIs)

