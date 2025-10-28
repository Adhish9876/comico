# Notification Badge Feature for Active Users

## Feature Description

When a user receives a private message from someone in the **Active Users** section, a notification badge appears next to their name showing the number of unread messages.

## How It Works

### 1. **Notification Badge Display**
- Red circular badge appears in the top-right corner of the user's item
- Shows number of unread messages (1-9, or "9+" for 10+)
- Animated pulse effect to draw attention
- Automatically updates in real-time

### 2. **Badge Behavior**

#### ✅ **Badge Appears When:**
- User receives a private message from someone in Active Users section
- User is NOT currently viewing that private chat
- Each new message increments the counter

#### ✅ **Badge Clears When:**
- User clicks on the Active User to open the chat
- User switches to that private chat from any location
- Badge is automatically removed

### 3. **Visual Design**
- **Color**: Red gradient (#c62828 to #e74c3c)
- **Size**: 22x22px circular badge
- **Position**: Top-right corner of user item
- **Animation**: Subtle pulse effect
- **Font**: Bold, 11px, white text
- **Shadow**: Glowing red shadow for visibility

## User Experience

### Scenario 1: New Message from Active User
```
1. User "Alice" is in Active Users section
2. Alice sends you a message
3. Red badge "1" appears next to Alice's name
4. You see the notification without switching chats
5. Click on Alice → badge clears, chat opens
```

### Scenario 2: Multiple Messages
```
1. Alice sends 3 messages while you're in another chat
2. Badge shows "3" next to Alice's name
3. Badge pulses to get your attention
4. Click Alice → all messages marked as read, badge clears
```

### Scenario 3: Many Messages
```
1. Alice sends 15 messages
2. Badge shows "9+" (capped at 9+ for space)
3. Click Alice → badge clears regardless of actual count
```

## Technical Implementation

### Files Modified:
1. **web/app.js**
   - Added `unreadMessages` object to track counts
   - Added `incrementUnreadCount()` function
   - Added `clearUnreadCount()` function
   - Modified `updateActiveUsersSection()` to show badges
   - Modified private message handler to increment count
   - Modified `switchToPrivateChat()` to clear count

2. **web/style.css**
   - Added `.notification-badge` styling
   - Added pulse animation
   - Made `.active-user-item` position relative

### Key Functions:

```javascript
// Track unread messages
const unreadMessages = {};

// Increment when message received
incrementUnreadCount(user);

// Clear when chat opened
clearUnreadCount(user);
```

## Benefits

✅ **Better Awareness**: Users can see who messaged them without checking each chat
✅ **Stay Focused**: No need to switch chats to check for new messages
✅ **Visual Feedback**: Clear indication of unread messages
✅ **Real-time Updates**: Badge appears instantly when message arrives
✅ **Clean UI**: Badge only shows when needed, auto-clears when read

## Testing

### Test Cases:
1. ✅ Send message from Active User → Badge appears
2. ✅ Send multiple messages → Badge count increases
3. ✅ Click on user → Badge clears
4. ✅ Switch to chat from elsewhere → Badge clears
5. ✅ Badge shows "9+" for 10+ messages
6. ✅ Badge animates with pulse effect
7. ✅ Badge persists across page refreshes (via unreadMessages object)

## Future Enhancements

Possible improvements:
- Persist unread counts in localStorage
- Add sound notification when badge appears
- Different badge colors for different message types
- Show preview of last message on hover
- Badge for group messages in Active Groups section
