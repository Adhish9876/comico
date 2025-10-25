# Shadow Nexus - Secure Chat & Video Platform

A comprehensive real-time communication platform with chat, file sharing, audio messages, and video calls.

## 🚀 Features

- **Real-time Chat**: Global, private, and group messaging
- **File Sharing**: Upload and share files with other users
- **Audio Messages**: Record and send voice messages
- **Video Calls**: WebRTC-based video calling (global, private, group)
- **User Authentication**: MAC address-based device authentication
- **Message Persistence**: All messages are saved and restored on restart
- **Secure Communication**: HTTPS/WSS with self-signed certificates

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd shadow-nexus
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## 🏃‍♂️ Running the Application

### Start the Chat Server
```bash
python server.py
```

### Start the Video Server (Optional)
```bash
python video_module.py
```

### Start the Client
```bash
python client.py
```

The client will open a web interface at `http://localhost:8081`

## 📁 Project Structure

```
shadow-nexus/
├── server.py              # Main chat server
├── client.py              # Client application (Eel-based)
├── video_module.py        # Video calling server
├── auth_module.py         # Authentication system
├── audio_module.py        # Audio message handling
├── storage.py             # Data persistence
├── requirements.txt       # Python dependencies
├── web/                   # Frontend files
│   ├── index.html
│   ├── app.js
│   └── style.css
└── shadow_nexus_data/     # Data storage (auto-created)
```

## 🔧 Configuration

- **Server Host/Port**: Modify in `server.py` (default: localhost:5555)
- **Video Server**: Runs on port 5000 with HTTPS
- **Client Port**: Configurable via command line argument

## 🔐 Security Features

- MAC address-based device authentication
- Self-signed SSL certificates for HTTPS
- Secure WebSocket connections
- Password-protected user accounts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source. Please check the license file for details.

## 🐛 Known Issues

- Video calls require HTTPS (self-signed certificates)
- Audio recording requires microphone permissions
- File uploads limited to 2GB

## 📞 Support

For issues and questions, please open a GitHub issue.