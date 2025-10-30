# IP Configuration Update

## Summary
Successfully migrated all hardcoded IP addresses (`10.200.14.204`) to use environment variables. The new IP address is `172.20.10.9` and is now configurable via the `.env` file.

---

## Changes Made

### 1. Created `.env` File
Created a new `.env` file in the project root with:
```
SERVER_IP=172.20.10.9
```

### 2. Updated Python Files

#### `video_module.py`
- Added `python-dotenv` import and environment variable loading
- Replaced all hardcoded `10.200.14.204` with `SERVER_IP` variable
- Updated locations:
  - Video session link generation
  - Audio session link generation
  - Chat server connection
  - SSL certificate generation

#### `client.py`
- Added `python-dotenv` import and environment variable loading
- Replaced all hardcoded `10.200.14.204` with `SERVER_IP` variable
- Updated locations:
  - Server host configuration
  - Video API endpoint
  - Audio API endpoint
  - Port binding

### 3. Updated HTML Templates

#### `video_room.html`
- Added `server_ip` template variable
- Updated Socket.IO connection to use dynamic IP

#### `audio_room.html`
- Added `server_ip` template variable
- Updated Socket.IO connection to use dynamic IP

#### `web/index.html`
- Updated default server input value to `172.20.10.9`

### 4. Updated Dependencies
- Added `python-dotenv>=0.19.0` to `requirements.txt`

---

## Files Modified

| File | Changes |
|------|---------|
| `.env` | **NEW** - Environment configuration file |
| `video_module.py` | Added dotenv support, replaced 4 IP occurrences |
| `client.py` | Added dotenv support, replaced 4 IP occurrences |
| `templates/video_room.html` | Updated Socket.IO connection (1 occurrence) |
| `templates/audio_room.html` | Updated Socket.IO connection (1 occurrence) |
| `web/index.html` | Updated default server value (1 occurrence) |
| `requirements.txt` | Added python-dotenv dependency |

---

## Installation & Setup

### Step 1: Install Dependencies
```bash
pip install python-dotenv
```

Or install all requirements:
```bash
pip install -r requirements.txt
```

### Step 2: Configure IP Address
Edit the `.env` file to change the server IP:
```
SERVER_IP=172.20.10.9
```

### Step 3: Regenerate SSL Certificate
Delete old certificates to regenerate with new IP:
```bash
del cert.pem
del key.pem
```

### Step 4: Restart Servers
```bash
# Start video/audio server
python video_module.py

# Start chat client
python client.py
```

---

## How It Works

### Backend (Python)
1. `python-dotenv` loads variables from `.env` file
2. `SERVER_IP = os.getenv('SERVER_IP', '172.20.10.9')` reads the IP with a default fallback
3. All API endpoints, connections, and certificates use the `SERVER_IP` variable

### Frontend (HTML/JavaScript)
1. Flask passes `server_ip` to templates via `render_template()`
2. Templates use Jinja2 syntax: `{{ server_ip }}`
3. JavaScript uses template literals: `` `https://${serverIp}:5000` ``

---

## Benefits

### ✅ Easy Configuration
- Change IP in one place (`.env` file)
- No need to search and replace across multiple files

### ✅ Environment-Specific Settings
- Different IPs for development, testing, production
- Keep `.env` out of version control for security

### ✅ Default Fallback
- If `.env` is missing, defaults to `172.20.10.9`
- Prevents crashes from missing configuration

### ✅ Consistent Across All Components
- Video calls
- Audio calls
- Chat server
- SSL certificates
- Client connections

---

## Changing the IP Address

To use a different IP address:

1. **Edit `.env` file:**
   ```
   SERVER_IP=your.new.ip.here
   ```

2. **Delete old certificates:**
   ```bash
   del cert.pem
   del key.pem
   ```

3. **Restart all servers:**
   ```bash
   python video_module.py
   python client.py
   ```

4. **Update client connections:**
   - The login form in `web/index.html` will show the new default IP
   - Users can still manually enter different IPs if needed

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_IP` | `172.20.10.9` | Main server IP address for all services |

### Future Expandable Variables
You can add more configuration options to `.env`:
```
SERVER_IP=172.20.10.9
CHAT_PORT=5555
FILE_PORT=5556
AUDIO_PORT=5557
VIDEO_PORT=5000
DEBUG_MODE=false
```

---

## Security Notes

### ⚠️ Important: `.env` File Security

1. **Never commit `.env` to version control**
   - Add `.env` to `.gitignore`
   - Each environment should have its own `.env`

2. **Create `.env.example` for documentation:**
   ```
   # Copy this file to .env and configure
   SERVER_IP=172.20.10.9
   ```

3. **Restrict file permissions:**
   ```bash
   # Linux/Mac
   chmod 600 .env
   ```

---

## Troubleshooting

### Issue: "No module named 'dotenv'"
**Solution:**
```bash
pip install python-dotenv
```

### Issue: Server still uses old IP
**Solution:**
1. Check `.env` file exists in project root
2. Verify `.env` has correct format (no spaces around `=`)
3. Restart all Python processes
4. Clear browser cache

### Issue: SSL certificate errors
**Solution:**
1. Delete `cert.pem` and `key.pem`
2. Restart `video_module.py` to regenerate with new IP
3. Accept new certificate in browser

### Issue: Can't connect to server
**Solution:**
1. Verify IP address is correct in `.env`
2. Check firewall allows connections on ports 5000, 5555, 5556, 5557
3. Ensure server is running on the specified IP
4. Try pinging the IP: `ping 172.20.10.9`

---

## Testing Checklist

- [ ] `.env` file created with correct IP
- [ ] `python-dotenv` installed
- [ ] Old certificates deleted
- [ ] Video server starts without errors
- [ ] Client connects successfully
- [ ] Video calls work with new IP
- [ ] Audio calls work with new IP
- [ ] SSL certificate includes new IP
- [ ] Login form shows new default IP

---

## Migration from Old System

If you're upgrading from the hardcoded IP system:

1. **Backup your project**
2. **Create `.env` file** with your current IP
3. **Install python-dotenv:** `pip install python-dotenv`
4. **Delete old certificates:** `del cert.pem key.pem`
5. **Test thoroughly** before deploying

---

## Conclusion

The IP address is now fully configurable via environment variables. This makes the application more flexible, maintainable, and suitable for deployment across different environments. Simply update the `.env` file to change the IP address for all components.
