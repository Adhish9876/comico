# 🎥 Video Call SSL Certificate Fix

## Problem
When you start a video call, you might see a **blank video** or the other person's video doesn't appear. This is caused by the browser blocking the SSL certificate.

## Solution: Accept the Certificate (One-Time Setup)

### **Step 1: When Video Call Link Opens**
When you click on a video invite and the browser opens, you'll see a security warning like:
- "Your connection is not private"
- "NET::ERR_CERT_AUTHORITY_INVALID"
- "This site can't provide a secure connection"

### **Step 2: Accept the Certificate**

#### **Chrome/Edge:**
1. Click **"Advanced"**
2. Click **"Proceed to [IP address] (unsafe)"** or **"Continue anyway"**
3. The video call page will load

#### **Firefox:**
1. Click **"Advanced"**
2. Click **"Accept the Risk and Continue"**
3. The video call page will load

#### **Safari:**
1. Click **"Show Details"**
2. Click **"visit this website"**
3. Confirm by clicking **"Visit Website"**

### **Step 3: Reload the Call**
- After accepting the certificate, close and reopen the video call
- Or click "Refresh" in the browser
- **The video should now work!**

## ✅ Why This Happens
- The server uses a **self-signed SSL certificate**
- Browsers don't trust self-signed certificates by default
- This is normal for local network apps
- **Your connection is still encrypted and secure on your local network**

## 🔒 One-Time Setup
- You only need to do this **once** per browser
- The browser will remember your choice
- All future video calls will work automatically

## 🎯 Quick Checklist
- [ ] Video call opens in browser
- [ ] See security warning → Click "Advanced"
- [ ] Click "Proceed" or "Continue anyway"
- [ ] Reload the video call page
- [ ] Video should now be visible! ✅

## 🚨 Still Not Working?

If video is still blank after accepting the certificate:

1. **Check camera permissions** - Make sure browser has camera/mic access
2. **Refresh the page** - Press F5 or Ctrl+R
3. **Check console** - Press F12 and look for errors in the Console tab
4. **Try different browser** - Chrome usually works best
5. **Restart the video call** - Exit and start a new call

## 💡 Pro Tip
**For best experience:**
- Use Chrome or Edge browser
- Accept the SSL certificate before starting a call
- Make sure camera/microphone are allowed in browser settings
