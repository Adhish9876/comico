# SSL Certificate Setup for Chrome WebRTC

## 🔒 **Why HTTPS is Required**
Chrome requires HTTPS for WebRTC features (camera/microphone access) for security reasons. Even on local networks, you need SSL certificates.

## ⚠️ **Expected Browser Warning**
When you first access the video call, Chrome will show:
```
⚠️ Your connection is not private
NET::ERR_CERT_AUTHORITY_INVALID
```

## 🔧 **How to Proceed (Required Steps)**

### **Step 1: Accept the Certificate**
1. Click **"Advanced"** 
2. Click **"Proceed to 10.200.14.94 (unsafe)"**
3. This is safe on your local network

### **Step 2: Allow Camera/Microphone**
1. Chrome will ask for camera/microphone permissions
2. Click **"Allow"** for both
3. This enables WebRTC functionality

### **Step 3: Bookmark for Easy Access**
After accepting once, bookmark the video call URLs:
- Video calls: `https://10.200.14.94:5000/video/[session_id]`
- Audio calls: `https://10.200.14.94:5000/audio/[session_id]`

## 🚀 **Testing Steps**

### **1. Start the Media Server**
```bash
python video_module.py
```
You should see:
```
🎥🎙️ Shadow Nexus Media Server (WebRTC)
[MEDIA SERVER] Server running on https://0.0.0.0:5000
⚠️  Chrome will show 'Not Secure' - click 'Advanced' -> 'Proceed to 10.200.14.94 (unsafe)'
```

### **2. Test Direct Access**
Open Chrome and go to: `https://10.200.14.94:5000`
- Accept the certificate warning
- You should see: "Shadow Nexus Media Server Running - Video & Audio Calls"

### **3. Start a Video Call**
1. Start chat client: `python client.py`
2. Start a video call from the chat
3. Click the join button when it appears
4. Accept certificate warning if prompted again
5. Allow camera/microphone access

## 🔍 **Troubleshooting**

### **If video call doesn't work:**
1. **Check browser console (F12)** for errors
2. **Verify HTTPS URLs** are being used (not HTTP)
3. **Ensure certificate is accepted** for the domain
4. **Check camera/microphone permissions** in Chrome settings

### **If SSL errors persist:**
1. Delete old certificates: `del cert.pem key.pem`
2. Restart media server to generate new certificates
3. Clear browser cache and cookies
4. Try incognito/private browsing mode

### **Alternative: Use Chrome Flags (Advanced)**
For development only, you can disable SSL checks:
1. Close all Chrome windows
2. Start Chrome with: `chrome.exe --ignore-certificate-errors --ignore-ssl-errors --allow-running-insecure-content`
3. ⚠️ **Only use this for testing - not secure!**

## ✅ **Success Indicators**
- Media server starts without SSL errors
- Browser accepts certificate after clicking "Proceed"
- Camera/microphone permissions granted
- Video calls connect and show both participants
- No SSL-related errors in browser console

## 📝 **Important Notes**
- Self-signed certificates are normal for local development
- Each device needs to accept the certificate once
- The warning is expected and safe to ignore on local network
- WebRTC requires HTTPS - there's no way around this in modern browsers