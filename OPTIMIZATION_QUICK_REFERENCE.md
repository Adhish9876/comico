# Quick Reference: Video Call Performance Optimizations

## 🚀 Key Functions Added

### 1. `getVideoBitrateConstraints(participantCount)`
Returns optimal video settings based on participant count.

```javascript
// Usage
const bitrate = getVideoBitrateConstraints(4);
// Returns: { maxBitrate: 500000, maxFramerate: 15, maxWidth: 640, maxHeight: 480 }
```

### 2. `optimizeBitrateForAllPeers()`
Called when users join/leave to update bitrate for all connections.

```javascript
// Automatically called on:
// - User joins (user-connect event)
// - User leaves (user-disconnect event)
```

### 3. `monitorConnectionStats(peer_id)`
Monitors connection quality and logs warnings.

```javascript
// Runs every 5 seconds per peer
// Logs frame rate, packet loss, and connection issues
```

---

## 📊 Bitrate Profiles

### Profile 1: Solo (1 person)
```
Resolution: 1280x720
Bitrate: 1.5 Mbps
FPS: 30
```

### Profile 2: Small Group (2-3 people)
```
Resolution: 854x480
Bitrate: 800 Kbps
FPS: 24
```

### Profile 3: Large Group (4+ people)
```
Resolution: 640x480
Bitrate: 500 Kbps
FPS: 15
```

### Profile 4: Screen Share (all group sizes)
```
Resolution: 1920x1080
Bitrate: 2.5 Mbps
FPS: 24-30
Audio: Disabled
```

---

## 🔌 Event Handlers

### user-connect Event
```javascript
// Triggers optimizeBitrateForAllPeers()
// Updates all peers when new user joins
socket.on('user-connect', (data) => {
    // ... existing code ...
    optimizeBitrateForAllPeers();  // ← NEW
});
```

### user-disconnect Event
```javascript
// Triggers optimizeBitrateForAllPeers()
// Updates remaining peers when user leaves
socket.on('user-disconnect', (data) => {
    // ... existing code ...
    optimizeBitrateForAllPeers();  // ← NEW
});
```

---

## 🛠️ Customization Guide

### Adjust Bitrate Limits

Edit `getVideoBitrateConstraints()` in `video_room.html`:

```javascript
function getVideoBitrateConstraints(participantCount = 1) {
    if (participantCount >= 4) {
        return {
            maxBitrate: 750000,     // ← CHANGE THIS (was 500000)
            maxFramerate: 20,       // ← CHANGE THIS (was 15)
            maxWidth: 854,          // ← CHANGE THIS (was 640)
            maxHeight: 480
        };
    }
    // ... rest of function ...
}
```

### Adjust Screen Share Settings

Edit `toggleScreenShare()` in `video_room.html`:

```javascript
async function toggleScreenShare() {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
            cursor: "always",
            width: { ideal: 1280, max: 1280 },      // ← CHANGE THIS
            height: { ideal: 720, max: 720 },       // ← CHANGE THIS
            frameRate: { ideal: 20, max: 20 }       // ← CHANGE THIS
        },
        audio: false
    });
    
    // Later in function:
    params.encodings[0].maxBitrate = 3000000;      // ← CHANGE THIS (2.5M default)
}
```

### Adjust Monitoring Interval

Edit `monitorConnectionStats()` in `video_room.html`:

```javascript
const interval = setInterval(async () => {
    // ... stats gathering code ...
}, 5000);  // ← CHANGE THIS (5000ms = 5 seconds)
```

---

## 📋 Console Logging Examples

### Normal Operation
```
[BITRATE] Re-optimizing for 3 participants: 800000 bps
[BITRATE] Updated bitrate for peer abc123
[BITRATE] Updated bitrate for peer def456
```

### Screen Share
```
[SCREEN] Starting screen share with optimized settings...
[SCREEN] Replaced track for peer abc123 with higher bitrate
[SCREEN] Replaced track for peer def456 with higher bitrate
```

### Connection Issues
```
[STATS] Peer abc123: Low FPS (8) and packet loss (120)
[BITRATE] Could not update bitrate for peer def456: timeout
```

---

## 🔄 Data Flow

```
┌─ User Joins ─┐
│              ↓
│    optimizeBitrateForAllPeers()
│              ↓
│    For each peer:
│    - Get participant count
│    - Get bitrate constraints
│    - Get RTCRtpSender
│    - Update parameters
│    - Apply to connection
│              ↓
└─ All peers receive new quality settings ─┘
```

---

## ✅ Verification Steps

### 1. Check Adaptive Resolution
```javascript
// In browser console during call with 4+ people:
const pc = Object.values(_peer_list)[0];
const sender = pc.getSenders().find(s => s.track.kind === 'video');
const params = sender.getParameters();
console.log(params.encodings[0].maxBitrate);  // Should show ~500000
```

### 2. Check Screen Share Bitrate
```javascript
// During screen share:
const params = sender.getParameters();
console.log(params.encodings[0].maxBitrate);  // Should show ~2500000
```

### 3. Monitor Stats
```javascript
// Browser console shows these logs:
// [BITRATE] Re-optimizing for 4 participants: 500000 bps
// [STATS] Peer abc123: Low FPS (12) and packet loss (5)
```

---

## 🐛 Troubleshooting

### Issue: All connections using high bitrate even with 4+ people
**Solution**: Check that `optimizeBitrateForAllPeers()` is being called
```javascript
// Add to console to verify:
console.log('Current peer count:', Object.keys(_peer_list).length + 1);
```

### Issue: Screen share still looks pixelated
**Solution**: Check maxBitrate in `toggleScreenShare()`
```javascript
// Should be 2500000 or higher:
params.encodings[0].maxBitrate = 2500000;
```

### Issue: Still experiencing lag
**Solution**: Lower bitrate limits even more:
```javascript
// For 4+ people, try:
maxBitrate: 350000,  // Further reduced
maxFramerate: 12,    // Even lower FPS
```

---

## 📈 Performance Metrics to Monitor

In browser DevTools → Performance:

1. **Frame Rate**: Should match `maxFramerate` setting
2. **Network**: Should match `maxBitrate` setting  
3. **CPU**: Should decrease with lower bitrate
4. **Memory**: Should stay constant (~50-100MB for 4 video streams)

---

## 🌐 Browser Support

| Browser | Adaptive Bitrate | Screen Share | Stats Monitoring |
|---------|------------------|--------------|------------------|
| Chrome | ✅ Full | ✅ Full | ✅ Full |
| Firefox | ✅ Full | ✅ Full | ✅ Full |
| Edge | ✅ Full | ✅ Full | ✅ Full |
| Safari | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial |

---

## 📞 Support

For issues or questions:
1. Check console logs (Ctrl+Shift+J)
2. Review `PERFORMANCE_OPTIMIZATION.md` for technical details
3. Check browser compatibility above

---

Last Updated: 2025-11-04
