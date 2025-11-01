# IP Configuration Environment Changes

## Summary
All hardcoded IP addresses have been replaced with environment variable references. The system now reads the server IP from the `.env` file and falls back to `localhost` if not configured.

## Changes Made

### 1. **video_module.py** ✅
- **Before:** `SERVER_IP = os.getenv('SERVER_IP', '172.20.10.9')`
- **After:** `SERVER_IP = os.getenv('SERVER_IP', 'localhost')`
- Uses the SERVER_IP from `.env` for creating video session links
- Falls back to localhost if not specified

### 2. **client.py** ✅
- **Before:** `SERVER_IP = os.getenv('SERVER_IP', '172.20.10.9')`
- **After:** `SERVER_IP = os.getenv('SERVER_IP', 'localhost')`
- Uses the SERVER_IP for connecting to video/audio servers
- Falls back to localhost if not specified

### 3. **audio_module.py** ✅
- **Before:** `def __init__(self, username: str, server_host: str = '192.168.137.175', audio_port: int = 5557)`
- **After:** Uses `DEFAULT_AUDIO_SERVER_IP` from environment or localhost as default
- Added imports for `.env` file loading
- Falls back to localhost if SERVER_IP not in `.env`

### 4. **web/index.html** ✅
- **Before:** `<input type="text" id="hostInput" placeholder="localhost" value="172.20.10.9" autocomplete="off">`
- **After:** `<input type="text" id="hostInput" placeholder="localhost" value="localhost" autocomplete="off">`
- User can still manually override the server IP in the login form
- Default is now localhost (user-friendly for local networks)

### 5. **.env file** ✅
Updated with better documentation:
```properties
# Server Configuration
# Change this to your server's IP address
# Default is 'localhost' if not specified
SERVER_IP=172.20.10.3
```

## How It Works

1. **Environment Variable Priority:**
   - Primary: Read from `.env` file (`SERVER_IP=your.ip.here`)
   - Secondary Fallback: Use `localhost` as default

2. **User Override:**
   - Users can still manually enter a different server IP in the login screen
   - This overrides both the environment variable and default

3. **For All Components:**
   - Video Module: Uses SERVER_IP for video sessions
   - Audio Module: Uses SERVER_IP for audio sessions
   - Client: Uses SERVER_IP for connecting to servers
   - Web UI: Defaults to localhost, user can change

## How to Change Server IP

### Option 1: Edit `.env` file (Recommended)
```bash
# Change this line in .env:
SERVER_IP=your.server.ip.address
# Example:
SERVER_IP=192.168.1.100
```

### Option 2: Change at Runtime
- Users can manually enter the server IP in the login screen

### Option 3: Environment Variable
```bash
# Linux/Mac:
export SERVER_IP=192.168.1.100
python client.py

# Windows PowerShell:
$env:SERVER_IP="192.168.1.100"
python client.py
```

## Migration Benefits

✅ **No More Hardcoded IPs** - All IPs are now configurable
✅ **Easy Switching** - Change one line in `.env` to switch servers
✅ **Localhost Friendly** - Works out-of-the-box for local testing
✅ **User Flexible** - Users can override at runtime
✅ **Consistent** - All modules use the same environment variable
✅ **Backward Compatible** - Old IP configuration still works if set in `.env`

## Testing

To verify everything works:

1. **With localhost (default):**
   ```bash
   # Just run without changing .env
   python server.py
   python client.py
   ```

2. **With custom IP:**
   ```bash
   # Update .env:
   SERVER_IP=192.168.x.x
   
   # Then run:
   python server.py
   python client.py
   ```

3. **Override at login:**
   - Leave SERVER_IP in .env as default
   - Manually enter different IP in login screen

## Notes

- Server listens on `0.0.0.0` (all interfaces) - only client needs SERVER_IP configuration
- The SERVER_IP is used by clients to connect to the server
- Video/Audio modules on the server also use SERVER_IP to notify clients of the session address
- All SSL certificates include localhost, 127.0.0.1, and the configured SERVER_IP
