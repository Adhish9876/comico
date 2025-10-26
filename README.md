# Shadow Nexus 🌐

**A modern LAN-based chat and collaboration platform with real-time messaging, video calls, and file sharing.**

> 🏠 **LAN-First Design** - Optimized for local networks, hotspots, and offline environments



![Python](https://img.shields.io/badge/python-3.12+-green)
![Eel](https://img.shields.io/badge/eel-0.17+-purple)
![JavaScript](https://img.shields.io/badge/javascript-ES2023+-yellow)
![CSS](https://img.shields.io/badge/css-3+-blue)




## 📸 Screenshots

### Main Chat Interface
![Main Chat Interface](screenshots/main-chat.png)
*Real-time messaging with global, private, and group chats*

### Video Call Interface
![Video Call](screenshots/video-call.png)
*WebRTC video calls with up to 10 participants*

### Login & Authentication
![Login Screen](screenshots/login-screen.png)
*Device-based authentication with security questions*

---

## ✨ Features

### 💬 LAN Communication
- **Global Chat** - Everyone on your local network
- **Private Chat** - 1-on-1 conversations within LAN
- **Group Chat** - Create custom groups on your network
- **Audio Messages** - Voice recordings (stored locally)
- **Message Replies** - Reply to specific messages

### 🎥 LAN Video Calls
- **WebRTC Video** - High-quality peer-to-peer over LAN
- **Screen Sharing** - Share your screen with local participants
- **Up to 10 Participants** - Group video calls on your network
- **Colorful Thumbnails** - 12 unique themes when camera is off
- **Reactions & Hand Raise** - Non-verbal communication

### 📁 Local File Sharing
- **Large Files** - Up to 2GB per file over LAN
- **Any File Type** - Documents, images, videos
- **Local Storage** - Files saved on the server machine

### 🔐 LAN Security
- **Device-Based Auth** - One account per device (MAC address)
- **Local Password Storage** - Encrypted passwords stored locally
- **Security Questions** - Password recovery without internet

### 🎨 User Experience
- **Cyan/Purple Theme** - Modern dark mode
- **Smooth Animations** - Polished interface
- **Instant Loading** - ~1 second startup
- **Auto Port Detection** - No conflicts on LAN
- **Offline Cache** - Works without internet connection

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12 or higher
- Windows/Linux/Mac

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd shadow-nexus
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Start the servers**
```bash
# Terminal 1: Main Server
python server.py

# Terminal 2: Video Server
python video_module.py
```

4. **Start the client**
```bash
# Terminal 3: Client
python client.py
```

5. **First-time setup**
- Create account (username + password)
- Connect to server (use `localhost` for testing)
- Start chatting!

### Setup Screenshots

![Setup Process](screenshots/setup-process.png)
*Step-by-step setup: Signup → Login → Connect to Server*

---

## 📦 Building Executable

Create a standalone `.exe` for easy distribution:

```bash
build_exe.bat
```

**Output:** `dist/ShadowNexusClient/ShadowNexusClient.exe`

**Share with others:**
- Copy the entire `dist/ShadowNexusClient/` folder
- No Python installation needed!
- Just double-click the `.exe`

### Build Process
![Build Process](screenshots/build-process.png)
*Building the executable with custom icon and features*

---

## 🌐 LAN Network Setup

### Same Computer (Testing)
```
Server: localhost
Ports: 5555, 5556, 5557, 5000
```

### Local Area Network (LAN)
1. Find server's IP address:
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```
2. All clients connect using server's LAN IP
3. Ensure firewall allows ports 5555-5557, 5000
4. **No internet required** - works completely offline

### Mobile Hotspot (Portable LAN)
1. Create hotspot on one device
2. Connect all devices to the same hotspot
3. Use hotspot IP as server address
4. **Perfect for offline meetings** and remote locations

### Network Setup Examples
![Network Setup](screenshots/network-setup.png)
*Different network configurations: LAN, Hotspot, and Local testing*

---

## 📂 Project Structure

```
shadow-nexus/
├── client.py              # Client application
├── server.py              # Main server
├── video_module.py        # Video call server
├── storage.py             # Data persistence
├── auth_module.py         # Authentication
├── audio_module.py        # Audio handling
├── web/                   # Web interface
│   ├── index.html         # UI structure
│   ├── app.js             # Frontend logic
│   └── style.css          # Styling
├── templates/             # Video call UI
│   └── video_room.html
├── shadow_nexus_data/     # Data storage
│   ├── global_chat.json
│   ├── private_chats.json
│   ├── group_chats.json
│   └── users_auth.json
└── build_exe.bat          # Build script
```

---

## 🔧 Configuration

### Ports Used

| Port | Service | Purpose |
|------|---------|---------|
| 5555 | Chat Server | Text messages |
| 5556 | File Server | File transfers |
| 5557 | Audio Server | Audio streaming |
| 5000 | Video Server | WebRTC signaling |
| 8081+ | Client UI | Web interface |

### Changing Server IP

Edit in `client.py`:
```python
self.server_host = "192.168.1.100"  # Your server IP
```

---

## 💡 How It Works

### Architecture
```
Browser (HTML/JS) ↔ Eel Bridge ↔ Python Client ↔ TCP Socket ↔ Python Server ↔ JSON Storage
```

### Message Flow
1. You type message in browser
2. JavaScript captures it
3. Eel bridge calls Python function
4. Client sends to server via socket
5. Server broadcasts to all clients
6. Everyone receives and displays message

### Storage System
- **JS Array** - What you see (instant)
- **localStorage** - Browser backup (survives refresh)
- **Server JSON** - Permanent storage (shared with all)

---

## 🎯 Key Features Explained

### Real-Time Communication
- Uses persistent TCP sockets (not HTTP polling)
- Messages appear in ~50-100ms
- Bidirectional communication

### Three-Tier Storage
- **Level 1**: Browser RAM (instant display)
- **Level 2**: Browser disk (quick reload)
- **Level 3**: Server disk (permanent, shared)

### Device-Based Auth
- Each device registers with MAC address
- Passwords stored locally (encrypted)
- Server only sees username + IP

## 🎨 Feature Showcase

### Chat Features
![Chat Features](screenshots/chat-features.png)
*Message replies, audio messages, file sharing, and typing indicators*

### Video Call Features
![Video Features](screenshots/video-features.png)
*Screen sharing, reactions, hand raise, and colorful camera-off thumbnails*

### File Sharing
![File Sharing](screenshots/file-sharing.png)
*Drag & drop file uploads with progress tracking*

### Audio Messages
![Audio Messages](screenshots/audio-messages.png)
*Voice recordings with playback controls and waveform visualization*

---

## 🐛 Troubleshooting

### Port Already in Use
- Client auto-detects next available port (8082, 8083...)
- Server: Stop existing instance or change port

### Connection Refused
- Verify server is running
- Check IP address is correct
- Ensure firewall allows connections

### SSL Certificate Warnings
- Normal for self-signed certificates
- Click "Advanced" → "Proceed anyway"
- Terminal errors can be ignored

### Audio Not Working
- Check microphone permissions
- Verify PyAudio is installed
- Test with: `python -m pyaudio`

---

## 📚 Documentation

For detailed information, see:
- **[DOCUMENTATION.md](DOCUMENTATION.md)** - Complete technical guide
- **[QUICK_START.md](QUICK_START.md)** - Step-by-step tutorial
- **[README_EXE.md](README_EXE.md)** - Executable build guide

---

## 🛠️ Development

### Adding Features
1. Backend: Add handler in `server.py`
2. Frontend: Update `web/app.js` and `web/index.html`
3. Bridge: Use `@eel.expose` for Python functions

### Testing
```bash
# Run multiple clients
python client.py 8081
python client.py 8082
python client.py 8083
```

### Debugging
- Client logs: Terminal running `client.py`
- Server logs: Terminal running `server.py`
- Browser console: Press F12

---

## 📊 Tech Stack

**Backend:**
- Python 3.12
- Socket programming (TCP)
- Flask + Socket.IO (WebRTC)
- PyAudio (Audio)

**Frontend:**
- HTML5 + CSS3
- Vanilla JavaScript
- Eel (Python-JS bridge)
- WebRTC (Video)

**Storage:**
- JSON files (lightweight, portable)

---

## 🎓 Requirements

```
eel>=3.1.4
pyaudio>=0.2.13
numpy>=1.24.0
opencv-python>=4.8.0
requests>=2.31.0
flask>=3.0.0
flask-socketio>=5.3.0
cryptography>=41.0.0
```

Install all:
```bash
pip install -r requirements.txt
```

---

## 🤝 Contributing

This is a personal/educational project. Feel free to:
- Fork and modify
- Report issues
- Suggest improvements

---

## 📝 License

MIT License - Free for personal and educational use.

---

## 🌟 Highlights

- ⚡ **Fast** - 1 second startup, instant LAN messaging
- 🎨 **Modern** - Sleek dark theme with smooth animations
- 🔒 **Secure** - Device-based auth, local encryption
- 💾 **Persistent** - All data saved locally on server
- 🌐 **LAN-First** - Works completely offline, no internet needed
- 📦 **Portable** - Single executable, perfect for offline environments

---

## 📞 Support

**Having issues?**
1. Check [DOCUMENTATION.md](DOCUMENTATION.md)
2. Review error messages in terminal
3. Check browser console (F12)
4. Verify all servers are running

---

**Built with ❤️ and ☕**

*Shadow Nexus - Where LAN collaboration happens in real-time, no internet required*
