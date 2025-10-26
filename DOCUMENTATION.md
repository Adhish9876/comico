# Shadow Nexus - Complete Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [How It Works](#how-it-works)
5. [Features](#features)
6. [Getting Started](#getting-started)
7. [Building & Distribution](#building--distribution)

---

## Overview

**Shadow Nexus** is a LAN-based collaboration platform that provides:
- Real-time text chat (global, private, group)
- Audio messaging
- File sharing
- Video calling with WebRTC
- Device-based authentication
- Persistent message storage

**Technology Stack:**
- **Backend**: Python (Socket programming, Flask)
- **Frontend**: HTML/CSS/JavaScript (Eel framework)
- **Real-time Communication**: WebSockets, TCP Sockets
- **Video**: WebRTC with Socket.IO
- **Storage**: JSON-based file storage

---

## Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser    │  │  Eel Bridge  │  │  Python      │      │
│  │  (Web UI)    │◄─┤  (JS↔Python) │◄─┤  Client      │      │
│  │ HTML/CSS/JS  │  │              │  │  Logic       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ TCP Sockets
                            │ (Port 5555-5557)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVER LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Chat       │  │   File       │  │   Audio      │      │
│  │   Server     │  │   Server     │  │   Server     │      │
│  │  (Port 5555) │  │  (Port 5556) │  │  (Port 5557) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTPS/WebSocket
                            │ (Port 5000)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       VIDEO LAYER                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Video Server (Flask + Socket.IO)             │   │
│  │              WebRTC Signaling Server                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              JSON File Storage                       │   │
│  │  • global_chat.json  • private_chats.json           │   │
│  │  • group_chats.json  • files.json                   │   │
│  │  • users.json        • users_auth.json              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Core Application Files

#### **client.py** - Client Application
- **Purpose**: Main client application that users run
- **What it does**:
  - Connects to the server via TCP sockets
  - Manages user authentication
  - Handles message sending/receiving
  - Bridges Python backend with web UI via Eel
  - Manages audio recording/playback
  - Handles file uploads/downloads
- **Key Features**:
  - Automatic port detection (8081-8090)
  - Lazy module loading for fast startup
  - Real-time message synchronization

#### **server.py** - Main Server
- **Purpose**: Central server that handles all client connections
- **What it does**:
  - Accepts client connections (Port 5555)
  - Routes messages between clients
  - Manages chat rooms (global, private, group)
  - Handles file transfers (Port 5556)
  - Stores messages persistently
  - Broadcasts user status updates
- **Key Features**:
  - Multi-threaded connection handling
  - Message persistence with storage.py
  - Automatic reconnection handling

#### **video_module.py** - Video Server
- **Purpose**: WebRTC signaling server for video calls
- **What it does**:
  - Creates video call sessions
  - Manages WebRTC peer connections
  - Handles video/audio/screen sharing signals
  - Notifies chat server of call events
- **Ports**: 5000 (HTTPS + WebSocket)
- **Technology**: Flask + Socket.IO

#### **storage.py** - Data Persistence
- **Purpose**: Manages all data storage operations
- **What it does**:
  - Saves/loads chat messages (global, private, group)
  - Stores file metadata
  - Manages user information
  - Provides data retrieval methods
- **Storage Format**: JSON files in `shadow_nexus_data/`

#### **auth_module.py** - Authentication
- **Purpose**: Device-based authentication system
- **What it does**:
  - Registers devices by MAC address
  - Verifies user credentials
  - Manages password resets with security questions
  - Stores encrypted passwords
- **Security**: Password hashing with SHA-256

#### **audio_module.py** - Audio System
- **Purpose**: Handles audio recording and playback
- **What it does**:
  - Records audio messages (WAV format)
  - Plays audio messages
  - Manages audio streams for voice calls
  - Handles microphone permissions
- **Technology**: PyAudio + NumPy

### Web Interface Files

#### **web/index.html** - Main UI
- **Purpose**: User interface structure
- **Contains**:
  - Splash screen
  - Login/Signup screens
  - Chat interface
  - Video call UI
  - Settings panels

#### **web/app.js** - Frontend Logic
- **Purpose**: Client-side application logic
- **What it does**:
  - Handles user interactions
  - Manages chat state
  - Renders messages dynamically
  - Communicates with Python via Eel
  - Manages local storage
  - Handles notifications

#### **web/style.css** - Styling
- **Purpose**: Visual design and animations
- **Features**:
  - Cyan/Purple theme
  - Smooth animations
  - Responsive layout
  - Dark mode optimized

#### **web/simple_reply.js** - Reply System
- **Purpose**: Message reply functionality
- **What it does**:
  - Handles reply-to-message feature
  - Shows reply context
  - Manages reply UI

### Video Call Files

#### **templates/video_room.html** - Video Call UI
- **Purpose**: Video call interface
- **Features**:
  - Grid layout for multiple participants
  - Camera on/off with colorful thumbnails
  - Screen sharing
  - Hand raise
  - Reactions
  - Noise suppression

### Build & Configuration Files

#### **client.spec** - PyInstaller Config
- **Purpose**: Defines how to build the executable
- **Includes**:
  - Files to bundle
  - Icon configuration
  - Hidden imports
  - Exclusions for smaller size

#### **build_exe.bat** - Build Script
- **Purpose**: One-click executable builder
- **What it does**:
  - Copies icon files
  - Cleans old builds
  - Runs PyInstaller
  - Shows build status

### Data Storage Files

#### **shadow_nexus_data/** - Data Directory
- **global_chat.json**: All global chat messages
- **private_chats.json**: Private conversations
- **group_chats.json**: Group chat messages
- **files.json**: File metadata
- **users.json**: User information
- **users_auth.json**: Authentication data

---

## How It Works

### 0. Three-Tier Storage System

Shadow Nexus uses **three levels of storage** for optimal performance:

#### **Level 1: JavaScript Array (RAM)**
```javascript
// app.js
const chatHistories = {
    global: [],  // Messages you see on screen
    private: {},
    group: {}
};
```
- **Location**: Browser memory (RAM)
- **Speed**: ⚡ Instant (<1ms)
- **Survives**: Only while page is open
- **Purpose**: Active display, real-time updates

#### **Level 2: Browser localStorage (Disk)**
```javascript
// Saves to browser's disk
localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
```
- **Location**: Browser's local storage on your computer
- **Speed**: Fast (~10ms)
- **Survives**: Page refresh, browser close
- **Purpose**: Quick loading, offline cache

#### **Level 3: Server Storage (Permanent)**
```python
# storage.py saves to JSON files
storage.add_global_message(message)
# → shadow_nexus_data/global_chat.json
```
- **Location**: Server's disk (JSON files)
- **Speed**: Network dependent (~50-100ms)
- **Survives**: Server restarts, forever
- **Purpose**: Master copy, shared across all users

#### **Why Three Levels?**

**Without this system:**
- Every page refresh = wait 3-5 seconds for server
- Server restart = all messages lost
- New users = no chat history

**With this system:**
- Page refresh = instant (loads from localStorage)
- Server restart = messages restored from JSON
- New users = get full history from server
- Real-time = JS array updates instantly

#### **How They Work Together:**

```
You send "Hello!"
    ↓
1. JS array adds message → Shows on screen (instant) ⚡
2. localStorage saves → Backup created 💾
3. Sends to server → Network transmission 🌐
4. Server saves to JSON → Permanent storage 🗄️
5. Server broadcasts → Everyone receives 📢
6. Other clients update their JS arrays → Everyone sees it ✅
```

**On page refresh:**
```
1. Load from localStorage (0.1s) → Messages appear instantly
2. Connect to server (background)
3. Server sends any new messages
4. Merge and update display
```

**On server restart:**
```
1. Server loads from global_chat.json
2. All messages restored
3. New users get full history
4. No data loss ✅
```

---

### 1. Application Startup

```
User runs client.py
    ↓
Eel initializes web server (Port 8081+)
    ↓
Browser opens with splash screen
    ↓
Auth module checks device registration
    ↓
If registered → Login screen
If not → Signup screen
```

### 2. Authentication Flow

```
User enters credentials
    ↓
auth_module.py verifies MAC address + password
    ↓
If valid → Connect to server
If invalid → Show error (3 attempts → show forgot password)
```

### 3. Server Connection

```
Client connects to server (Port 5555)
    ↓
Sends username in JSON format
    ↓
Server stores client socket
    ↓
Server sends welcome data:
  • Chat history (last 300 messages)
  • User list
  • Group list
  • File metadata
    ↓
Client receives and displays data
```

### 4. Real-Time Communication

#### Message Flow (Text Chat)

```
User types message in browser
    ↓
JavaScript (app.js) captures input
    ↓
Calls Python via Eel: eel.send_message()
    ↓
client.py sends JSON to server via socket
    ↓
server.py receives and processes message
    ↓
server.py broadcasts to all connected clients
    ↓
Each client receives message
    ↓
Eel calls JavaScript: eel.handleMessage()
    ↓
app.js renders message in chat
```

#### Message Format

```json
{
  "type": "chat",
  "sender": "Username",
  "content": "Hello!",
  "timestamp": "08:30 PM"
}
```

### 5. File Sharing

```
User selects file
    ↓
JavaScript reads file as base64
    ↓
Calls eel.upload_file()
    ↓
client.py connects to file server (Port 5556)
    ↓
Sends file metadata + data
    ↓
server.py stores file and metadata
    ↓
Broadcasts file notification to all clients
    ↓
Other users can download via file_id
```

### 6. Audio Messages

```
User clicks record button
    ↓
audio_module.py starts recording (PyAudio)
    ↓
Records to WAV format
    ↓
Converts to base64
    ↓
Sends as audio_message type
    ↓
Server stores with audio_data
    ↓
Recipients can play audio
```

### 7. Video Calls

```
User clicks video call button
    ↓
client.py calls video server API (Port 5000)
    ↓
video_module.py creates session
    ↓
Returns session_id and link
    ↓
Client sends video_invite message
    ↓
Recipients receive invite
    ↓
Click join → Opens video_room.html
    ↓
WebRTC peer connections established
    ↓
Video/audio streams exchanged
```

### 8. Data Persistence

```
Message sent
    ↓
server.py receives message
    ↓
Calls storage.add_global_message()
    ↓
storage.py appends to global_chat list
    ↓
Saves to global_chat.json
    ↓
On server restart:
  storage.py loads all JSON files
  Messages restored automatically
```

---

## Features

### 🔐 Authentication
- **Device-based**: One account per device (MAC address)
- **Password protection**: SHA-256 hashed passwords
- **Security questions**: Password recovery system
- **Auto-login**: Remembers device after first login

### 💬 Chat System
- **Global Chat**: Everyone sees messages
- **Private Chat**: 1-on-1 conversations
- **Group Chat**: Create groups with multiple users
- **Message Reply**: Reply to specific messages
- **Message Delete**: Delete messages for everyone
- **Typing Indicators**: See when others are typing
- **Read Receipts**: Message delivery status

### 🎤 Audio Features
- **Audio Messages**: Record and send voice messages
- **Persistent Audio**: Audio data saved permanently
- **Playback Controls**: Play/pause audio messages
- **Duration Display**: Shows audio length

### 📁 File Sharing
- **Large Files**: Up to 2GB per file
- **Any File Type**: Documents, images, videos, etc.
- **Download Tracking**: See who uploaded files
- **File History**: All files accessible anytime

### 🎥 Video Calls
- **WebRTC**: Peer-to-peer video/audio
- **Screen Sharing**: Share your screen
- **Multiple Participants**: Up to 10 people
- **Grid Layout**: Automatic layout adjustment
- **Camera Off Thumbnails**: Colorful user initials (12 themes)
- **Hand Raise**: Non-verbal communication
- **Reactions**: Send emoji reactions
- **Noise Suppression**: Reduce background noise

### 🎨 User Interface
- **Theme**: Cyan/Purple gradient
- **Dark Mode**: Eye-friendly dark theme
- **Smooth Animations**: Polished transitions
- **Responsive**: Works on different screen sizes
- **Notifications**: Subtle border-only notifications
- **Custom Icon**: PNG favicon

### ⚙️ Technical Features
- **Auto Port Detection**: No port conflicts
- **Fast Startup**: ~1 second load time
- **Lazy Loading**: Modules load on demand
- **Persistent Storage**: All data saved
- **Auto Reconnect**: Handles connection drops
- **Multi-threaded**: Handles many users
- **Low Latency**: Real-time communication

---

## Getting Started

### Prerequisites

```bash
# Required
Python 3.12+
pip (Python package manager)

# Optional (for development)
Git
```

### Installation

1. **Clone or Download** the project

2. **Install Dependencies**
```bash
pip install -r requirements.txt
```

Required packages:
- eel (Web UI)
- pyaudio (Audio)
- numpy (Audio processing)
- opencv-python (Video)
- requests (HTTP)
- flask (Video server)
- flask-socketio (WebRTC signaling)
- cryptography (SSL certificates)

3. **Generate SSL Certificates** (automatic on first run)
```bash
python video_module.py
# Will generate cert.pem and key.pem
```

### Running the Application

#### Start the Server

```bash
# Terminal 1: Main Server
python server.py

# Terminal 2: Video Server
python video_module.py
```

#### Start the Client

```bash
# Terminal 3: Client
python client.py
```

Or just double-click `client.py` on Windows!

### First Time Setup

1. **Signup Screen** appears
2. Enter username and password (min 4 chars)
3. Device is registered with MAC address
4. Automatically logs in
5. Connect to server (enter server IP)
6. Start chatting!

### Network Setup

#### Same Computer (Testing)
- Server: `localhost` or `127.0.0.1`
- Ports: 5555, 5556, 5557, 5000

#### LAN Network
1. Find server's IP address:
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```
2. Clients connect to server's IP
3. Ensure firewall allows ports 5555-5557, 5000

#### Hotspot
1. Create mobile hotspot
2. Connect all devices to hotspot
3. Use hotspot IP as server address

---

## Building & Distribution

### Build Executable

```bash
# Run the build script
build_exe.bat
```

This will:
1. Copy icon files
2. Clean old builds
3. Run PyInstaller
4. Create `dist/ShadowNexusClient/ShadowNexusClient.exe`

### Distribute to Others

**Share the entire folder:**
```
dist/ShadowNexusClient/
├── ShadowNexusClient.exe  ← Main executable
├── _internal/              ← Required libraries
├── web/                    ← Web interface
└── templates/              ← Video call UI
```

**Users just need to:**
1. Copy the folder
2. Double-click `ShadowNexusClient.exe`
3. No Python installation needed!

### File Size
- Executable: ~200MB (includes Python + all libraries)
- Startup time: ~1 second

---

## Port Reference

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| 5555 | Chat Server | TCP | Text messages, user management |
| 5556 | File Server | TCP | File uploads/downloads |
| 5557 | Audio Server | TCP | Audio streaming (future) |
| 5000 | Video Server | HTTPS/WS | WebRTC signaling |
| 8081+ | Client UI | HTTP | Web interface (auto-increments) |

---

## Troubleshooting

### Port Already in Use
- **Client**: Automatically tries next port (8082, 8083...)
- **Server**: Stop existing server or change port in code

### Connection Refused
- Check server is running
- Verify IP address is correct
- Check firewall settings
- Ensure ports are open

### Audio Not Working
- Check microphone permissions
- Verify PyAudio is installed
- Test with `python -m pyaudio`

### Video Call Issues
- Accept SSL certificate warning in browser
- Check camera/microphone permissions
- Ensure video server is running
- Verify port 5000 is open

### SSL Certificate Errors
- These are normal for self-signed certificates
- Click "Advanced" → "Proceed anyway" in browser
- Errors in terminal can be ignored

---

## Development Tips

### Adding New Features

1. **Backend (Python)**
   - Add handler in `server.py`
   - Update message routing
   - Add storage method if needed

2. **Frontend (JavaScript)**
   - Add UI in `web/index.html`
   - Add logic in `web/app.js`
   - Style in `web/style.css`

3. **Bridge (Eel)**
   - Expose Python function with `@eel.expose`
   - Call from JS with `eel.function_name()`

### Testing

```bash
# Test with multiple clients
python client.py 8081  # Client 1
python client.py 8082  # Client 2
python client.py 8083  # Client 3
```

### Debugging

- **Client logs**: Check terminal running `client.py`
- **Server logs**: Check terminal running `server.py`
- **Browser console**: F12 → Console tab
- **Network**: F12 → Network tab

---

## Credits

**Shadow Nexus** - LAN Collaboration Platform
- Real-time chat with WebSockets
- WebRTC video calling
- Device-based authentication
- Persistent storage
- Modern UI with smooth animations

Built with Python, JavaScript, and lots of ☕

---

## License

This project is for educational and personal use.

---

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in terminal
3. Check browser console (F12)
4. Verify all servers are running
5. Test network connectivity

---

**Last Updated**: October 2025
**Version**: 2.0
**Status**: Production Ready ✅
