# WebRTC Connection Debugging Guide

## Problem: Only seeing your own video, not the other person's

This is typically caused by one of these issues:

### 1. **Check Browser Console Logs**

When you start a call, open the browser console (F12) and look for these messages:

#### ✅ **What you SHOULD see:**
```
[LOCAL-WEBRTC] 📤 Adding local tracks to peer <peer_id>
[LOCAL-WEBRTC] Local stream has 2 tracks: video (enabled: true), audio (enabled: true)
[LOCAL-WEBRTC] ✅ Track added successfully
[LOCAL-WEBRTC] 📥 Track received from <peer_id>!
[LOCAL-WEBRTC] Track kind: video, enabled: true
[LOCAL-WEBRTC] ✅ Using provided stream with 2 tracks
[LOCAL-WEBRTC] 🎥 Adding remote video for <peer_id>
[LAYOUT] ✅ Video metadata loaded for <peer_id>
[LAYOUT] ✅ Video playing for <peer_id>
```

#### ❌ **Problem indicators:**
```
[WEBRTC] ❌ Cannot add tracks - no local stream!
[WEBRTC] ❌ No tracks in local stream!
[WEBRTC] ❌ Error adding video track: <error>
[LOCAL-WEBRTC] ❌ No tracks in stream for <peer_id>
```

### 