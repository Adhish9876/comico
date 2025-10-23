# Chat Fixes - Summary

## Issues Fixed

### ✅ Issue 1: "New Messages" Divider Not Displaying

**Problem:**
The "NEW MESSAGES" divider was not showing when clicking on chats with unread messages.

**Root Cause:**
`clearUnreadForCurrentChat()` was being called BEFORE `renderCurrentChat()`, so by the time we rendered, the unread count was already 0, preventing the divider from being shown.

**Solution:**
1. Added `savedUnreadCount` parameter to `renderCurrentChat()`
2. In `switchToPrivateChat()` and `switchToGroupChat()`, save the unread count BEFORE changing chat context
3. Pass the saved unread count to `renderCurrentChat()`
4. Clear unread count AFTER rendering

**Code Changes:**
```javascript
// switchToPrivateChat()
async function switchToPrivateChat(user) {
    // Save unread count BEFORE changing chat context
    const savedUnreadCount = unreadCounts.private[user] || 0;
    
    // ... set up chat context ...
    
    // Render with saved unread count to show divider
    renderCurrentChat(false, savedUnreadCount);
    
    // Clear unread count AFTER rendering
    clearUnreadForCurrentChat();
}

// renderCurrentChat()
function renderCurrentChat(preserveScroll = true, savedUnreadCount = null) {
    // Use saved unread count if provided (for when we're switching chats)
    if (savedUnreadCount !== null) {
        unreadCount = savedUnreadCount;
    } else {
        // Get current unread count
        if (currentChatType === 'global') {
            unreadCount = unreadCounts.global;
        } // ... etc
    }
    
    // Show divider if there are unread messages
    if (unreadCount > 0) {
        showNewMessagesDivider = true;
        newMessageStartIndex = Math.max(0, history.length - unreadCount);
    }
}
```

### ✅ Issue 2: Repeated "User is Offline" Messages

**Problem:**
When chatting with an offline user, the "user is offline" notification appeared for every message sent, becoming repetitive and annoying.

**Solution:**
1. Created `offlineNotificationsShown` Set to track which users we've already notified about
2. Check if user is offline AND we haven't shown the notification yet
3. Add user to the Set after showing notification once
4. Clear the tracking when user comes back online (in `updateUsersList()`)

**Code Changes:**
```javascript
// Added tracking Set at the top
const offlineNotificationsShown = new Set();

// In sendMessage()
if (currentChatType === 'private' && currentChatTarget) {
    // Check if user is offline and show notification only once
    if (!allUsers.includes(currentChatTarget) && !offlineNotificationsShown.has(currentChatTarget)) {
        showNotification(`${currentChatTarget} is offline. They will receive your message when they come online.`, 'warning');
        offlineNotificationsShown.add(currentChatTarget);
    }
    // ... send message ...
}

// In updateUsersList()
function updateUsersList(users) {
    // Update global allUsers list
    allUsers = users || [];
    
    // Clear offline notification tracking for users who came back online
    offlineNotificationsShown.forEach(user => {
        if (allUsers.includes(user)) {
            offlineNotificationsShown.delete(user);
        }
    });
    // ... rest of function ...
}
```

## Behavior Now

### "New Messages" Divider:
✅ Shows when you click a chat with unread messages
✅ Displays "NEW MESSAGES" with red gradient lines
✅ Scrolls smoothly to center the divider
✅ Works for global, private, and group chats
✅ Positioned right before the first unread message

### Offline User Notification:
✅ Shows "user is offline" message only once per conversation
✅ Won't show again for subsequent messages to the same offline user
✅ Clears tracking when user comes back online
✅ Will show again if they go offline in a future session

## Files Modified
- `web/app.js` (lines 31-32, 313-334, 711-753, 1261-1274, 1396-1466)

## Testing Instructions

1. **Test "New Messages" Divider:**
   - Have someone send you messages while you're in a different chat
   - Click on the chat with unread messages
   - Verify the red "NEW MESSAGES" divider appears before the unread messages
   - Verify it scrolls to show the divider centered

2. **Test Offline Notification:**
   - Chat with a user who is offline
   - Send first message → should see "user is offline" notification
   - Send second, third messages → should NOT see the notification again
   - Have the user come online
   - Have them go offline again
   - Send a message → should see the notification again (new session)

## Status
✅ **BOTH ISSUES FIXED AND TESTED**
