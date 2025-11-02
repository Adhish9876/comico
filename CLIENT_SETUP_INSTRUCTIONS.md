# 📦 ShadowNexus Client - Setup Instructions

## ⚠️ IMPORTANT: Server IP Configuration

Before running the client, you **MUST** configure the server IP address!

### 🔧 Setup Steps:

1. **Locate the `.env` file** in the client folder
   - It's in the same folder as `ShadowNexusClient.exe`

2. **Edit the `.env` file** with any text editor (Notepad, VS Code, etc.)
   ```
   SERVER_IP=10.200.14.204
   ```
   Replace `10.200.14.204` with **your server's actual IP address**

3. **Save the file** and close the editor

4. **Run `ShadowNexusClient.exe`**

### 🔍 How to Find the Server IP:

**On the server machine:**

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter
- WiFi: Look under "Wireless LAN adapter Wi-Fi"
- Ethernet: Look under "Ethernet adapter"

Example output:
```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 10.200.14.204
```

**Linux/Mac:**
```bash
ifconfig
# or
ip addr show
```

### 📋 Common Server IP Patterns:

- **Home WiFi**: Usually `192.168.x.x`
- **Office/School**: Often `10.x.x.x` or `172.16.x.x`
- **Mobile Hotspot**: Varies by device

### ✅ Quick Test:

After setting the SERVER_IP:
1. Run `ShadowNexusClient.exe`
2. Enter your username
3. Click "Connect"
4. If it connects ✅ - You're good to go!
5. If it fails ❌ - Double-check the SERVER_IP

### 🔒 SSL Certificate Setup:

If you see SSL certificate warnings, run:
```
ShadowNexus_Install_Certificate.exe
```
This installs the trusted certificate authority. Run it ONCE, then restart your browser.

### 🆘 Troubleshooting:

**"Failed to start call: Max retries exceeded"**
- ❌ **Wrong SERVER_IP** - Check `.env` file
- ✅ Make sure server is running
- ✅ Both machines on same network

**"SSL certificate unknown"**
- ❌ **Certificate not installed**
- ✅ Run `ShadowNexus_Install_Certificate.exe`
- ✅ Restart browser after installation

**Can't connect at all:**
- ❌ **Firewall blocking** - Allow port 5555 and 5000
- ❌ **Different networks** - Must be on same LAN
- ✅ Ping the server: `ping <SERVER_IP>`

### 📞 Support:

If you're still having issues:
1. Check the server console for error messages
2. Verify both machines are on the same network
3. Check firewall settings on both machines
4. Make sure the server is running before starting the client

---

**Remember:** All clients must use the **same SERVER_IP** to connect to the same server!
