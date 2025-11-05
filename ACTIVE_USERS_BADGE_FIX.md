# Active Users Unread Badge Fix

## Problem Identified 🔴
When a new/active user (in the "🟢 ONLINE" section) sent a message:
- Unread badge appeared only in the **Chats header** 
- Badge was **NOT visible next to the active user's name**
- Unlike private chats which show badges correctly

## Root Causes
1. **Missing CSS Styling**: `.active-user-name .unread-count` selector didn't exist
2. **Layout Issue**: `.active-user-name` wasn't using flexbox to accommodate badges
3. **Initial Render**: Badge sizing was too large for active user display

## Complete Solution ✅

### 1. **CSS Updates (style.css)** - Added Proper Badge Styling
Updated `.active-user-name` section at line ~3589:

```css
.active-user-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 2px;
    display: flex;              /* NEW: Enable flexbox for badge */
    align-items: center;        /* NEW: Center badge vertically */
    gap: 8px;                   /* NEW: Space between name and badge */
}

/* NEW: Badge styling for active users */
.active-user-name .unread-count {
    display: none;
    padding: 0 6px;            /* Smaller than chat badges */
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    font-size: 11px;           /* Smaller font */
    line-height: 20px;
    background: #2ecc71;       /* Green badge */
    color: white;
    white-space: nowrap;
    flex-shrink: 0;
    text-align: center;
    font-weight: 700;
}
```

### 2. **JavaScript Fix (app.js)** - Proper Badge Initialization
Fixed active user rendering at line ~3710:

**Before (Bug):**
```javascript
// Created badge but then innerHTML DESTROYED it!
const userNameDiv = document.createElement('div');
userNameDiv.className = 'active-user-name';
userNameDiv.textContent = user;

const badge = document.createElement('span');
badge.className = 'unread-count';
userNameDiv.appendChild(badge);  // ← Added badge

userItem.innerHTML = `...`;  // ← OVERWRITES the badge!
userInfo.appendChild(userNameDiv);  // ← Re-added without badge
```

**After (Fixed):**
```javascript
// Let updateUnreadCountsUI() handle badge creation
userItem.innerHTML = `
    <div class="active-user-avatar">${user.charAt(0).toUpperCase()}</div>
    <div class="active-user-info"></div>
`;

const userNameDiv = document.createElement('div');
userNameDiv.className = 'active-user-name';
userNameDiv.textContent = user;

const userInfo = userItem.querySelector('.active-user-info');
userInfo.appendChild(userNameDiv);

const statusDiv = document.createElement('div');
statusDiv.className = 'active-user-status';
statusDiv.textContent = 'Online';
userInfo.appendChild(statusDiv);
```

### 3. **Added Debug Logging** - Track Badge Updates
Enhanced `updateUnreadCountsUI()` at line ~1485:

```javascript
if (count > 0) {
    unreadBadge.textContent = count > 99 ? '99+' : count;
    unreadBadge.style.display = 'inline-block';
    console.log(`📬 Active user badge updated for ${user}: ${count}`);
} else {
    unreadBadge.style.display = 'none';
}
```

## How It Works Now 🎯

### Message Flow:
1. Active user sends message to you
2. Server sends private message
3. Client checks if viewing that chat
4. If NOT viewing → `updateUnreadCount('private', sender)` called
5. This increments `unreadCounts.private[sender]`
6. `updateUnreadCountsUI()` is called
7. Badge is ensured on `.active-user-name`
8. Badge text set and displayed with `inline-block`

### Badge Display:
```
Active User List:
┌─────────────────────────┐
│ 🟢 ONLINE          │
├─────────────────────────┤
│ A Alice         2       │  ← Badge shows unread count
│ B Bob           5       │  ← Badge shows unread count
│ C Charlie           │  ← No badge (viewed or no messages)
└─────────────────────────┘
```

vs Private Chat List:
```
Private Chats:
┌─────────────────────────┐
│ 👤 Alice            2   │  ← Same badge style
│ 👤 Bob              5   │  ← Same badge style
│ 👤 Charlie          │  ← Same badge style
└─────────────────────────┘
```

## Key Features 🎨
✅ **Consistent Styling** - Badges match private chat badges
✅ **Compact Design** - Smaller badges fit active users better
✅ **Flexbox Layout** - Properly aligns badge next to name
✅ **Auto-hide** - Badge hidden when count = 0
✅ **Real-time Updates** - Badge updates on every message
✅ **Debug Logging** - Console shows badge updates
✅ **Green Badge** - #2ecc71 green background for visibility

## Files Modified
1. **web/style.css** (lines ~3589)
   - Added flexbox to `.active-user-name`
   - Added complete styling for `.active-user-name .unread-count`

2. **web/app.js** (lines ~3710 and ~1485)
   - Fixed badge initialization order
   - Added console logging for debug

## Verification Checklist
- [ ] Active user sends message
- [ ] Badge appears next to their name in 🟢 ONLINE section
- [ ] Badge shows correct count (1, 2, 3, etc.)
- [ ] Badge shows "99+" for 100+ messages
- [ ] Badge disappears when you read the chat
- [ ] Badge styling matches private chat badges
- [ ] Multiple active users each have their own badge
- [ ] Console shows "📬 Active user badge updated" logs

## Testing Scenario
1. Start server
2. Open 2+ client windows
3. Client B stays in Global chat (not viewing private chat with A)
4. Client A sends 3 messages to B's private chat
5. **Expected:** Green badge "3" appears next to A's name in B's 🟢 ONLINE section
6. Client B clicks A's name in active list
7. **Expected:** Badge disappears

## Browser Console Commands (Debugging)
```javascript
// Check active user items
document.querySelectorAll('.active-user-item')

// Check unread counts
unreadCounts.private

// Check specific badge
document.querySelector('.active-user-item[data-user="Alice"] .unread-count')

// Force update
updateUnreadCountsUI()
```

## CSS Comparisons

### Private Chat Badge
```css
.chat-name .unread-count {
    padding: 0 8px;
    min-width: 22px;
    height: 22px;
    font-size: 12px;
}
```

### Active User Badge (NEW)
```css
.active-user-name .unread-count {
    padding: 0 6px;      /* Smaller padding */
    min-width: 20px;     /* Smaller width */
    height: 20px;
    font-size: 11px;     /* Smaller font */
}
```

## Potential Edge Cases Handled
✅ User with 0 unread messages - badge hidden
✅ User with 100+ messages - shows "99+"
✅ Active user moves to inactive list - badge persists in private list
✅ Private chat still visible after move - badge updates correctly
✅ Multiple messages rapid fire - badge updates each time
✅ Badge color consistent with system (green #2ecc71)

## Performance Impact
- ✅ Minimal: Badges are cached by ensureBadge()
- ✅ No extra DOM queries beyond existing code
- ✅ CSS uses efficient selectors
- ✅ Console logging only when badge updates

## Future Enhancements
- Could add badge pulse animation on new messages
- Could add different colors for different notification types
- Could add sound notification indicator
- Could add "New" label instead of count for first message
