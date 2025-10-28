# Server Keepalive Fixes - Preventing Inactivity

## Problem
Server was going inactive after a few minutes, causing:
- Disconnected video/audio calls
- Lost WebRTC connections
- Users unable to rejoin

## Solutions Applied

### 1. **SocketIO Keepalive Configuration** ✅

**File**: `video_module.py`

```python
socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    ping_timeout=120,      # 2 minutes before considering connection dead
    ping_interval=25,      # Send ping every 25 seconds
    async_mode='threading',
    logger=False,
    engineio_logger=False
)
```

**What it does:**
- Server sends ping to clients every 25 seconds
- Waits up to 2 minutes for response before disconnecting
- Keeps connections alive automatically

### 2. **Client-Side Keepalive Pings** ✅

**Files**: `templates/video_room.html`, `templates/audio_room.html`

```javascript
// Send ping every 20 seconds
setInterval(() => {
    if (socket.connected) {
        socket.emit('ping');
    }
}, 20000);
```

**What it does:**
- Client sends ping to server every 20 seconds
- Server responds with pong
- Prevents timeout from client side

### 3. **TCP Keepalive (Main Server)** ✅

**File**: `server.py`

```python
# Windows
sock.ioctl(socket.SIO_KEEPALIVE_VALS, (1, 30000, 10000))

# Linux/Unix
sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 30)
sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 10)
```

**What it does:**
- OS-level keepalive for TCP connections
- Detects dead connections at network layer
- Works even if application is unresponsive

### 4. **Background Keepalive Thread** ✅

**File**: 