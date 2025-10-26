# ShadowNexus Client Executable

## ✅ Successfully Built and Optimized!

Your ShadowNexus client has been converted to a standalone executable with **instant startup** (~1 second).

### 📁 Files Created

- **`dist/ShadowNexusClient/`** - Application folder containing:
  - `ShadowNexusClient.exe` - Main executable
  - `_internal/` - Required libraries and dependencies
- **`ShadowNexusClient.bat`** - Quick launcher (root directory)
- **`launch_client.bat`** - Launcher with helpful messages
- **`client.spec`** - PyInstaller specification file
- **`build_exe.bat`** - Windows batch build script
- **`build_exe.ps1`** - PowerShell build script

### 🚀 How to Run

**Option 1: Quick Launch (Recommended)**
- Double-click `ShadowNexusClient.bat` in the root folder

**Option 2: Direct Launch**
- Navigate to `dist/ShadowNexusClient/`
- Double-click `ShadowNexusClient.exe`

**Option 3: Guided Launch**
- Double-click `launch_client.bat` for startup tips

The application will open in your default web browser automatically in ~1 second!

### 📋 What's Included

The executable bundles everything needed:
- ✅ Python runtime
- ✅ All dependencies (Eel, PyAudio, NumPy, OpenCV, etc.)
- ✅ Web interface (HTML/CSS/JS)
- ✅ Audio recording/playback support
- ✅ Authentication modules
- ✅ SSL certificates
- ✅ Data storage

### ⚙️ Requirements

- **Windows 10/11** (64-bit)
- **No Python installation needed**
- **Server must be running** before connecting
- **Microphone access** (for audio features)

### 🌐 Port Configuration

**Automatic Port Detection** ✅
- The client automatically finds an available port (starting from 8081)
- If port 8081 is in use, it tries 8082, 8083, etc.
- **Multiple users on the same machine**: No conflicts! Each instance gets its own port
- **Multiple users on different machines**: All use port 8081 (no conflicts)

**Server Ports** (Fixed)
- Chat: 5555
- Files: 5556
- Audio: 5557
- Video: 5000

See `PORT_CONFIGURATION.md` for detailed information.

### 🔧 Troubleshooting

**If Windows Defender blocks it:**
- Click "More info" → "Run anyway"
- Or add to exclusions (normal for unsigned executables)

**If the executable doesn't start:**
- Run as Administrator
- Check if port 8081 is available
- Look for error messages in Windows Event Viewer

**If connection fails:**
- Verify server is running on correct IP/port
- Check firewall settings
- Ensure network connectivity

**If audio doesn't work:**
- Grant microphone permissions
- Check Windows audio settings
- Ensure no other app is using the microphone

### 📦 Distribution

To share with others:
1. **Copy the entire `dist/ShadowNexusClient/` folder**
2. Recipients can run `ShadowNexusClient.exe` inside the folder
3. They'll need the server address to connect

**Important:** The folder structure must be kept intact - don't move the .exe out of its folder!

**Optional:** You can also share `ShadowNexusClient.bat` for easier launching.

### 🔄 Rebuilding After Code Changes

**Quick rebuild:**
```batch
build_exe.bat
```

**Or using PowerShell:**
```powershell
.\build_exe.ps1
```

**Manual rebuild:**
```batch
python -m PyInstaller --clean client.spec
```

### 📝 Technical Details

- **Size:** ~200MB total (folder with all dependencies)
- **Mode:** Onedir (folder-based, no extraction needed)
- **Architecture:** Windows 64-bit
- **Python:** 3.12.6
- **Startup:** ~1 second (instant startup, no temp extraction!)
- **Icon:** Custom ShadowNexus icon included
- **Format:** Portable folder structure

### 🎯 Features Included

- ✅ Real-time chat (global, private, group)
- ✅ File sharing (up to 2GB)
- ✅ Audio messages
- ✅ Video call integration
- ✅ User authentication
- ✅ Message history
- ✅ Online user list

### 🔒 Security Notes

- The executable is unsigned (may trigger SmartScreen)
- SSL certificates are bundled for secure connections
- MAC-based device authentication included
- All data stored locally in shadow_nexus_data folder