# Last Seen Based "New Messages" Divider - Complete Fix

## ✅ Issues Fixed

### Issue 1: Chat Always Starting at Top on App Launch
**Problem:** When you opened the app, global chat always started at the top, requiring manual scrolling every time.

**Solution:** Now automatically scrolls to bottom for first-time users, or to the last position with divider for returning users.

### Issue 2: Divider Not Based on User's Last Seen Message
**Problem:** Divider was based on unread count, which didn't persist across sessions or accurately reflect what the user had actually seen.

**Solution:** Now tracks each user's last seen message index per chat and persists it in localStorage.

## How It Works Now

### Last Seen Message Tracking

```javascript
// Persistent storage of last seen message indices
const lastSeenMessageIndex = {
    global: -1,      // -1 = never seen before (new user)
    private: {},     // username -> last seen index
    group: {}        // groupId -> last seen index
};

// Loaded from localStorage on startup
// Saved to localStorage when viewing messages
```

### Divider Logic

**New User (First Time):**
```
lastSeenMessageIndex.global = -1
└─ No divider shown
└─ Scrolls to bottom
└─ After clearing: lastSeenMessageIndex.global = lastMessageIndex
```

**Returning User (Has Seen Some Messages):**
```
lastSeenMessageIndex.global = 5 (last seen was message #5)
Current messages: 10 total

Divider Position:
├─ Message 0
├─ Message 1
├─ Message 2
├─ Message 3
├─ Message 4
├─ Message 5 (last seen)
├─ ────── NEW MESSAGES ──────  ← Divider here
├─ Message 6 (new)
├─ Message 7 (new)
├─ Message 8 (new)
└─ Message 9 (new)

Scrolls to divider (centered)
```

### When Last Seen is Updated

```javascript
function clearUnreadForCurrentChat() {
    if (currentChatType === 'global') {
        // Update to last message in chat
        lastSeenMessageIndex.global = chatHistories.global.length - 1;
    }
    // ... same for private and group
    
    // Persist to localStorage
    localStorage.setItem('lastSeenMessageIndex', JSON.stringify(lastSeenMessageIndex));
}
```

This happens when:
- ✅ You switch to a chat (automatically marks as "seen")
- ✅ After rendering the messages
- ✅ Persists across app restarts

## Scroll Behavior

### On App Launch (Global Chat)
```javascript
// Initial render
renderCurrentChat(false); // preserveScroll = false

// Scroll behavior:
if (divider shown) {
    → Scroll to divider (centered)
} else {
    → Scroll to bottom (new user or no new messages)
}
```

### When Switching Chats
```javascript
// Render without preserving scroll
renderCurrentChat(false);

// Scroll behavior:
if (lastSeenIdx >= 0 && lastSeenIdx < totalMessages - 1) {
    → Show divider
    → Scroll to divider (centered)
} else if (lastSeenIdx === -1) {
    → No divider (first time in this chat)
    → Scroll to bottom
} else {
    → No new messages
    → Scroll to bottom
}
```

### During Normal Chat Usage
```javascript
// Preserve scroll position
renderCurrentChat(true);

// Scroll behavior:
if (was at bottom) {
    → Stay at bottom
} else if (was scrolled up) {
    → Maintain relative position
}
```

## Examples

### Example 1: Brand New User
```
User opens app for first time
└─ lastSeenMessageIndex.global = -1
└─ Loads 100 global messages
└─ No divider shown
└─ Scrolls to bottom (message #99)
└─ User reads messages
└─ On next app launch: lastSeenMessageIndex.global = 99
```

### Example 2: Returning User
```
User opens app (previously seen up to message #50)
└─ lastSeenMessageIndex.global = 50
└─ Loads 70 global messages now
└─ Divider appears after message #50
└─ Scrolls to divider (shows messages #51-70 as "NEW")
└─ User reads them
└─ On next app launch: lastSeenMessageIndex.global = 69
```

### Example 3: Private Chat - First Conversation
```
User clicks on "Alice" (never chatted before)
└─ lastSeenMessageIndex.private["Alice"] = undefined
└─ Loads 5 messages
└─ No divider (first time)
└─ Scrolls to bottom
└─ Marks as seen: lastSeenMessageIndex.private["Alice"] = 4
```

### Example 4: Private Chat - With New Messages
```
User previously talked to "Bob" (saw up to message #3)
Alice sends new messages while user is in another chat
└─ lastSeenMessageIndex.private["Alice"] = 3
User clicks on "Alice"
└─ Loads 7 messages
└─ Divider appears after message #3
└─ Messages #4, #5, #6 shown as "NEW"
└─ Scrolls to divider
```

## Persistence

### LocalStorage Structure
```json
{
  "global": 99,
  "private": {
    "Alice": 10,
    "Bob": 5,
    "Charlie": 0
  },
  "group": {
    "group_abc123": 25,
    "group_xyz789": 15
  }
}
```

### When Data is Saved
- ✅ Every time you view a chat and clear unread
- ✅ Persists across app restarts
- ✅ Survives browser refresh

### When Data is Loaded
- ✅ On app startup (before connection)
- ✅ Used for all rendering decisions

## Benefits

### For New Users
- ✅ No confusing divider on first visit
- ✅ Clean slate, scrolled to bottom
- ✅ All messages treated as "current"

### For Returning Users
- ✅ Pick up exactly where you left off
- ✅ Clear visual indication of new messages
- ✅ Automatic scroll to relevant content
- ✅ Works across app restarts

### For All Users
- ✅ No more manual scrolling on app launch
- ✅ Consistent behavior across global/private/group
- ✅ No unnecessary re-renders
- ✅ Smooth, intuitive UX

## Files Modified
- `web/app.js`

## Key Changes

1. **Added `lastSeenMessageIndex` tracking** with localStorage persistence
2. **Updated `renderCurrentChat()`** to use last seen index instead of unread count
3. **Enhanced `clearUnreadForCurrentChat()`** to update and persist last seen indices
4. **Improved scroll behavior** for initial renders vs. ongoing usage
5. **Removed obsolete `savedUnreadCount` parameter** (replaced with last seen tracking)

## Status
✅ **FULLY IMPLEMENTED** - Works for Global, Private, and Group chats with persistent last seen tracking
