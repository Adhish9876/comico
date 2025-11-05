# Group Persistence Fix - Testing Guide

## Quick Start
1. Start the server: `python server.py`
2. Start 2+ clients
3. Test the scenarios below

## Test Scenarios

### Test 1: Basic Group Creation & Persistence
**Expected:** Group remains after server restart

Steps:
1. Client A creates group "Test Group" with Client B as member
2. Both clients see the group in their group list
3. **Stop server**
4. **Start server again**
5. Both clients reconnect
✓ **PASS:** Group "Test Group" is still visible

---

### Test 2: Group Name Change Persistence
**Expected:** Group name change persists after restart

Steps:
1. Client A (admin) creates "Original Name" group
2. Client A changes name to "New Name"
3. Both clients see updated name
4. **Stop server**
5. **Start server**
6. Both clients reconnect
✓ **PASS:** Group shows "New Name" after restart

---

### Test 3: Admin Transfer Persistence
**Expected:** Admin rights transfer persists

Steps:
1. Client A creates group (A is admin)
2. Client A transfers admin to Client B
3. Client A cannot change name anymore
4. Client B can change name
5. **Stop server**
6. **Start server**
7. Reconnect both clients
✓ **PASS:** Client B is still admin, Client A cannot modify

---

### Test 4: Admin-Only Delete
**Expected:** Only admin can delete, deletion is permanent

Steps:
1. Client A (admin) creates "DeleteMe" group with Client B
2. Client B tries to delete group → **Should see error: "Only admin can delete the group"**
3. Client A deletes group
4. Group removed from both clients' lists
5. **Stop server**
6. **Start server**
7. Reconnect both clients
✓ **PASS:** Group is gone, both clients don't see it

---

### Test 5: Admin-Only Name Change
**Expected:** Only admin can change name

Steps:
1. Client A (admin) creates "AdminTest" group with Client B
2. Client B tries to change name → **Should see error: "Only admin can change group name"**
3. Client A can change name successfully
4. **Stop server**
5. **Start server**
✓ **PASS:** Name change persisted, only admin could do it

---

### Test 6: Multiple Groups
**Expected:** All groups persist

Steps:
1. Client A creates "Group 1" and "Group 2"
2. Client B creates "Group 3" (with A as member)
3. All 3 groups visible to everyone
4. **Stop server**
5. **Start server**
✓ **PASS:** All 3 groups still exist

---

### Test 7: Group Storage File
**Expected:** `groups.json` file created and populated

Steps:
1. Create a group
2. Check `shadow_nexus_data/groups.json`
3. Should contain:
   ```json
   {
     "group_12345": {
       "id": "group_12345",
       "name": "Test Group",
       "members": ["user1", "user2"],
       "created_by": "user1",
       "admin": "user1",
       "created_at": "2025-11-06 04:30 PM"
     }
   }
   ```
✓ **PASS:** File exists with correct format

---

## Verification Checklist

- [ ] Groups visible after server restart
- [ ] Group names persist after restart
- [ ] Admin transfers persist
- [ ] Only admin can delete groups
- [ ] Only admin can change group name
- [ ] Only admin can transfer admin rights
- [ ] Non-admin gets error messages for restricted operations
- [ ] `shadow_nexus_data/groups.json` exists and contains group data
- [ ] Multiple groups all persist correctly
- [ ] Group list updates in real-time across clients

## Debug Logs to Watch

**Server logs should show:**
```
✓ Group 'GroupName' created by user1 (2 members)
✓ Group persisted to storage with ID: group_...
✓ Group 'GroupName' name changed to 'NewName' by user1
✓ Group admin changed from user1 to user2
✓ Group 'GroupName' deleted by user1
✓ Broadcasting updated user list after X disconnect
Loaded 3 groups  # On server startup
```

**Client console should show:**
```
📋 UPDATE GROUPS LIST CALLED
📊 Persistent groups: 2
📊 Server groups received: 2
✅ Rendering: GroupName1 (group_xxxxx...)
✅ Rendering: GroupName2 (group_yyyyy...)
📝 Changing group name to: NewName
📘 Group context stored...
🎯 GROUP SETTINGS BUTTON CLICKED!
```

## Common Issues & Solutions

### Issue: Group not found after server restart
- **Check:** Is `shadow_nexus_data/groups.json` being created?
- **Check:** Server logs should show "Loaded X groups"
- **Fix:** Ensure storage.py changes are applied

### Issue: Admin-only operations not working
- **Check:** Verify `currentGroupContext.admin === username` before operations
- **Check:** Server should validate admin in handlers
- **Fix:** Ensure server-side validation is in place

### Issue: Changes not persisting
- **Check:** Is storage.update_group() being called?
- **Check:** Does `groups.json` file get modified?
- **Fix:** Verify all handlers call storage functions

### Issue: Group deleted but still shows up
- **Check:** Client still has it in `persistentGroups`
- **Check:** Server broadcast_group_list() should be called
- **Fix:** Clear browser localStorage if needed: `localStorage.removeItem('persistentGroups')`

## Notes
- Groups are now **permanently stored** on server
- Groups survive **server restarts**
- Only **admin can delete** groups
- All changes **immediately saved** to disk
- Supports **multiple simultaneous groups**

## Success Criteria
✅ All tests pass
✅ Groups.json created on first group
✅ No "group not found" errors
✅ Admin-only operations properly restricted
✅ Groups survive server restarts
