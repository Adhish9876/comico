// Shadow Nexus - Complete Fixed Client with Persistent Chat History

let currentChatType = 'global';
let currentChatTarget = null;
let username = '';
let recentChats = [];
let allUsers = [];

// Store all chat histories locally
const chatHistories = {
    global: [],
    private: {},  // username -> messages[]
    group: {}     // groupId -> messages[]
};

// Store groups persistently
const persistentGroups = JSON.parse(localStorage.getItem('persistentGroups') || '{}');

// Store unread counts
const unreadCounts = {
    global: 0,
    private: {},  // username -> count
    group: {},    // groupId -> count
    total: 0
};

// Track last seen message index for each chat (to determine where divider goes)
const lastSeenMessageIndex = {
    global: -1,  // -1 means never seen before
    private: {},  // username -> index
    group: {}     // groupId -> index
};

// Load last seen indices from localStorage on startup
try {
    const saved = localStorage.getItem('lastSeenMessageIndex');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.global !== undefined) lastSeenMessageIndex.global = parsed.global;
        if (parsed.private) lastSeenMessageIndex.private = parsed.private;
        if (parsed.group) lastSeenMessageIndex.group = parsed.group;
    }
} catch (e) {
    console.log('Could not load last seen indices:', e);
}

// Track offline notifications shown to avoid repetition
const offlineNotificationsShown = new Set();

// Track recent chat switches to prevent immediate re-render
let lastChatSwitchTime = 0;
let lastChatSwitchTarget = null;

// Track which chats have had their new messages divider viewed
const viewedChats = new Set();

// Clean up viewed chats that have no unread messages
function cleanupViewedChats() {
    // Remove viewed state for chats with zero unread count
    if (unreadCounts.global === 0) {
        viewedChats.delete('global');
    }
    
    for (const user in unreadCounts.private) {
        if (unreadCounts.private[user] === 0) {
            viewedChats.delete(`private_${user}`);
        }
    }
    
    for (const groupId in unreadCounts.group) {
        if (unreadCounts.group[groupId] === 0) {
            viewedChats.delete(`group_${groupId}`);
        }
    }
}

// Insert "new messages" divider
function insertNewMessagesDivider() {
    const divider = document.createElement('div');
    divider.className = 'new-messages-divider';
    divider.innerHTML = `
        <div style="
            display: flex;
            align-items: center;
            margin: 20px 0;
            padding: 0 20px;
        ">
            <div style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #8b0000, transparent);"></div>
            <span style="
                padding: 0 15px;
                color: #8b0000;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                white-space: nowrap;
            ">New Messages</span>
            <div style="flex: 1; height: 1px; background: linear-gradient(to left, transparent, #8b0000, transparent);"></div>
        </div>
    `;
    messagesContainer.appendChild(divider);
}

// Clear unread count for current chat and update last seen index
function clearUnreadForCurrentChat() {
    // Mark this chat as viewed so we don't scroll to divider again
    const chatKey = currentChatType === 'global' ? 'global' : `${currentChatType}_${currentChatTarget}`;
    viewedChats.add(chatKey);
    
    if (currentChatType === 'global') {
        unreadCounts.global = 0;
        // Update last seen index to the last message in global chat
        lastSeenMessageIndex.global = chatHistories.global.length - 1;
    } else if (currentChatType === 'private' && currentChatTarget) {
        unreadCounts.private[currentChatTarget] = 0;
        // Update last seen index for this private chat
        const history = chatHistories.private[currentChatTarget] || [];
        lastSeenMessageIndex.private[currentChatTarget] = history.length - 1;
    } else if (currentChatType === 'group' && currentChatTarget) {
        unreadCounts.group[currentChatTarget] = 0;
        // Update last seen index for this group
        const history = chatHistories.group[currentChatTarget] || [];
        lastSeenMessageIndex.group[currentChatTarget] = history.length - 1;
    }
    updateTotalUnreadCount();
    updateUnreadCountsUI();
    
    // Save to localStorage
    try {
        localStorage.setItem('lastSeenMessageIndex', JSON.stringify(lastSeenMessageIndex));
    } catch (e) {
        console.log('Could not save last seen indices:', e);
    }
    
    // Clear any persistent banner when switching to the relevant chat
    const banner = document.getElementById('inAppBanner');
    if (banner) banner.remove();
}

// Native/browser notifications helper
function notifySystem(title, body) {
    try {
        if (localStorage.getItem('notifications') === 'false') return;
        if (!('Notification' in window)) return;
        const show = () => {
            try { new Notification(title, { body }); } catch (e) { /* ignore */ }
        };
        if (Notification.permission === 'granted') {
            show();
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => { if (p === 'granted') show(); });
        }
    } catch (e) { /* noop */ }
}

// In-app persistent banner (no auto-remove)
function showInAppBanner(text) {
    const existing = document.getElementById('inAppBanner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'inAppBanner';
    banner.style.cssText = `
        position: fixed;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-secondary);
        border: 1px solid #8b0000;
        color: #e8e4e4;
        padding: 10px 14px;
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,.35);
        z-index: 10000;
        font-weight: 600;
        cursor: pointer;
    `;
    banner.textContent = text;
    banner.onclick = () => banner.remove();
    document.body.appendChild(banner);
}

function updateTotalUnreadCount() {
    unreadCounts.total = unreadCounts.global +
        Object.values(unreadCounts.private).reduce((a, b) => a + b, 0) +
        Object.values(unreadCounts.group).reduce((a, b) => a + b, 0);
}

// Track window focus
let isWindowFocused = true;
window.addEventListener('focus', () => isWindowFocused = true);
window.addEventListener('blur', () => isWindowFocused = false);

// DOM Elements
const connectionScreen = document.getElementById('connectionScreen');
const mainApp = document.getElementById('mainApp');
const connectBtn = document.getElementById('connectBtn');
const usernameInput = document.getElementById('usernameInput');
const hostInput = document.getElementById('hostInput');
const portInput = document.getElementById('portInput');
const userName = document.getElementById('userName');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
// Dynamically add mic button next to message input if not present
if (!document.getElementById('audioRecordBtn')) {
    const micBtn = document.createElement('button');
    micBtn.id = 'audioRecordBtn';
    micBtn.title = 'Record Audio';
    micBtn.style.cssText = 'margin-left: 8px; background: #8B0000; color: white; border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer;';
    micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm5 9a1 1 0 0 1 2 0c0 4.418-3.582 8-8 8s-8-3.582-8-8a1 1 0 0 1 2 0c0 3.314 2.686 6 6 6s6-2.686 6-6z"/></svg>';
    // Insert after message input
    messageInput.parentNode.insertBefore(micBtn, sendBtn);
    micBtn.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
        }
    });
}
const usersList = document.getElementById('usersList');
const groupsList = document.getElementById('groupsList');
const filesPanel = document.getElementById('filesPanel');
const filesToggleBtn = document.getElementById('filesToggleBtn');
const closeFilesBtn = document.getElementById('closeFilesBtn');
const filesList = document.getElementById('filesList');
const uploadFileBtn = document.getElementById('uploadFileBtn');
const fileInput = document.getElementById('fileInput');
const chatHeaderName = document.getElementById('chatHeaderName');
const chatHeaderStatus = document.getElementById('chatHeaderStatus');
const attachBtn = document.getElementById('attachBtn');
const newGroupBtn = document.getElementById('newGroupBtn');
const chatsDisplay = document.getElementById('chatsDisplay');
const globalNetworkItem = document.getElementById('globalNetworkItem');
const noUsersMsg = document.getElementById('noUsersMsg');
const noGroupsMsg = document.getElementById('noGroupsMsg');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');
const videoCallBtn = document.getElementById('videoCallBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const themeOptions = document.querySelectorAll('.theme-option');
const notificationsToggle = document.getElementById('notificationsToggle');
const soundsToggle = document.getElementById('soundsToggle');
const onlineStatusToggle = document.getElementById('onlineStatusToggle');
const audioRecordBtn = document.getElementById('audioRecordBtn');

// Ensure badge elements exist for totals and global
function ensureBadges() {
    try {
        // Tab total badges
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (!btn.querySelector('.unread-total')) {
                const span = document.createElement('span');
                span.className = 'unread-total';
                span.style.cssText = 'margin-left:6px; display:none; background:#2ecc71; color:#fff; padding:1px 6px; border-radius:10px; font-size:12px;';
                btn.appendChild(span);
            }
        });
        // Global badge (RED for global)
        const globalBadgeParent = document.querySelector('#globalNetworkItem .chat-info .chat-name');
        if (globalBadgeParent && !document.querySelector('#globalNetworkItem .unread-count')) {
            const span = document.createElement('span');
            span.className = 'unread-count';
            span.style.cssText = 'display:none; background:#8b0000; color:white; padding:2px 6px; border-radius:10px; font-size:12px; margin-left:8px;';
            span.textContent = '0';
            globalBadgeParent.appendChild(span);
        }
    } catch (e) { /* noop */ }
}

// ===== CONNECTION =====
connectBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim();
    const host = hostInput.value.trim() || 'localhost';
    const port = parseInt(portInput.value.trim() || '5555');
    
    if (!user) {
        showNotification('Enter a username', 'warning');
        return;
    }
    
    connectBtn.disabled = true;
    connectBtn.textContent = 'CONNECTING...';
    
    try {
        const result = await eel.connect_to_server(user, host, port)();
        if (result.success) {
            username = user;
            userName.textContent = user + ' ';
            const statusIcon = document.createElement('span');
            statusIcon.innerHTML = '🟢';
            statusIcon.style.color = '#2ecc71';
            statusIcon.style.fontSize = '12px';  // CHANGE THIS
            statusIcon.style.verticalAlign = 'middle';
            userName.appendChild(statusIcon);
            
            connectionScreen.classList.remove('active');
            mainApp.classList.add('active');
            
            // Ensure we're in global chat mode when connecting
            currentChatType = 'global';
            currentChatTarget = null;
            chatHeaderName.textContent = 'Global Network';
            chatHeaderStatus.textContent = 'Secure broadcast channel';
            
            // Highlight the global network item
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
            globalNetworkItem.classList.add('active');
            
            showNotification('Connected!', 'success');
            
            // Ensure badges are created
            ensureBadges();
            
            // Start polling for data if Eel bridge is not working
            setTimeout(() => {
                console.log('===== STARTING DATA POLLING =====');
                pollForData();
            }, 2000);
            
            // Test Eel bridge first
            setTimeout(() => {
                console.log('===== TESTING EEL BRIDGE =====');
                try {
                    eel.test_connection()().then(result => {
                        console.log('Eel bridge test result:', result);
                    }).catch(err => {
                        console.log('Eel bridge test failed:', err);
                    });
                } catch (e) {
                    console.log('Eel bridge not available:', e);
                }
            }, 500);
            
            // Force render after a short delay to ensure data is received
            setTimeout(() => {
                console.log('===== FORCE RENDERING AFTER CONNECT =====');
                console.log('Global history length:', chatHistories.global.length);
                
                // If we still don't have data, request it explicitly
                if (chatHistories.global.length === 0) {
                    console.log('No chat history received, requesting explicitly...');
                    eel.send_message('request_chat_history', '', {})();
                    eel.refresh_user_list()();
                }
                
                // Render and scroll to appropriate position
                renderCurrentChat(false); // Don't preserve scroll, will auto-position
            }, 1000);
        } else {
            showNotification(result.message, 'error');
            connectBtn.disabled = false;
            connectBtn.textContent = 'CONNECT';
        }
    } catch (error) {
        showNotification('Connection failed', 'error');
        connectBtn.disabled = false;
        connectBtn.textContent = 'CONNECT';
    }
});

[usernameInput, hostInput, portInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') connectBtn.click();
    });
});

// ===== MESSAGING =====
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    messageInput.value = '';
    messageInput.focus();
    
    if (currentChatType === 'private' && currentChatTarget) {
        // Check if user is offline and show notification only once
        if (!allUsers.includes(currentChatTarget) && !offlineNotificationsShown.has(currentChatTarget)) {
            showNotification(`${currentChatTarget} is offline. They will receive your message when they come online.`, 'warning');
            offlineNotificationsShown.add(currentChatTarget);
        }
        
        addToRecentChats(currentChatTarget);
        await eel.send_message('private', content, {receiver: currentChatTarget})();
    } else if (currentChatType === 'group') {
        await eel.send_message('group_message', content, {group_id: currentChatTarget})();
    } else {
        await eel.send_message('chat', content, {})();
    }
}

eel.expose(handleMessage);
function updateUnreadCount(type, target = null) {
    // Update specific chat unread count
    if (type === 'global') {
        unreadCounts.global++;
    } else if (type === 'private' && target) {
        unreadCounts.private[target] = (unreadCounts.private[target] || 0) + 1;
    } else if (type === 'group' && target) {
        unreadCounts.group[target] = (unreadCounts.group[target] || 0) + 1;
    }
    
    // Update total count
    unreadCounts.total++;
    
    // Update UI
    updateUnreadCountsUI();
}

function updateUnreadCountsUI() {
    // Update tab title
    if (unreadCounts.total > 0) {
        document.title = `(${unreadCounts.total}) Shadow Nexus`;
    } else {
        document.title = 'Shadow Nexus';
    }
    
    // Update chat list items (private)
    Object.entries(unreadCounts.private).forEach(([user, count]) => {
        const chatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
        if (chatItem) {
            let unreadBadge = chatItem.querySelector('.unread-count');
            if (!unreadBadge) {
                const nameEl = chatItem.querySelector('.chat-name');
                if (nameEl) {
                    unreadBadge = document.createElement('span');
                    unreadBadge.className = 'unread-count';
                    unreadBadge.style.cssText = 'display:none; background:#2ecc71; color:white; padding:2px 6px; border-radius:10px; font-size:12px; margin-left:8px;';
                    nameEl.appendChild(unreadBadge);
                }
            }
            if (unreadBadge) {
                if (count > 0) {
                    unreadBadge.textContent = count;
                    unreadBadge.style.display = 'inline-block';
                    unreadBadge.style.background = '#2ecc71'; // Green for private
                    unreadBadge.style.color = '#fff';
                } else {
                    unreadBadge.style.display = 'none';
                }
            }
        }
    });

    // Update group list items
    Object.entries(unreadCounts.group).forEach(([gid, count]) => {
        const chatItem = document.querySelector(`.chat-item[data-group-id="${gid}"]`);
        if (chatItem) {
            let unreadBadge = chatItem.querySelector('.unread-count');
            if (!unreadBadge) {
                const nameEl = chatItem.querySelector('.chat-name');
                if (nameEl) {
                    unreadBadge = document.createElement('span');
                    unreadBadge.className = 'unread-count';
                    unreadBadge.style.cssText = 'display:none; background:#2ecc71; color:white; padding:2px 6px; border-radius:10px; font-size:12px; margin-left:8px;';
                    nameEl.appendChild(unreadBadge);
                }
            }
            if (unreadBadge) {
                if (count > 0) {
                    unreadBadge.textContent = count;
                    unreadBadge.style.display = 'inline-block';
                    unreadBadge.style.background = '#2ecc71'; // Green for groups
                    unreadBadge.style.color = '#fff';
                } else {
                    unreadBadge.style.display = 'none';
                }
            }
        }
    });
    
    // Update global chat badge (RED for global only)
    const globalBadge = document.querySelector('#globalNetworkItem .unread-count');
    if (globalBadge) {
        if (unreadCounts.global > 0) {
            globalBadge.textContent = unreadCounts.global;
            globalBadge.style.display = 'inline-block';
            globalBadge.style.background = '#8b0000'; // RED for global
            globalBadge.style.color = '#fff';
        } else {
            globalBadge.style.display = 'none';
        }
    } else {
        // If badge doesn't exist, create it
        const globalName = document.querySelector('#globalNetworkItem .chat-name');
        if (globalName && !globalName.querySelector('.unread-count')) {
            const badge = document.createElement('span');
            badge.className = 'unread-count';
            badge.style.cssText = 'display: none; background: #8b0000; color: white; padding: 2px 6px; border-radius: 10px; font-size: 12px; margin-left: 8px;';
            globalName.appendChild(badge);
        }
    }
    
    // Update total badges
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const type = btn.dataset.tab;
        let count = 0;
        if (type === 'chats') {
            count = Object.values(unreadCounts.private).reduce((a, b) => a + b, 0);
        } else if (type === 'groups') {
            count = Object.values(unreadCounts.group).reduce((a, b) => a + b, 0);
        }
        const badge = btn.querySelector('.unread-total');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

function handleMessage(message) {
    console.log('===== MESSAGE RECEIVED =====');
    console.log('Type:', message.type);
    console.log('Current chat:', currentChatType, currentChatTarget);
    console.log('Message data:', message);
    console.log('Message keys:', Object.keys(message));
    
    // Determine active-view status per chat context
    const isViewingGlobal = currentChatType === 'global';
    const isViewingPrivateWith = (u) => currentChatType === 'private' && currentChatTarget === u;
    const isViewingGroup = (g) => currentChatType === 'group' && currentChatTarget === g;
    
    const msgType = message.type;

    // Store messages in appropriate history and display if in correct chat
    if (msgType === 'chat') {
        chatHistories.global.push(message);
        if (isViewingGlobal) {
            addMessage(message);
        } else {
            unreadCounts.global = (unreadCounts.global || 0) + 1;
            updateTotalUnreadCount();
            updateUnreadCountsUI();
            if (isWindowFocused) {
                showInAppBanner(`New message in Global Network`);
            } else {
                notifySystem('New message', 'New message in Global Network');
            }
        }
    }
    else if (msgType === 'private') {
        const otherUser = message.sender === username ? message.receiver : message.sender;
        if (!chatHistories.private[otherUser]) {
            chatHistories.private[otherUser] = [];
        }
        chatHistories.private[otherUser].push(message);
        
        if (isViewingPrivateWith(otherUser)) {
            addMessage(message);
        } else if (message.sender !== username) {
            unreadCounts.private[otherUser] = (unreadCounts.private[otherUser] || 0) + 1;
            updateTotalUnreadCount();
            updateUnreadCountsUI();
            const preview = (message.content || '').slice(0, 40);
            if (isWindowFocused) {
                showInAppBanner(`New message from ${message.sender}${preview ? ': ' + preview : ''}`);
            } else {
                notifySystem(`Message from ${message.sender}`, preview || 'New message');
            }
        }
        
        if (message.receiver === username) {
            addToRecentChats(message.sender);
        }
    }
    else if (msgType === 'private_file') {
        const otherUser = message.sender === username ? message.receiver : message.sender;
        if (!chatHistories.private[otherUser]) {
            chatHistories.private[otherUser] = [];
        }
        chatHistories.private[otherUser].push(message);
        
        if (currentChatType === 'private' && currentChatTarget === otherUser) {
            addMessage(message);
            addFileToList(message);
        }
        
        if (message.receiver === username) {
            addToRecentChats(message.sender);
            showNotification(`${message.sender} shared a file`, 'info');
        }
    }
    else if (msgType === 'group_message') {
        if (!chatHistories.group[message.group_id]) {
            chatHistories.group[message.group_id] = [];
        }
        chatHistories.group[message.group_id].push(message);
        
        if (isViewingGroup(message.group_id)) {
            addMessage(message);
        } else if (message.sender !== username) {
            unreadCounts.group[message.group_id] = (unreadCounts.group[message.group_id] || 0) + 1;
            updateTotalUnreadCount();
            updateUnreadCountsUI();
            const preview = (message.content || '').slice(0, 40);
            if (isWindowFocused) {
                showInAppBanner(`New message in group`);
            } else {
                notifySystem('Group message', preview || 'New group message');
            }
        }
    }
    else if (msgType === 'group_file') {
        if (!chatHistories.group[message.group_id]) {
            chatHistories.group[message.group_id] = [];
        }
        chatHistories.group[message.group_id].push(message);
        
        if (isViewingGroup(message.group_id)) {
            addMessage(message);
            addFileToList(message);
        }
    }
    else if (msgType === 'system') {
        addSystemMessage(message.content);
    }
    else if (msgType === 'message_deleted') {
        // Handle message deletion notification
        const messageId = message.message_id;
        const chatType = message.chat_type;
        const chatTarget = message.chat_target;
        
        console.log('Message deleted notification:', messageId, chatType, chatTarget);
        
        // Update the message in the UI if it's visible
        const messageElements = document.querySelectorAll('.message');
        messageElements.forEach(msgEl => {
            const bubble = msgEl.querySelector('.message-bubble');
            if (bubble && bubble.textContent.includes(messageId)) {
                bubble.innerHTML = '<span class="message-deleted">🚫 This message was deleted</span>';
                bubble.style.fontStyle = 'italic';
                bubble.style.opacity = '0.6';
                
                // Remove menu button
                const menuBtn = msgEl.querySelector('.message-menu-btn');
                if (menuBtn) menuBtn.remove();
            }
        });
        
        showNotification('Message deleted', 'info');
    }
    else if (msgType === 'chat_history') {
        console.log('===== PROCESSING CHAT HISTORY =====');
        console.log('Received messages:', message.messages?.length || 0);
        const oldMessageCount = chatHistories.global.length;
        const newMessages = message.messages || [];
        chatHistories.global = newMessages;
        console.log('Stored in chatHistories.global:', chatHistories.global.length);
        console.log('Current chat type:', currentChatType);
        
        if (isViewingGlobal) {
            console.log('Rendering global chat...');
            
            // Check if we just switched to global chat (within 2 seconds)
            const timeSinceSwitch = Date.now() - lastChatSwitchTime;
            const isRecentSwitch = lastChatSwitchTarget === 'global' && timeSinceSwitch < 2000;
            
            // Only skip re-render if it's a recent switch AND message count is the same
            const shouldSkipRender = isRecentSwitch && (oldMessageCount === newMessages.length);
            
            if (!shouldSkipRender) {
                // Re-render (will use last seen index for divider)
                renderCurrentChat(true);
            }
        } else {
            console.log('Not in global chat, not rendering yet');
        }
    }
    else if (msgType === 'private_history') {
        // Server may send the field as 'receiver' or 'target_user' depending on source
        const targetUser = message.target_user || message.receiver || message.target || message.user;
        if (targetUser) {
            const oldMessageCount = (chatHistories.private[targetUser] || []).length;
            const newMessages = message.messages || [];
            chatHistories.private[targetUser] = newMessages;
            
            if (currentChatType === 'private' && currentChatTarget === targetUser) {
                // Check if we just switched to this chat (within 2 seconds)
                const timeSinceSwitch = Date.now() - lastChatSwitchTime;
                const isRecentSwitch = lastChatSwitchTarget === targetUser && timeSinceSwitch < 2000;
                
                // Only skip re-render if it's a recent switch AND message count is the same
                // If message count changed, we need to re-render to show new messages
                const shouldSkipRender = isRecentSwitch && (oldMessageCount === newMessages.length);
                
                if (!shouldSkipRender) {
                    // Re-render (will use last seen index for divider)
                    renderCurrentChat(true);
                }
            }
        } else {
            console.log('WARN: private_history received without target user', message);
        }
    }
    else if (msgType === 'group_history') {
        const groupId = message.group_id;
        const oldMessageCount = (chatHistories.group[groupId] || []).length;
        const newMessages = message.messages || [];
        chatHistories.group[groupId] = newMessages;
        
        if (currentChatType === 'group' && currentChatTarget === groupId) {
            // Check if we just switched to this chat (within 2 seconds)
            const timeSinceSwitch = Date.now() - lastChatSwitchTime;
            const isRecentSwitch = lastChatSwitchTarget === groupId && timeSinceSwitch < 2000;
            
            // Only skip re-render if it's a recent switch AND message count is the same
            const shouldSkipRender = isRecentSwitch && (oldMessageCount === newMessages.length);
            
            if (!shouldSkipRender) {
                // Re-render (will use last seen index for divider)
                renderCurrentChat(true);
            }
        }
    }
    else if (msgType === 'user_list') {
        console.log('===== PROCESSING USER LIST =====');
        console.log('Received users:', message.users);
        updateUsersList(message.users);
    }
    else if (msgType === 'group_list') {
        updateGroupsList(message.groups);
    }
    else if (msgType === 'file_notification') {
        chatHistories.global.push(message);
        addFileToList(message);
        
        if (currentChatType === 'global') {
            addMessage(message);
        }
        
        if (message.sender !== username) {
            showNotification(`${message.sender} shared a file`, 'info');
        }
    }
    else if (msgType === 'file_metadata') {
        message.files.forEach(file => addFileToList(file));
    }
    else if (msgType === 'audio_message' || msgType === 'private_audio' || msgType === 'group_audio') {
        if (msgType === 'audio_message') {
            chatHistories.global.push(message);
            if (currentChatType === 'global') {
                addMessage(message);
            }
        }
        else if (msgType === 'private_audio') {
            const otherUser = message.sender === username ? message.receiver : message.sender;
            if (!chatHistories.private[otherUser]) {
                chatHistories.private[otherUser] = [];
            }
            chatHistories.private[otherUser].push(message);
            
            if (currentChatType === 'private' && currentChatTarget === otherUser) {
                addMessage(message);
            }
            
            if (message.receiver === username) {
                addToRecentChats(message.sender);
                showNotification(`${message.sender} sent an audio message`, 'info');
            }
        }
        else if (msgType === 'group_audio') {
            if (!chatHistories.group[message.group_id]) {
                chatHistories.group[message.group_id] = [];
            }
            chatHistories.group[message.group_id].push(message);
            
            if (currentChatType === 'group' && currentChatTarget === message.group_id) {
                addMessage(message);
            }
        }
    }
    // Handle video invites with proper storage
    else if (msgType === 'video_invite') {
        console.log('[VIDEO] Global video invite received');
        chatHistories.global.push(message);
        
        // Display the invite if we're viewing global chat
        if (currentChatType === 'global') {
            if (message.is_acknowledgment) {
                // This is just an acknowledgment, don't show the invite again
                return;
            }
            handleVideoInvite(message);
        } else if (message.sender !== username) {
            // We're not in global chat but someone else started a call
            showNotification(`${message.sender} started a video call in Global Network`, 'info');
        }
    }
    else if (msgType === 'video_invite_private') {
        console.log('[VIDEO] Private video invite received');
        const otherUser = message.sender === username ? message.receiver : message.sender;

        if (!chatHistories.private[otherUser]) {
            chatHistories.private[otherUser] = [];
        }
        chatHistories.private[otherUser].push(message);

        // Both sender and receiver should see the join button if they're viewing the chat
        if (currentChatType === 'private' && currentChatTarget === otherUser) {
            if (message.is_acknowledgment) {
                // This is just an acknowledgment, don't show the invite again
                return;
            }
            handleVideoInvite(message);
        } else if (message.sender !== username) {
            // We're the receiver but not viewing this chat
            showNotification(`${message.sender} started a video call`, 'info');
        }
    }
    else if (msgType === 'video_invite_group') {
        console.log('[VIDEO] Group video invite received');

        if (!chatHistories.group[message.group_id]) {
            chatHistories.group[message.group_id] = [];
        }
        chatHistories.group[message.group_id].push(message);

        // Display the invite if we're viewing this group chat
        if (currentChatType === 'group' && currentChatTarget === message.group_id) {
            if (message.is_acknowledgment) {
                // This is just an acknowledgment, don't show the invite again
                return;
            }
            handleVideoInvite(message);
        } else if (message.sender !== username) {
            // We're not viewing this group but someone else started a call
            showNotification(`${message.sender} started a video call in group`, 'info');
        }
    }
    else if (msgType === 'video_missed') {
        // Only handle the missed call state, don't show VideoServer system message
        if (message.sender === 'VideoServer') {
            // Silently update the call states without showing a system message
            handleVideoMissed(message);
            return; // Don't add to chat history
        }
        handleVideoMissed(message);
    }
}

function renderCurrentChat(preserveScroll = true) {
    console.log('===== RENDERING CURRENT CHAT =====');
    console.log('Chat type:', currentChatType);
    console.log('Global history length:', chatHistories.global.length);
    
    // Store current scroll position and check if we're at bottom
    const wasAtBottom = isAtBottom();
    const scrollPosition = messagesContainer.scrollTop;
    const scrollHeight = messagesContainer.scrollHeight;
    
    messagesContainer.innerHTML = '';
    
    // Determine if we should show "new messages" divider based on last seen index
    let showNewMessagesDivider = false;
    let newMessageStartIndex = -1;
    
    if (currentChatType === 'global') {
        const lastSeenIdx = lastSeenMessageIndex.global;
        const totalMessages = chatHistories.global.length;
        
        // Show divider if there are messages after last seen index
        if (lastSeenIdx >= 0 && lastSeenIdx < totalMessages - 1) {
            showNewMessagesDivider = true;
            newMessageStartIndex = lastSeenIdx + 1; // Divider goes after last seen message
        } else if (lastSeenIdx === -1 && totalMessages > 0) {
            // First time user - no divider (or could put at beginning)
            showNewMessagesDivider = false;
        }
    } else if (currentChatType === 'private' && currentChatTarget) {
        const history = chatHistories.private[currentChatTarget] || [];
        const lastSeenIdx = lastSeenMessageIndex.private[currentChatTarget] ?? -1;
        const totalMessages = history.length;
        
        if (lastSeenIdx >= 0 && lastSeenIdx < totalMessages - 1) {
            showNewMessagesDivider = true;
            newMessageStartIndex = lastSeenIdx + 1;
        } else if (lastSeenIdx === -1 && totalMessages > 0) {
            showNewMessagesDivider = false;
        }
    } else if (currentChatType === 'group' && currentChatTarget) {
        const history = chatHistories.group[currentChatTarget] || [];
        const lastSeenIdx = lastSeenMessageIndex.group[currentChatTarget] ?? -1;
        const totalMessages = history.length;
        
        if (lastSeenIdx >= 0 && lastSeenIdx < totalMessages - 1) {
            showNewMessagesDivider = true;
            newMessageStartIndex = lastSeenIdx + 1;
        } else if (lastSeenIdx === -1 && totalMessages > 0) {
            showNewMessagesDivider = false;
        }
    }
    
    // Render messages with divider
    if (currentChatType === 'global') {
        chatHistories.global.forEach((msg, index) => {
            // Insert new messages divider ONLY if not our own message
            if (showNewMessagesDivider && index === newMessageStartIndex && msg.sender !== username) {
                insertNewMessagesDivider();
            }
            
            if (msg.type === 'video_invite') {
                handleVideoInvite(msg, true); // true = from history
            } else {
                addMessage(msg, false); // Don't auto-scroll for each message
            }
        });
    } else if (currentChatType === 'private' && currentChatTarget) {
        const history = chatHistories.private[currentChatTarget] || [];
        history.forEach((msg, index) => {
            // Insert new messages divider
            if (showNewMessagesDivider && index === newMessageStartIndex) {
                insertNewMessagesDivider();
            }
            
            if (msg.type === 'video_invite_private') {
                handleVideoInvite(msg, true); // true = from history
            } else {
                addMessage(msg, false);
                if (msg.type === 'private_file') {
                    addFileToList(msg);
                }
            }
        });
    } else if (currentChatType === 'group' && currentChatTarget) {
        const history = chatHistories.group[currentChatTarget] || [];
        history.forEach((msg, index) => {
            // Insert new messages divider
            if (showNewMessagesDivider && index === newMessageStartIndex) {
                insertNewMessagesDivider();
            }
            
            if (msg.type === 'video_invite_group') {
                handleVideoInvite(msg, true); // true = from history
            } else {
                addMessage(msg, false);
                if (msg.type === 'group_file') {
                    addFileToList(msg);
                }
            }
        });
    }
    
    // Check if this chat has been viewed already
    const chatKey = currentChatType === 'global' ? 'global' : `${currentChatType}_${currentChatTarget}`;
    const hasBeenViewed = viewedChats.has(chatKey);
    
    // Handle scroll position restoration
    if (preserveScroll) {
        if (showNewMessagesDivider && !hasBeenViewed) {
            // Only scroll to divider if chat hasn't been viewed yet
            setTimeout(() => {
                const divider = messagesContainer.querySelector('.new-messages-divider');
                if (divider) {
                    divider.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Mark as viewed after scrolling
                    viewedChats.add(chatKey);
                }
            }, 100);
        } else if (wasAtBottom) {
            // Scroll to bottom if we were at bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            // Try to maintain relative scroll position
            const newScrollHeight = messagesContainer.scrollHeight;
            const heightDiff = newScrollHeight - scrollHeight;
            messagesContainer.scrollTop = scrollPosition + heightDiff;
        }
    } else {
        // When not preserving scroll (initial render), scroll to bottom or divider
        if (showNewMessagesDivider && !hasBeenViewed) {
            // Only scroll to divider on first view
            setTimeout(() => {
                const divider = messagesContainer.querySelector('.new-messages-divider');
                if (divider) {
                    divider.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Mark as viewed after scrolling
                    viewedChats.add(chatKey);
                }
            }, 100);
        } else {
            // Scroll to bottom for new users or when no divider
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}

// Helper function to check if scroll is at bottom
function isAtBottom() {
    const threshold = 50; // pixels from bottom to consider "at bottom"
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= threshold;
}

function addMessage(message, autoScroll = true) {
    // Skip VideoServer system messages completely
    if (message.sender === 'VideoServer' || message.sender === 'VIDEOSERVER') {
        return null;
    }
    
    // Check if this message was deleted by the user
    const deletedMessages = JSON.parse(localStorage.getItem('deletedMessages') || '{}');
    if (deletedMessages[message.id || message.timestamp]) {
        return null; // Skip this message if it was deleted
    }
    
    // Check if this is a reply to another message
    const isReply = message.replyTo || (message.metadata && message.metadata.replyTo);
    const replyInfo = message.replyTo || (message.metadata && message.metadata.replyTo);
    
    const isOwn = message.sender === username;
    const messageDiv = document.createElement('div');
    messageDiv.className = isOwn ? 'message own' : 'message';
    
    // Ensure every message has a unique ID
    const messageId = message.id || message.timestamp || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    messageDiv.dataset.messageId = messageId;
    messageDiv.dataset.sender = message.sender;
    messageDiv.dataset.timestamp = message.timestamp;
    
    // Add different-user class if this message is from a different user than the previous one
    const messages = messagesContainer.children;
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const lastSender = lastMessage.querySelector('.message-sender')?.textContent;
        if (lastSender && lastSender !== message.sender) {
            messageDiv.classList.add('different-user');
        }
    }
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.sender.charAt(0).toUpperCase();
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Create message header (sender and time)
    const header = document.createElement('div');
    header.className = 'message-header';
    
    // Add reply indicator if this is a reply (WhatsApp style)
    if (isReply && replyInfo) {
        const replyQuote = document.createElement('div');
        replyQuote.className = 'reply-quote';
        replyQuote.style.cssText = `
            background: ${isOwn ? 'rgba(0, 150, 136, 0.15)' : 'rgba(100, 100, 100, 0.2)'};
            border-left: 3px solid ${isOwn ? '#009688' : '#888'};
            padding: 8px 10px;
            margin-bottom: 6px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
        `;
        
        const replySender = document.createElement('div');
        replySender.style.cssText = 'font-weight: 600; color: #009688; margin-bottom: 3px; font-size: 13px;';
        replySender.textContent = replyInfo.sender === username ? 'You' : replyInfo.sender;
        
        const replyText = document.createElement('div');
        replyText.style.cssText = 'color: rgba(255, 255, 255, 0.7); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;';
        replyText.textContent = (replyInfo.text || '').substring(0, 100);
        
        replyQuote.appendChild(replySender);
        replyQuote.appendChild(replyText);
        content.appendChild(replyQuote);
    }
    
    const sender = document.createElement('span');
    sender.className = 'message-sender';
    sender.textContent = isOwn ? 'You' : message.sender;
    
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = message.timestamp || getCurrentTime();
    
    header.appendChild(sender);
    header.appendChild(time);
    content.appendChild(header);
    
    // Handle different message types
    if ((message.type === 'file_share' || message.type === 'file_notification' || message.type === 'private_file' || message.type === 'group_file') && message.file_id) {
        const fileItem = document.createElement('div');
        fileItem.className = 'message-bubble file-item';
        
        const infoSection = document.createElement('div');
        infoSection.className = 'file-info-section';
        infoSection.innerHTML = `
            <div class="file-name">${message.file_name || message.name}</div>
            <div class="file-detail">${formatFileSize(message.size || message.file_size)} • ${message.sender}</div>
        `;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'file-download-btn';
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = () => downloadFile(message);
        
        fileItem.appendChild(infoSection);
        fileItem.appendChild(downloadBtn);
        content.appendChild(fileItem);
    }
    else if ((message.type === 'audio_message' || message.type === 'private_audio' || message.type === 'group_audio') && (message.audio_data || message.has_audio)) {
        const audioItem = document.createElement('div');
        audioItem.className = 'message-bubble audio-item';
        
        const infoSection = document.createElement('div');
        infoSection.className = 'audio-info-section';
        infoSection.innerHTML = `
            <div class="audio-title">🎵 Audio Message</div>
            <div class="audio-detail">${message.duration}s • ${message.sender}</div>
        `;
        
        const playBtn = document.createElement('button');
        playBtn.className = 'audio-play-btn';
        playBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg> Play
        `;
        
        if (message.audio_data) {
            playBtn.onclick = () => {
                playBtn.disabled = true;
                playBtn.innerHTML = 'Playing...';
                
                eel.play_audio(message.audio_data)().then(() => {
                    playBtn.disabled = false;
                    playBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg> Play
                    `;
                });
            };
        } else {
            playBtn.textContent = 'Audio not available';
            playBtn.disabled = true;
        }
        
        audioItem.appendChild(infoSection);
        audioItem.appendChild(playBtn);
        content.appendChild(audioItem);
    }
    else if (!['private_file', 'file_share', 'file_notification', 'group_file', 'audio_message', 'private_audio', 'group_audio', 'video_invite', 'video_invite_private', 'video_invite_group'].includes(message.type)) {
        // Regular text message
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = message.content;
        content.appendChild(bubble);
        
        // Add message menu button to the bubble
        const menuBtn = document.createElement('button');
        menuBtn.className = 'message-menu-btn';
        menuBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
        `;
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!messageDiv.dataset.messageId) {
                messageDiv.dataset.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            showMessageContextMenu(e, messageDiv);
        };
        
        // Append menu button to the message bubble instead of message div
        bubble.appendChild(menuBtn);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    messagesContainer.appendChild(messageDiv);
    
    // Auto-scroll logic: always scroll for new messages, or if we're at bottom
    if (autoScroll) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else if (isAtBottom()) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    return messageDiv;
}


function createMenuButton(messageElement, isOwn) {
    const menuBtn = document.createElement('button');
    menuBtn.className = 'message-menu-btn';
    menuBtn.style.cssText = `
        position: absolute;
        ${isOwn ? 'left: 8px;' : 'right: 8px;'}
        top: 50%;
        transform: translateY(-50%);
        opacity: 0;
        transition: opacity 0.2s;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        cursor: pointer;
        padding: 6px;
        border-radius: 50%;
        z-index: 10;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    menuBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
    `;
    
    const parentBubble = menuBtn.closest('.message-bubble') || menuBtn.closest('.message-content');
    if (parentBubble) {
        parentBubble.addEventListener('mouseenter', () => {
            menuBtn.style.opacity = '1';
        });
        parentBubble.addEventListener('mouseleave', () => {
            menuBtn.style.opacity = '0';
        });
    }
    
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        messageElement.dataset.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        showMessageContextMenu(e, messageElement);
    };
    
    return menuBtn;
}



function handleVideoInvite(message, isFromHistory = false) {
    const { sender, link, session_id } = message;
    console.log('[VIDEO] Handling video invite from', sender, 'isFromHistory:', isFromHistory);
    
    // Check if this call was marked as missed in localStorage
    const missedCalls = JSON.parse(localStorage.getItem('missedVideoCalls') || '{}');
    const wasMissed = missedCalls[session_id];
    
    const isMissed = message.is_missed || wasMissed || false;
    const missedTime = message.missed_at || (wasMissed ? wasMissed.timestamp : '');
    const videoMessage = document.createElement('div');
    if (session_id) videoMessage.dataset.sessionId = session_id;
    
    // Show modal ONLY for real-time incoming calls (not historical ones, not your own calls)
    if (!isMissed && sender !== username && !isFromHistory) {
        showIncomingCallModal(sender, link, session_id);
    }

    if (isMissed) {
        // Reduced size and updated styling for missed call message
        videoMessage.innerHTML = `
       <div style="background: #2a2828;
            border: 1px solid #3d3838; 
            border-radius: 8px; 
            padding: 16px; 
            margin: 8px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            max-width: 380px;
            width: fit-content;
            min-width: 320px;">
    <div style="display: flex; 
                align-items: center; 
                gap: 12px; 
                margin-bottom: 12px;">
        <div style="font-size: 26px; 
                    line-height: 1; 
                    flex-shrink: 0;
                    filter: grayscale(40%) brightness(0.7);
                    opacity: 0.8;">📵</div>
        <div style="flex: 1; 
                    min-width: 0;">
            <div style="font-weight: 500; 
                        font-size: 14px; 
                        color: #c4c0c0; 
                        margin-bottom: 4px; 
                        line-height: 1.4;">
                ${sender} started a video call
            </div>
            <div style="font-size: 11px; 
                        color: #857f7f; 
                        line-height: 1.3;">
                ${message.timestamp || new Date().toLocaleTimeString()}
            </div>
        </div>
    </div>
    <button class="join-call-btn" 
            disabled
            style="width: 100%; 
                   background: #484444; 
                   border: 1px solid #524e4e; 
                   border-radius: 6px; 
                   padding: 10px 12px; 
                   color: #908a8a; 
                   font-weight: 500; 
                   font-size: 13px; 
                   cursor: not-allowed; 
                   font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                   text-transform: uppercase;
                   letter-spacing: 0.8px;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   gap: 8px;
                   box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
                   opacity: 0.7;">
        <span style="filter: grayscale(40%) brightness(0.7);">📵</span>
        <span>Missed Call (${missedTime})</span>
    </button>
</div>

        `;
    } else {
        // Reduced size and updated styling for active video call invitation
        videoMessage.innerHTML = `
       <div style="background: #2a2828;
            border: 1px solid #3d3838; 
            border-radius: 8px; 
            padding: 16px; 
            margin: 8px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            max-width: 380px;
            width: fit-content;
            min-width: 320px;">
    <div style="display: flex; 
                align-items: center; 
                gap: 12px; 
                margin-bottom: 12px;">
        <div style="font-size: 26px; 
                    line-height: 1; 
                    flex-shrink: 0;
                    filter: grayscale(20%) brightness(0.9);">📹</div>
        <div style="flex: 1; 
                    min-width: 0;">
            <div style="font-weight: 500; 
                        font-size: 14px; 
                        color: #e0dede; 
                        margin-bottom: 4px; 
                        line-height: 1.4;">
                ${sender} started a video call
            </div>
            <div style="font-size: 11px; 
                        color: #9a9696; 
                        line-height: 1.3;">
                ${message.timestamp || new Date().toLocaleTimeString()}
            </div>
        </div>
    </div>
    <button class="join-call-btn" 
            onclick="window.open('${link}?username=${encodeURIComponent(username)}', 'video_call', 'width=1200,height=800')"
            style="width: 100%; 
                   background: linear-gradient(135deg, #c62828, #c62828); 
                   border: 1px solid #d32f2f; 
                   border-radius: 6px; 
                   padding: 10px 12px; 
                   color: #ffffff; 
                   font-weight: 600; 
                   font-size: 13px; 
                   cursor: pointer; 
                   transition: all 0.2s ease;
                   font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                   text-transform: uppercase;
                   letter-spacing: 0.8px;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   gap: 8px;
                   box-shadow: 0 2px 6px #c62828;"
            onmouseover="this.style.background='linear-gradient(135deg, #d32f2f, #c62828)'; this.style.boxShadow='0 4px 12px rgba(198, 40, 40, 0.6)';"
            onmouseout="this.style.background='linear-gradient(135deg, #c62828, #c62828)'; this.style.boxShadow='0 2px 6px rgba(198, 40, 40, 0.4)';">
        <span>🎥</span>
        <span>Join Video Call</span>
    </button>
</div>


        `;
    }
    messagesContainer.appendChild(videoMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showIncomingCallModal(sender, link, sessionId) {
    // Check if this call has been ignored
    const ignoredCalls = JSON.parse(localStorage.getItem('ignoredVideoCalls') || '{}');
    if (ignoredCalls[sessionId]) {
        console.log('[VIDEO] Call already ignored, not showing modal');
        return;
    }
    
    // Remove any existing modal
    const existing = document.getElementById('incomingCallModal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'incomingCallModal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: linear-gradient(135deg, #2d3142, #1a1d29); border: 3px solid var(--accent-pink); border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; box-shadow: 0 8px 32px rgba(198, 40, 40, 0.6); animation: slideIn 0.3s ease;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 64px; margin-bottom: 16px; animation: pulse 2s infinite;">📹</div>
                    <h2 style="color: var(--text-bright); font-family: 'Bangers', cursive; font-size: 24px; margin: 0 0 8px 0; letter-spacing: 2px;">${sender} is calling...</h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin: 0;">Incoming video call</p>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button id="answerCallBtn" style="flex: 1; background: linear-gradient(135deg, #c62828, #8B0000); border: none; border-radius: 8px; padding: 14px; color: white; font-weight: 600; font-size: 15px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(198, 40, 40, 0.4); transition: all 0.2s;">
                        📞 Answer
                    </button>
                    <button id="ignoreCallBtn" style="flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 14px; color: #bbb; font-weight: 600; font-size: 15px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: all 0.2s;">
                        ❌ Ignore
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add hover effects and click handlers
    const answerBtn = document.getElementById('answerCallBtn');
    const ignoreBtn = document.getElementById('ignoreCallBtn');
    
    answerBtn.onmouseover = () => answerBtn.style.transform = 'scale(1.05)';
    answerBtn.onmouseout = () => answerBtn.style.transform = 'scale(1)';
    answerBtn.onclick = () => {
        // Remove from ignored calls when answering
        const ignoredCalls = JSON.parse(localStorage.getItem('ignoredVideoCalls') || '{}');
        if (ignoredCalls[sessionId]) {
            delete ignoredCalls[sessionId];
            localStorage.setItem('ignoredVideoCalls', JSON.stringify(ignoredCalls));
        }
        window.open(`${link}?username=${encodeURIComponent(username)}`, 'video_call', 'width=1200,height=800');
        modal.remove();
    };
    
    ignoreBtn.onmouseover = () => { ignoreBtn.style.background = 'rgba(255,255,255,0.15)'; ignoreBtn.style.color = '#fff'; };
    ignoreBtn.onmouseout = () => { ignoreBtn.style.background = 'rgba(255,255,255,0.1)'; ignoreBtn.style.color = '#bbb'; };
    ignoreBtn.onclick = () => {
        // Mark this call as ignored in localStorage
        const ignoredCalls = JSON.parse(localStorage.getItem('ignoredVideoCalls') || '{}');
        ignoredCalls[sessionId] = true;
        localStorage.setItem('ignoredVideoCalls', JSON.stringify(ignoredCalls));
        console.log('[VIDEO] Call ignored and saved:', sessionId);
        modal.remove();
    };
    
    // Auto-remove modal after 30 seconds
    setTimeout(() => {
        if (document.getElementById('incomingCallModal')) {
            modal.remove();
        }
    }, 30000);
}

function handleVideoMissed(message) {
    const sessionId = message.session_id;
    const timestamp = message.timestamp || getCurrentTime();
    if (!sessionId) return;

    console.log('[VIDEO] Handling missed call for session:', sessionId);
    
    // Close incoming call modal if it's open
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.remove();
    
    // Remove from ignored calls (since it's now officially missed)
    const ignoredCalls = JSON.parse(localStorage.getItem('ignoredVideoCalls') || '{}');
    if (ignoredCalls[sessionId]) {
        delete ignoredCalls[sessionId];
        localStorage.setItem('ignoredVideoCalls', JSON.stringify(ignoredCalls));
    }

    // Store missed call state in localStorage to persist across tab switches
    const missedCalls = JSON.parse(localStorage.getItem('missedVideoCalls') || '{}');
    missedCalls[sessionId] = {
        timestamp: timestamp,
        session_type: message.session_type,
        chat_id: message.chat_id
    };
    localStorage.setItem('missedVideoCalls', JSON.stringify(missedCalls));

    // Find all video invite messages with this session ID
    const selectors = document.querySelectorAll(`[data-session-id="${sessionId}"]`);
    console.log('[VIDEO] Found', selectors.length, 'invite messages to update');
    
    selectors.forEach(el => {
        const btn = el.querySelector('.join-call-btn');
        if (btn && !btn.disabled) {  // Only update if not already disabled
            console.log('[VIDEO] Updating button to missed call');
            btn.disabled = true;
            btn.textContent = `📵 Missed Call (${timestamp})`;
            btn.style.background = 'linear-gradient(135deg, #555, #777)';
            btn.style.cursor = 'default';
            btn.onmouseover = null;
            btn.onmouseout = null;
        }
    });
    
    // Also update in stored history
    if (message.session_type === 'global') {
        updateVideoInviteInHistory(chatHistories.global, sessionId, timestamp);
    } else if (message.session_type === 'private' && message.chat_id) {
        const otherUser = message.chat_id;
        if (chatHistories.private[otherUser]) {
            updateVideoInviteInHistory(chatHistories.private[otherUser], sessionId, timestamp);
        }
    } else if (message.session_type === 'group' && message.chat_id) {
        if (chatHistories.group[message.chat_id]) {
            updateVideoInviteInHistory(chatHistories.group[message.chat_id], sessionId, timestamp);
        }
    }
}

function updateVideoInviteInHistory(history, sessionId, timestamp) {
    // Find and mark the video invite as missed in history
    for (let msg of history) {
        if (msg.session_id === sessionId && 
            (msg.type === 'video_invite' || msg.type === 'video_invite_private' || msg.type === 'video_invite_group')) {
            msg.is_missed = true;
            msg.missed_at = timestamp;
            console.log('[VIDEO] Marked invite as missed in history');
        }
    }
}

function restoreVideoCallStates() {
    // Restore missed call states from localStorage when tab becomes visible
    console.log('[VIDEO] Restoring video call states from localStorage');
    const missedCalls = JSON.parse(localStorage.getItem('missedVideoCalls') || '{}');
    
    for (const sessionId in missedCalls) {
        const missedInfo = missedCalls[sessionId];
        const selectors = document.querySelectorAll(`[data-session-id="${sessionId}"]`);
        
        selectors.forEach(el => {
            const btn = el.querySelector('.join-call-btn');
            if (btn && !btn.disabled) {
                console.log('[VIDEO] Restoring missed call state for session:', sessionId);
                btn.disabled = true;
                btn.textContent = `📵 Missed Call (${missedInfo.timestamp})`;
                btn.style.background = '#484444';
                btn.style.borderColor = '#524e4e';
                btn.style.color = '#908a8a';
                btn.style.cursor = 'not-allowed';
                btn.style.opacity = '0.7';
                btn.onmouseover = null;
                btn.onmouseout = null;
                btn.onclick = null;
            }
        });
    }
}

function addSystemMessage(content) {
    // Skip VideoServer messages
    if (content && (content.includes('VideoServer') || content.includes('VIDEOSERVER') || content.includes('Missed video call (session'))) {
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ===== USER & GROUP LISTS =====
function updateUsersList(users) {
    console.log('===== UPDATING USER LIST =====');
    console.log('Received users:', users);
    console.log('Current username:', username);
    
    // Update global allUsers list
    allUsers = users || [];
    
    // Clear offline notification tracking for users who came back online
    offlineNotificationsShown.forEach(user => {
        if (allUsers.includes(user)) {
            offlineNotificationsShown.delete(user);
        }
    });
    // Get all users we've chatted with privately from storage
    const chattedUsers = new Set();
    // Check private_chats.json format: keys like "user1_user2"
    for (const key in chatHistories.private) {
        const messages = chatHistories.private[key];
        if (!messages || messages.length === 0) continue;
        // Check if current username is involved in this chat
        const hasMyMessages = messages.some(msg => 
            msg.sender === username || msg.receiver === username
        );
        if (hasMyMessages) {
            // Extract the other user's name
            const parts = key.split('_');
            const otherUser = parts[0] === username ? parts[1] : parts[0];
            if (otherUser && otherUser !== username) {
                chattedUsers.add(otherUser);
            }
        }
    }
    // Add current online users (if not already in chattedUsers and not yourself)
    users.filter(u => u !== username && !chattedUsers.has(u)).forEach(user => {
        chattedUsers.add(user);
    });
    const chatUsersArray = Array.from(chattedUsers);
    usersList.innerHTML = '';
    if (chatUsersArray.length === 0) {
        noUsersMsg.style.display = 'block';
        return;
    }
    noUsersMsg.style.display = 'none';
    chatUsersArray.forEach(user => {
        const isOnline = users.includes(user);
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.user = user;
        chatItem.onclick = () => switchToPrivateChat(user);
        // Get last message for this user - check both key formats
        let lastMessage = null;
        const key1 = `${username}_${user}`;
        const key2 = `${user}_${username}`;
        const messages = chatHistories.private[key1] || chatHistories.private[key2] || [];
        if (messages.length > 0) {
            lastMessage = messages[messages.length - 1];
        }
        const lastMsgText = lastMessage ? lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? '...' : '') : 'No messages yet';
        chatItem.innerHTML = `
            <div class="chat-avatar">👤</div>
            <div class="chat-info">
                <div class="chat-name">${user} 
                    <span style="font-size: 14px; vertical-align: middle; color: ${isOnline ? '#2ecc71' : '#95a5a6'}; margin-left: 4px;">●</span>
                    <span class="unread-count" style="display: none; background: #2ecc71; color: white; padding: 2px 6px; border-radius: 10px; font-size: 12px; margin-left: 8px;">0</span>
                </div>
                <div class="chat-last-msg">${lastMsgText}</div>
            </div>
            <button class="chat-menu-btn" onclick="event.stopPropagation(); showChatContextMenu(event, '${user}')">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            </button>
        `;
        usersList.appendChild(chatItem);
    });
}

function updateGroupsList(groups = []) {
    // Combine server groups with persistent groups
    const allGroups = {};
    
    // Add persistent groups first
    for (const groupId in persistentGroups) {
        allGroups[groupId] = persistentGroups[groupId];
    }
    
    // Add/update with server groups
    if (groups && groups.length > 0) {
        groups.forEach(group => {
            allGroups[group.id] = group;
        });
    }
    
    // Get all groups we've chatted in (including inactive ones)
    const chattedGroupIds = new Set();
    for (const groupId in chatHistories.group) {
        const messages = chatHistories.group[groupId];
        if (messages.some(msg => msg.sender === username || (msg.members && msg.members.includes(username)))) {
            chattedGroupIds.add(groupId);
        }
    }
    
    // Add ALL persistent groups (even if no messages yet)
    for (const groupId in persistentGroups) {
        const group = persistentGroups[groupId];
        // Only add if current user is a member
        if (group.members && group.members.includes(username)) {
            chattedGroupIds.add(groupId);
        }
    }
    
    // Add current active groups (if not already in chattedGroupIds)
    const userGroups = groups.filter(g => g.members && g.members.includes(username));
    userGroups.forEach(group => {
        chattedGroupIds.add(group.id);
    });
    
    const groupIds = Array.from(chattedGroupIds);
    groupsList.innerHTML = '';
    if (groupIds.length === 0) {
        noGroupsMsg.style.display = 'block';
        return;
    }
    noGroupsMsg.style.display = 'none';
    groupIds.forEach(groupId => {
        // Try to find group info from server groups first
        let groupInfo = userGroups.find(g => g.id === groupId);
        
        // If not found in server groups, check persistent groups
        if (!groupInfo && allGroups[groupId]) {
            groupInfo = allGroups[groupId];
        }
        
        // Fallback if still not found
        if (!groupInfo) {
            groupInfo = {
                id: groupId,
                name: `Group ${groupId.substring(0, 8)}`,
                members: []
            };
        }
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.groupId = groupInfo.id;
        chatItem.onclick = () => switchToGroupChat(groupInfo.id, groupInfo.name);
        // Get last message for this group
        const lastMessage = chatHistories.group[groupInfo.id]?.slice(-1)[0];
        const lastMsgText = lastMessage ? lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? '...' : '') : 'No messages yet';
        chatItem.innerHTML = `
            <div class="chat-avatar">👥</div>
            <div class="chat-info">
                <div class="chat-name">${groupInfo.name}
                    <span class="unread-count" style="display: none; background: #2ecc71; color: white; padding: 2px 6px; border-radius: 10px; font-size: 12px; margin-left: 8px;">0</span>
                </div>
                <div class="chat-last-msg">${lastMsgText}</div>
            </div>
        `;
        groupsList.appendChild(chatItem);
    });
}

// ===== CHAT SWITCHING =====
function addToRecentChats(user) {
    if (!recentChats.includes(user)) {
        recentChats.unshift(user);
        if (recentChats.length > 5) recentChats.pop();
        displayRecentChats();
    }
}

function displayRecentChats() {
    chatsDisplay.innerHTML = '';
    recentChats.forEach(user => {
        const pill = document.createElement('div');
        pill.className = 'chat-pill';
        pill.textContent = user;
        pill.onclick = () => switchToPrivateChat(user);
        chatsDisplay.appendChild(pill);
    });
}

async function switchToPrivateChat(user) {
    // Clean up viewed state for chats with no unread messages when leaving
    cleanupViewedChats();
    
    currentChatType = 'private';
    currentChatTarget = user;
    chatHeaderName.textContent = user;
    chatHeaderStatus.textContent = 'Private Chat';
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.chat-item[data-user="${user}"]`)?.classList.add('active');
    globalNetworkItem.classList.remove('active');
    addToRecentChats(user);
    
    // Track this chat switch to prevent immediate re-render
    lastChatSwitchTime = Date.now();
    lastChatSwitchTarget = user;
    
    // Consolidate private chat history for this user
    const history = [];
    for (const key in chatHistories.private) {
        let userA, userB;
        try {
            if (key.startsWith('[')) {
                const arr = JSON.parse(key.replace(/'/g, '"'));
                userA = arr[0];
                userB = arr[1];
            } else {
                [userA, userB] = key.split('_');
            }
        } catch {
            [userA, userB] = key.split('_');
        }
        if ((userA === user && userB === username) || (userA === username && userB === user)) {
            chatHistories.private[key].forEach(msg => {
                history.push(msg);
            });
        }
    }
    
    // Store consolidated history
    chatHistories.private[user] = history;
    
    // Render (will use last seen index to show divider)
    renderCurrentChat(false);
    
    // Clear unread count and update last seen AFTER rendering
    clearUnreadForCurrentChat();
    
    // Then request updated history from server
    await eel.send_message('request_private_history', '', {target_user: user})();
    await eel.set_current_chat('private', user)();
}

async function switchToGroupChat(groupId, groupName) {
    // Clean up viewed state for chats with no unread messages when leaving
    cleanupViewedChats();
    
    currentChatType = 'group';
    currentChatTarget = groupId;
    chatHeaderName.textContent = groupName;
    chatHeaderStatus.textContent = 'Group Chat';
    
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.chat-item[data-group-id="${groupId}"]`)?.classList.add('active');
    globalNetworkItem.classList.remove('active');
    
    // Track this chat switch to prevent immediate re-render
    lastChatSwitchTime = Date.now();
    lastChatSwitchTarget = groupId;
    
    // Render (will use last seen index to show divider)
    renderCurrentChat(false);
    
    // Clear unread count and update last seen AFTER rendering
    clearUnreadForCurrentChat();
    
    // Then request updated history from server
    await eel.send_message('request_group_history', '', {group_id: groupId})();
    await eel.set_current_chat('group', groupId)();
}

globalNetworkItem.addEventListener('click', async function() {
    // Clean up viewed state for chats with no unread messages when leaving
    cleanupViewedChats();
    
    currentChatType = 'global';
    currentChatTarget = null;
    chatHeaderName.textContent = 'Global Network';
    chatHeaderStatus.textContent = 'Secure broadcast channel';
    
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    this.classList.add('active');
    
    // Track this chat switch
    lastChatSwitchTime = Date.now();
    lastChatSwitchTarget = 'global';
    
    // Render (will use last seen index to show divider)
    renderCurrentChat(false);
    
    // Clear unread count and update last seen AFTER rendering
    clearUnreadForCurrentChat();
    
    // Then request updated history from server
    await eel.send_message('request_chat_history', '', {})();
    await eel.set_current_chat('global', null)();
});

// ===== VIDEO CALL =====
videoCallBtn.addEventListener('click', async () => {
    if (!currentChatType) {
        showNotification('Select a chat first', 'warning');
        return;
    }
    
    // Validate that we have the required chat target for non-global calls
    if (currentChatType === 'private' && !currentChatTarget) {
        showNotification('Please select a user for private video call', 'warning');
        return;
    }
    
    if (currentChatType === 'group' && !currentChatTarget) {
        showNotification('Please select a group for group video call', 'warning');
        return;
    }
    
    // Determine chat ID to pass to video server
    let chatId;
    if (currentChatType === 'global') {
        chatId = 'global';
    } else if (currentChatType === 'private' || currentChatType === 'group') {
        chatId = currentChatTarget;
    } else {
        showNotification('Invalid chat type', 'error');
        return;
    }
    
    const chatTypeDisplay = currentChatType === 'global' ? 'Global Network' : 
                           currentChatType === 'private' ? `Private chat with ${currentChatTarget}` :
                           `Group chat`;
    
    if (!confirm(`Start video call in ${chatTypeDisplay}?`)) {
        return;
    }
    
    console.log(`[VIDEO] Starting ${currentChatType} video call with chat_id: ${chatId}`);
    
    try {
        const result = await eel.start_video_call(currentChatType, chatId)();
        
        if (result.success) {
            // Open video call window
            window.open(`${result.link}?username=${encodeURIComponent(username)}`, 'video_call', 'width=1200,height=800');
            showNotification('Video call started!', 'success');
        } else {
            showNotification(`Failed to start call: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('[VIDEO] Error starting video call:', error);
        showNotification('Error starting video call', 'error');
    }
});

// ===== FILE HANDLING =====
filesToggleBtn.addEventListener('click', () => filesPanel.classList.toggle('active'));
closeFilesBtn.addEventListener('click', () => filesPanel.classList.remove('active'));
uploadFileBtn.addEventListener('click', () => fileInput.click());
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
        
        const uint8Array = new Uint8Array(fileData);
        let base64Data = '';
        const chunkSize = 8192;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            base64Data += String.fromCharCode.apply(null, chunk);
        }
        
        base64Data = btoa(base64Data);
        const result = await eel.upload_file(file.name, file.size, base64Data)();
        
        if (result.success) {
            showNotification(`✓ Uploaded: ${result.file_name}`, 'success');
            
            if (currentChatType === 'private' && currentChatTarget) {
                await eel.send_message('private_file', '', {
                    receiver: currentChatTarget,
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_size: file.size
                })();
            } else if (currentChatType === 'group' && currentChatTarget) {
                await eel.send_message('group_file', '', {
                    group_id: currentChatTarget,
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_size: file.size
                })();
            } else {
                await eel.send_message('file_share', '', {
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_size: file.size
                })();
            }
        } else {
            showNotification(`✗ Upload failed: ${result.message}`, 'error');
        }
    } catch (error) {
        showNotification('Upload error: ' + error, 'error');
    }
    fileInput.value = '';
});

function addFileToList(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const infoSection = document.createElement('div');
    infoSection.className = 'file-info-section';
    infoSection.innerHTML = `
        <div class="file-name">${file.file_name || file.name}</div>
        <div class="file-detail">${formatFileSize(file.size || file.file_size)} • ${file.sender}</div>
    `;
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'file-download-btn';
    downloadBtn.textContent = 'Download';
    downloadBtn.onclick = () => downloadFile(file);
    
    fileItem.appendChild(infoSection);
    fileItem.appendChild(downloadBtn);
    filesList.appendChild(fileItem);
}

// Audio Recording functionality
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingDuration = 0;

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecording = true;
        recordingDuration = 0;

        // Create and show the recording UI
        const recordingUI = document.createElement('div');
        recordingUI.id = 'recordingUI';
        recordingUI.innerHTML = `
            <div style="
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #8B0000, #000000);
                padding: 15px 25px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 15px;
                box-shadow: 0 4px 20px rgba(139, 0, 0, 0.5);
                z-index: 1000;
            ">
                <div style="
                    width: 12px;
                    height: 12px;
                    background: #FF4500;
                    border-radius: 50%;
                    animation: pulse 1s infinite;
                "></div>
                <span id="recordingTime" style="
                    color: white;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 16px;
                    min-width: 50px;
                ">0:00</span>
                <button id="stopRecording" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 6px;
                    padding: 8px 15px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s;
                    font-family: 'Rajdhani', sans-serif;
                ">Stop Recording</button>
            </div>
        `;
        document.body.appendChild(recordingUI);

        // Update the timer
        recordingTimer = setInterval(() => {
            recordingDuration++;
            const minutes = Math.floor(recordingDuration / 60);
            const seconds = recordingDuration % 60;
            document.getElementById('recordingTime').textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        // Handle the recording
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            showAudioPreview(audioBlob);
        };

        document.getElementById('stopRecording').onclick = stopRecording;
        mediaRecorder.start();

    } catch (error) {
        console.error('Error starting recording:', error);
        showNotification('Could not start recording', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        clearInterval(recordingTimer);
        document.getElementById('recordingUI')?.remove();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

function showAudioPreview(audioBlob) {
    const previewUI = document.createElement('div');
    previewUI.id = 'audioPreview';
    previewUI.innerHTML = `
        <div style="
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #8B0000, #000000);
            padding: 20px;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            box-shadow: 0 4px 20px rgba(139, 0, 0, 0.5);
            z-index: 1000;
        ">
            <audio id="audioPreviewPlayer" controls style="
                width: 250px;
                height: 40px;
                border-radius: 20px;
            "></audio>
            <div style="
                display: flex;
                gap: 10px;
            ">
                <button id="discardAudio" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 6px;
                    padding: 8px 15px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s;
                    font-family: 'Rajdhani', sans-serif;
                ">Discard</button>
                <button id="sendAudio" style="
                    background: linear-gradient(135deg, #FF4500, #8B0000);
                    border: none;
                    border-radius: 6px;
                    padding: 8px 15px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s;
                    font-family: 'Rajdhani', sans-serif;
                ">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(previewUI);

    // Set up the audio preview
    const audioURL = URL.createObjectURL(audioBlob);
    const audioPlayer = document.getElementById('audioPreviewPlayer');
    audioPlayer.src = audioURL;
    audioPlayer.style.background = 'rgba(255, 255, 255, 0.1)';

    // Handle buttons
    document.getElementById('discardAudio').onclick = () => {
        previewUI.remove();
        URL.revokeObjectURL(audioURL);
    };

    document.getElementById('sendAudio').onclick = async () => {
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            
            try {
                // Send the audio message based on current chat type
                if (currentChatType === 'private' && currentChatTarget) {
                    await eel.send_message('private_audio', '', {
                        receiver: currentChatTarget,
                        audio_data: base64Audio,
                        duration: recordingDuration
                    })();
                } else if (currentChatType === 'group' && currentChatTarget) {
                    await eel.send_message('group_audio', '', {
                        group_id: currentChatTarget,
                        audio_data: base64Audio,
                        duration: recordingDuration
                    })();
                } else {
                    await eel.send_message('audio_message', '', {
                        audio_data: base64Audio,
                        duration: recordingDuration
                    })();
                }
                
                showNotification('Audio message sent', 'success');
            } catch (error) {
                console.error('Error sending audio:', error);
                showNotification('Failed to send audio message', 'error');
            }
            
            previewUI.remove();
            URL.revokeObjectURL(audioURL);
        };
        reader.readAsDataURL(audioBlob);
    };
}

// Add keyboard shortcuts for recording
// Add audio record button
if (audioRecordBtn) {
    audioRecordBtn.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
        }
    });
}

// Original download file function
async function downloadFile(file) {
    try {
        const result = await eel.download_file(file.file_id)();
        if (result.success) {
            showNotification('Downloaded', 'success');
        } else {
            showNotification('Download failed', 'error');
        }
    } catch (error) {
        showNotification('Download error', 'error');
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ===== GROUP CREATION =====
newGroupBtn.addEventListener('click', async () => {
    // Get latest user list first
    try {
        const result = await eel.get_user_list()();
        if (result.success && result.users) {
            const otherUsers = result.users.filter(u => u !== username);
            if (otherUsers.length === 0) {
                showNotification('No other users online', 'warning');
                return;
            }
            showGroupModal(otherUsers);
        } else {
            showNotification('Failed to get user list', 'error');
        }
    } catch (error) {
        console.error('Error getting user list:', error);
        showNotification('Error getting user list', 'error');
    }
});

function showGroupModal(users) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    modalContent.innerHTML = `
        <div class="modal-title">Create New Group</div>
        <div class="form-group">
            <label>Group Name</label>
            <input type="text" id="groupNameInput" placeholder="Enter group name">
        </div>
        <div class="admin-selector">
            <label>Group Admin</label>
            <select id="adminSelect">
                <option value="${username}">${username} (You)</option>
                ${users.map(u => `<option value="${u}">${u}</option>`).join('')}
            </select>
        </div>
        <div style="margin-bottom: 16px;">
            <label style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; display: block; margin-bottom: 10px;">Select Members</label>
            <div class="user-select-list">
                ${users.map(user => `
                    <div class="user-checkbox">
                        <input type="checkbox" value="${user}" id="user_${user}">
                        <label for="user_${user}">${user}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="modal-buttons">
            <button class="modal-btn cancel" id="cancelBtn">Cancel</button>
            <button class="modal-btn create" id="createBtn">Create Group</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    document.getElementById('cancelBtn').onclick = () => modal.remove();
    
    document.getElementById('createBtn').onclick = async () => {
        const groupName = document.getElementById('groupNameInput').value.trim();
        const admin = document.getElementById('adminSelect').value;
        const checkboxes = document.querySelectorAll('.user-select-list input[type="checkbox"]:checked');
        const members = Array.from(checkboxes).map(cb => cb.value);
        
        if (!groupName) {
            showNotification('Enter group name', 'warning');
            return;
        }
        if (members.length === 0) {
            showNotification('Select at least one member', 'warning');
            return;
        }
        
        members.push(admin);
        const uniqueMembers = [...new Set(members)];
        
        // Generate a unique group ID
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Save group to persistent storage
        persistentGroups[groupId] = {
            id: groupId,
            name: groupName,
            members: uniqueMembers,
            admin: admin,
            created_at: new Date().toISOString()
        };
        localStorage.setItem('persistentGroups', JSON.stringify(persistentGroups));
        
        await eel.send_message('group_create', `Created group: ${groupName}`, {
            group_id: groupId,
            group_name: groupName,
            members: uniqueMembers,
            admin: admin
        })();
        
        modal.remove();
        showNotification(`Group "${groupName}" created`, 'success');
        
        // Update groups list immediately
        updateGroupsList();
    };
}

// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`.tab-content[data-tab="${tab}"]`).classList.add('active');
    });
});

refreshUsersBtn.addEventListener('click', () => {
    eel.refresh_user_list()();
});




// ===== DATA POLLING =====
let pollingInterval = null;

// Function to refresh chat data
function refreshChatData(force = false) {
    console.log('===== REFRESHING CHAT DATA =====');
    
    // Store current scroll position before refreshing
    const wasAtBottom = isAtBottom();
    const scrollPosition = messagesContainer.scrollTop;
    
    // Show loading indicator
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    // Request fresh data from server
    const promises = [
        eel.get_chat_history()().catch(err => {
            console.error('Failed to fetch chat history:', err);
            return { success: false };
        }),
        eel.get_user_list()().catch(err => {
            console.error('Failed to fetch user list:', err);
            return { success: false };
        })
    ];
    
    Promise.all(promises).then(([chatResult, userResult]) => {
        // Process chat history
        if (chatResult.success && chatResult.messages) {
            const oldLength = chatHistories.global.length;
            const hasNewMessages = chatResult.messages.length > oldLength;
            
            // Only update if forced or there are new messages
            if (force || hasNewMessages) {
                // Get deleted messages from localStorage
                const deletedMessages = JSON.parse(localStorage.getItem('deletedMessages') || '{}');
                
                // Filter out deleted messages
                const filteredMessages = chatResult.messages.filter(msg => {
                    return !deletedMessages[msg.id || msg.timestamp];
                });
                
                chatHistories.global = filteredMessages;
                
                // Only re-render if we're in the global chat
                if (currentChatType === 'global') {
                    renderCurrentChat(!wasAtBottom);
                    
                    // Restore scroll position if needed
                    if (!wasAtBottom) {
                        messagesContainer.scrollTop = scrollPosition;
                    }
                }
                
                if (hasNewMessages) {
                    showNotification(`Loaded ${filteredMessages.length - oldLength} new messages`, 'info');
                }
            }
        }
        
        // Process user list
        if (userResult.success && userResult.users) {
            updateUsersList(userResult.users);
        }
        
        // Reset refresh button
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
        
        // Show success message if this was a manual refresh
        if (force) {
            showNotification('Chat refreshed', 'success');
        }
    });
}

// Main polling function
function pollForData() {
    console.log('===== STARTING POLLING =====');
    
    // Initial refresh
    refreshChatData();
    
    // Set up periodic polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    // Poll every 10 seconds, but only if tab is active
    pollingInterval = setInterval(() => {
        if (!document.hidden) {
            refreshChatData();
        }
    }, 10000);
    
    // Also poll when tab becomes visible
    const handleVisibilityChange = () => {
        if (!document.hidden) {
            refreshChatData();
        }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Return cleanup function
    return () => {
        if (pollingInterval) clearInterval(pollingInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('===== STOPPED POLLING =====');
    }
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', function() {
    // Clean disconnect when closing
    stopPolling();
    if (typeof eel !== 'undefined') {
        eel.disconnect();
    }
});

// ===== SETTINGS =====
document.addEventListener('DOMContentLoaded', function() {
    // Open settings modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            settingsModal.style.display = 'flex';
            console.log('Settings modal opened');
        });
    }
    
    // Close settings modal
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            settingsModal.style.display = 'none';
            console.log('Settings modal closed');
        });
    }
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
    
    // Theme switching
    themeOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const theme = this.dataset.theme;
            
            console.log('Theme option clicked:', theme);
            
            // Remove active class from all options
            themeOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            this.classList.add('active');
            
            // Apply theme
            if (theme === 'alt') {
                document.body.classList.add('theme-alt');
                localStorage.setItem('theme', 'alt');
                console.log('Applied alt theme');
            } else {
                document.body.classList.remove('theme-alt');
                localStorage.setItem('theme', 'default');
                console.log('Applied default theme');
            }
        });
    });
    
    // Load saved theme on page load
    const savedTheme = localStorage.getItem('theme');
    console.log('Saved theme:', savedTheme);
    
    if (savedTheme === 'alt') {
        document.body.classList.add('theme-alt');
        const altOption = document.querySelector('[data-theme="alt"]');
        const defaultOption = document.querySelector('[data-theme="default"]');
        if (altOption) altOption.classList.add('active');
        if (defaultOption) defaultOption.classList.remove('active');
        console.log('Loaded alt theme from storage');
    }
    
    // Settings toggles
    // Remove duplicate variable declarations in DOMContentLoaded
    // notificationsToggle, soundsToggle, onlineStatusToggle are already declared above
    
    if (notificationsToggle) {
        if (localStorage.getItem('notifications') === 'false') {
            notificationsToggle.checked = false;
        }
        
        notificationsToggle.addEventListener('change', function() {
            localStorage.setItem('notifications', this.checked);
            console.log('Notifications:', this.checked);
        });
    }
    
    if (soundsToggle) {
        if (localStorage.getItem('sounds') === 'false') {
            soundsToggle.checked = false;
        }
        
        soundsToggle.addEventListener('change', function() {
            localStorage.setItem('sounds', this.checked);
            console.log('Sounds:', this.checked);
        });
    }
    
    if (onlineStatusToggle) {
        if (localStorage.getItem('onlineStatus') === 'false') {
            onlineStatusToggle.checked = false;
        }
        
        onlineStatusToggle.addEventListener('change', function() {
            localStorage.setItem('onlineStatus', this.checked);
            console.log('Online status:', this.checked);
        });
    }
});

// ===== UTILITY FUNCTIONS =====
eel.expose(onDisconnected);
function onDisconnected() {
    showNotification('Disconnected', 'error');
    setTimeout(() => {
        mainApp.classList.remove('active');
        connectionScreen.classList.add('active');
        connectBtn.disabled = false;
        connectBtn.textContent = 'CONNECT';
    }, 2000);
}

// Handle user connection alerts
eel.expose(onUserConnected);
function onUserConnected(connectedUser) {
    if (connectedUser && connectedUser !== username) {
        showConnectionAlert(`${connectedUser} connected`, 'connected');
    }
}

// Handle user disconnection alerts
eel.expose(onUserDisconnected);
function onUserDisconnected(disconnectedUser) {
    if (disconnectedUser && disconnectedUser !== username) {
        showConnectionAlert(`${disconnectedUser} disconnected`, 'disconnected');
    }
}

eel.expose(showError);
function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    const colors = {
        success: '#2d7a3e',
        error: '#8b0000',
        warning: '#8b6c00',
        info: '#b30000'
    };
    
    const notification = document.createElement('div');
    const chatHeader = document.querySelector('.chat-header');
    
    if (!chatHeader) {
        console.error('Chat header not found for notification positioning');
        return;
    }
    
    notification.style.cssText = `
        position: absolute;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        background: var(--bg-secondary);
        border: 1px solid ${colors[type]};
        border-radius: 6px;
        padding: 12px 20px;
        color: ${colors[type]};
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        font-family: 'Rajdhani', sans-serif;
        max-width: 350px;
    `;
    notification.textContent = message;
    chatHeader.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function showConnectionAlert(message, type = 'connected') {
    const colors = {
        connected: '#2ecc71',
        disconnected: '#e74c3c'
    };
    
    // Find the chat-header element
    const chatHeader = document.querySelector('.chat-header');
    if (!chatHeader) return;
    
    const alert = document.createElement('div');
    alert.style.cssText = `
        position: absolute;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        background: var(--bg-secondary);
        border: 2px solid ${colors[type]};
        border-radius: 8px;
        padding: 10px 16px;
        color: ${colors[type]};
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 100;
        animation: slideInRight 0.4s ease;
        font-family: 'Rajdhani', sans-serif;
        max-width: 250px;
        display: flex;
        align-items: center;
        gap: 8px;
        letter-spacing: 0.5px;
    `;
    
    // Add icon based on type
    const icon = document.createElement('span');
    icon.style.cssText = `
        font-size: 16px;
        flex-shrink: 0;
    `;
    icon.textContent = type === 'connected' ? '✓' : '✕';
    
    const text = document.createElement('span');
    text.textContent = message;
    
    alert.appendChild(icon);
    alert.appendChild(text);
    chatHeader.appendChild(alert);
    
    setTimeout(() => {
        alert.style.animation = 'slideOutRight 0.4s ease';
        setTimeout(() => alert.remove(), 400);
    }, 4000);
}

function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
}

function getCurrentChatMessages() {
    if (currentChatType === 'global') {
        return chatHistories.global || [];
    } else if (currentChatType === 'private' && currentChatTarget) {
        return chatHistories[currentChatTarget] || [];
    } else if (currentChatType === 'group' && currentChatTarget) {
        return chatHistories.groups?.[currentChatTarget] || [];
    }
    return [];
}

// ===== CONTEXT MENUS =====
function showChatContextMenu(event, user) {
    const menu = document.getElementById('chatContextMenu');
    
    // Calculate menu position
    const menuHeight = 150; // Approximate height
    const menuWidth = 180; // Approximate width
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    
    let posX = event.pageX;
    let posY = event.pageY;
    
    // Check if menu would go off bottom of screen
    if (posY + menuHeight > windowHeight - 20) {
        posY = windowHeight - menuHeight - 20;
    }
    
    // Check if menu would go off right side of screen
    if (posX + menuWidth > windowWidth - 20) {
        posX = windowWidth - menuWidth - 20;
    }
    
    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.classList.add('show');
    menu.dataset.user = user;
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

function showMessageContextMenu(event, messageElement) {
    event.preventDefault();
    event.stopPropagation();
    
    // Hide any existing context menus
    document.querySelectorAll('.context-menu').forEach(menu => {
        menu.classList.remove('show');
    });
    
    const menu = document.getElementById('messageContextMenu');
    if (!menu) return;
    
    // Calculate menu position
    const menuHeight = 300; // Approximate height of context menu
    const menuWidth = 200; // Approximate width
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    
    let posX = event.pageX;
    let posY = event.pageY;
    
    // Check if menu would go off bottom of screen
    if (posY + menuHeight > windowHeight - 20) {
        posY = windowHeight - menuHeight - 20;
    }
    
    // Check if menu would go off right side of screen
    if (posX + menuWidth > windowWidth - 20) {
        posX = windowWidth - menuWidth - 20;
    }
    
    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.classList.add('show');
    menu.dataset.messageId = messageElement.dataset.messageId;
    
    // Close menu when clicking outside - with proper delay
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.remove('show');
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 100);
}

// Handle context menu actions
document.addEventListener('click', (e) => {
    if (e.target.closest('.context-menu-item')) {
        const action = e.target.closest('.context-menu-item').dataset.action;
        const menu = e.target.closest('.context-menu');
        
        if (menu.id === 'chatContextMenu') {
            handleChatContextAction(action, menu.dataset.user);
        } else if (menu.id === 'messageContextMenu') {
            handleMessageContextAction(action, menu.dataset.messageId);
        }
        
        menu.classList.remove('show');
    }
});

function handleChatContextAction(action, user) {
    switch (action) {
        case 'archive':
            archiveChat(user);
            break;
        case 'delete-chat':
            deleteChat(user);
            break;
    }
}

function handleMessageContextAction(action, messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    switch (action) {
        case 'reply':
            replyToMessage(messageElement);
            break;
        case 'copy':
            copyMessage(messageElement);
            break;
        case 'forward':
            forwardMessage(messageElement);
            break;
        case 'star':
            starMessage(messageElement);
            break;
        case 'pin':
            pinMessage(messageElement);
            break;
        case 'delete':
            deleteMessage(messageElement);
            break;
        case 'select':
            selectMessage(messageElement);
            break;
        case 'share':
            shareMessage(messageElement);
            break;
    }
}

// Context menu action implementations
function archiveChat(user) {
    if (confirm(`Archive chat with ${user}?`)) {
        // Store archived state
        const chatKey = Object.keys(chatHistories.private).find(key => 
            key.includes(user) && key.includes(username)
        );
        
        if (chatKey) {
            localStorage.setItem(`archived_${chatKey}`, 'true');
            // Hide the chat item
            const chatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
            if (chatItem) {
                chatItem.style.opacity = '0.5';
            }
            showNotification(`Chat with ${user} archived`, 'success');
        }
    }
}

function deleteChat(user) {
    if (confirm(`Delete chat with ${user}? This action cannot be undone.`)) {
        // Find the correct chat key
        const chatKey = Object.keys(chatHistories.private).find(key => 
            key.includes(user) && key.includes(username)
        );
        
        if (chatKey) {
            delete chatHistories.private[chatKey];
            // Remove from localStorage
            localStorage.removeItem(`archived_${chatKey}`);
            // Remove chat item from UI
            const chatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
            if (chatItem) {
                chatItem.remove();
            }
            // If this was the current chat, switch to global
            if (currentChatType === 'private' && currentChatTarget === user) {
                globalNetworkItem.click();
            }
            showNotification(`Chat with ${user} deleted`, 'success');
        }
    }
}

function replyToMessage(messageElement) {
    const messageBubble = messageElement.querySelector('.message-bubble');
    if (!messageBubble) return;
    
    // Get message content, handling different message types
    let messageText = '';
    if (messageBubble.querySelector('.file-item')) {
        messageText = '📎 File';
    } else if (messageBubble.querySelector('.audio-item')) {
        messageText = '🎵 Audio';
    } else {
        messageText = messageBubble.textContent.trim();
    }
    
    const sender = messageElement.dataset.sender || messageElement.querySelector('.message-sender')?.textContent || 'User';
    const messageId = messageElement.dataset.messageId;
    
    if (!messageText || !messageId) return;
    
    // Create reply preview
    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.innerHTML = `
        <div class="reply-preview-content">
            <div class="reply-preview-header">
                <span class="reply-sender">${sender}</span>
                <button class="reply-remove-btn">×</button>
            </div>
            <div class="reply-message" title="${messageText.replace(/"/g, '&quot;')}">
                ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}
            </div>
        </div>
    `;
    
    // Get or create reply container
    let replyContainer = document.querySelector('.reply-container');
    if (!replyContainer) {
        replyContainer = document.createElement('div');
        replyContainer.className = 'reply-container';
        const inputContainer = document.querySelector('.message-input-container');
        inputContainer.parentNode.insertBefore(replyContainer, inputContainer);
    } else {
        replyContainer.innerHTML = ''; // Clear any existing reply
    }
    
    // Add reply preview
    replyContainer.appendChild(replyPreview);
    replyContainer.style.display = 'block';
    
    // Store original message info for reference
    replyContainer.dataset.replyTo = messageId;
    replyContainer.dataset.originalSender = sender;
    replyContainer.dataset.originalText = messageText;
    
    // Focus the input
    const messageInput = document.getElementById('messageInput');
    messageInput.focus();
    
    // Handle remove reply
    const removeBtn = replyPreview.querySelector('.reply-remove-btn');
    removeBtn.onclick = () => {
        replyContainer.style.display = 'none';
        replyContainer.dataset.replyTo = '';
        sendBtn.textContent = 'Send';
        
        // Restore original send handler
        if (window.originalSendHandler) {
            sendBtn.onclick = window.originalSendHandler;
        }
    };
    
    // Store original send handler if not already stored
    if (!window.originalSendHandler) {
        window.originalSendHandler = sendBtn.onclick;
    }
    
    // Update send button to handle replies
    sendBtn.onclick = async function() {
        const replyText = messageInput.value.trim();
        if (!replyText) return;
        
        try {
            // Send the message through the existing send flow with full reply metadata
            const metadata = {
                replyTo: {
                    id: messageId,
                    sender: sender,
                    text: messageText.substring(0, 100)
                }
            };
            
            if (currentChatType === 'private' && currentChatTarget) {
                await eel.send_message('private', replyText, {
                    receiver: currentChatTarget,
                    metadata: metadata
                })();
            } else if (currentChatType === 'group' && currentChatTarget) {
                await eel.send_message('group_message', replyText, {
                    group_id: currentChatTarget,
                    metadata: metadata
                })();
            } else {
                await eel.send_message('chat', replyText, {
                    metadata: metadata
                })();
            }
            
            // Clear input and reply preview
            messageInput.value = '';
            replyContainer.style.display = 'none';
            replyContainer.dataset.replyTo = '';
            
            // Restore original send handler and button text
            sendBtn.onclick = window.originalSendHandler;
            sendBtn.textContent = 'Send';
        } catch (error) {
            console.error('Error sending reply:', error);
            showNotification('Error sending reply', 'error');
        }
    };
    
    // Update send button text
    sendBtn.textContent = 'Send Reply';
}

function copyMessage(messageElement) {
    const messageText = messageElement.querySelector('.message-bubble')?.textContent;
    if (messageText) {
        navigator.clipboard.writeText(messageText).then(() => {
            showNotification('Message copied to clipboard', 'success');
        }).catch(() => {
            // Fallback for clipboard API failure
            const textArea = document.createElement('textarea');
            textArea.value = messageText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Message copied to clipboard', 'success');
        });
    }
}

function forwardMessage(messageElement) {
    const messageText = messageElement.querySelector('.message-bubble')?.textContent;
    if (!messageText) return;
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    
    // Get list of users to forward to
    const users = [];
    Object.keys(chatHistories.private).forEach(key => {
        const otherUser = key.split('_').find(u => u !== username);
        if (otherUser && !users.includes(otherUser)) {
            users.push(otherUser);
        }
    });
    
    dialog.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <h3>Forward Message To</h3>
            <div class="modal-message">${messageText}</div>
            <div class="user-select-list">
                ${users.length > 0 ? users.map(user => `
                    <div class="user-forward-option" data-user="${user}">
                        <span>${user}</span>
                    </div>
                `).join('') : '<p style="text-align: center; color: var(--text-dim); padding: 20px;">No users available</p>'}
            </div>
            <div class="modal-buttons">
                <button class="modal-btn cancel">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Handle forward selection
    dialog.querySelectorAll('.user-forward-option').forEach(option => {
        option.onclick = async () => {
            const targetUser = option.dataset.user;
            try {
                await eel.send_message('private', `📩 Forwarded: ${messageText}`, {receiver: targetUser})();
                dialog.remove();
                showNotification(`Message forwarded to ${targetUser}`, 'success');
            } catch (error) {
                showNotification('Failed to forward message', 'error');
            }
        };
    });
    
    dialog.querySelector('.cancel').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
}

function starMessage(messageElement) {
    const messageId = messageElement.dataset.messageId;
    const isStarred = messageElement.classList.toggle('starred');
    
    // Add star icon if not exists
    let starIcon = messageElement.querySelector('.star-icon');
    if (!starIcon && isStarred) {
        starIcon = document.createElement('span');
        starIcon.className = 'star-icon';
        starIcon.innerHTML = '⭐';
        starIcon.style.position = 'absolute';
        starIcon.style.right = '4px';
        starIcon.style.top = '4px';
        starIcon.style.fontSize = '12px';
        messageElement.appendChild(starIcon);
    } else if (starIcon && !isStarred) {
        starIcon.remove();
    }
    
    // Store starred state
    const starredMessages = JSON.parse(localStorage.getItem('starredMessages') || '{}');
    if (isStarred) {
        starredMessages[messageId] = true;
    } else {
        delete starredMessages[messageId];
    }
    localStorage.setItem('starredMessages', JSON.stringify(starredMessages));
    
    showNotification(isStarred ? 'Message starred' : 'Message unstarred', 'success');
}

function pinMessage(messageElement) {
    const messageText = messageElement.querySelector('.message-bubble')?.textContent;
    const messageId = messageElement.dataset.messageId;
    const isPinned = messageElement.classList.contains('pinned');
    
    if (!isPinned) {
        // Show pin confirmation modal
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3>📌 Pin Message</h3>
                <div class="modal-message">${messageText}</div>
                <p style="color: var(--text-dim); font-size: 14px; margin: 10px 0;">This message will be pinned to the top of the chat.</p>
                <div class="modal-buttons">
                    <button class="modal-btn cancel">Cancel</button>
                    <button class="modal-btn primary">Pin</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        dialog.querySelector('.primary').onclick = () => {
            messageElement.classList.add('pinned');
            
            // Add pin icon
            let pinIcon = messageElement.querySelector('.pin-icon');
            if (!pinIcon) {
                pinIcon = document.createElement('span');
                pinIcon.className = 'pin-icon';
                pinIcon.innerHTML = '📌';
                pinIcon.style.position = 'absolute';
                pinIcon.style.right = '8px';
                pinIcon.style.top = '8px';
                pinIcon.style.fontSize = '14px';
                messageElement.appendChild(pinIcon);
            }
            
            // Store pinned state
            const pinnedMessages = JSON.parse(localStorage.getItem('pinnedMessages') || '{}');
            pinnedMessages[messageId] = true;
            localStorage.setItem('pinnedMessages', JSON.stringify(pinnedMessages));
            
            dialog.remove();
            showNotification('Message pinned', 'success');
        };
        
        dialog.querySelector('.cancel').onclick = () => dialog.remove();
        dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
    } else {
        // Unpin
        messageElement.classList.remove('pinned');
        const pinIcon = messageElement.querySelector('.pin-icon');
        if (pinIcon) pinIcon.remove();
        
        const pinnedMessages = JSON.parse(localStorage.getItem('pinnedMessages') || '{}');
        delete pinnedMessages[messageId];
        localStorage.setItem('pinnedMessages', JSON.stringify(pinnedMessages));
        
        showNotification('Message unpinned', 'success');
    }
}

async function deleteMessage(messageElement) {
    const messageBubble = messageElement.querySelector('.message-bubble');
    if (!messageBubble) return;
    
    const messageText = messageBubble.textContent;
    const messageId = messageElement.dataset.messageId;
    const isOwnMessage = messageElement.classList.contains('own');
    const sender = messageElement.dataset.sender || 'User';
    
    // Show delete confirmation modal with different options based on message ownership
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    
    if (isOwnMessage) {
        // Own message - can delete for everyone
        dialog.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3>🗑️ Delete Message</h3>
                <div class="modal-message" style="max-height: 200px; overflow-y: auto; padding: 10px; background: var(--bg-deep); border-radius: 4px; margin: 10px 0;">
                    ${messageText}
                </div>
                <p style="color: var(--text-dim); font-size: 14px; margin: 10px 0;">
                    This message will be permanently deleted for everyone. This action cannot be undone.
                </p>
                <div class="modal-buttons" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button class="modal-btn cancel" style="padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border-main); border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                    <button class="modal-btn danger" style="padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Delete for Everyone
                    </button>
                </div>
            </div>
        `;
    } else {
        // Others' message - can only remove from own chat
        dialog.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3>🗑️ Remove Message</h3>
                <div class="modal-message" style="max-height: 200px; overflow-y: auto; padding: 10px; background: var(--bg-deep); border-radius: 4px; margin: 10px 0;">
                    <div style="font-size: 12px; color: var(--accent-cyan); margin-bottom: 5px;">From: ${sender}</div>
                    ${messageText}
                </div>
                <p style="color: var(--text-dim); font-size: 14px; margin: 10px 0;">
                    This message will be removed from your chat only. Other users will still see it.
                </p>
                <div class="modal-buttons" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button class="modal-btn cancel" style="padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border-main); border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                    <button class="modal-btn danger" style="padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Remove from Chat
                    </button>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(dialog);
    
    // Handle delete action
    dialog.querySelector('.danger').onclick = async () => {
        if (isOwnMessage) {
            // Permanent delete for own messages
            try {
                const result = await eel.delete_message(messageId, currentChatType, currentChatTarget)();
                
                if (result && result.success) {
                    // Mark as deleted in the UI
                    messageElement.classList.add('deleted');
                    
                    // Replace message content with "Message deleted"
                    const bubble = messageElement.querySelector('.message-bubble');
                    if (bubble) {
                        bubble.innerHTML = '<span class="message-deleted" style="font-style: italic; opacity: 0.7;">🚫 This message was deleted</span>';
                    }
                    
                    // Remove interactive elements
                    const menuBtn = messageElement.querySelector('.message-menu-btn');
                    if (menuBtn) menuBtn.remove();
                    
                    // Mark as deleted in localStorage to prevent reappearance
                    const deletedMessages = JSON.parse(localStorage.getItem('deletedMessages') || '{}');
                    deletedMessages[messageId] = true;
                    localStorage.setItem('deletedMessages', JSON.stringify(deletedMessages));
                    
                    dialog.remove();
                    showNotification('Message deleted for everyone', 'success');
                } else {
                    showNotification('Failed to delete message', 'error');
                }
            } catch (error) {
                console.error('Delete error:', error);
                showNotification('Failed to delete message', 'error');
                dialog.remove();
            }
        } else {
            // Local removal for others' messages
            try {
                // Mark as deleted in localStorage to prevent reappearance
                const deletedMessages = JSON.parse(localStorage.getItem('deletedMessages') || '{}');
                deletedMessages[messageId] = {
                    id: messageId,
                    timestamp: Date.now(),
                    sender: sender,
                    chatType: currentChatType,
                    chatTarget: currentChatTarget
                };
                localStorage.setItem('deletedMessages', JSON.stringify(deletedMessages));
                
                // Remove from DOM with a fade-out animation
                messageElement.style.transition = 'opacity 0.3s ease';
                messageElement.style.opacity = '0';
                
                // Wait for the animation to complete before removing from DOM
                setTimeout(() => {
                    messageElement.remove();
                    showNotification('Message removed from your chat', 'success');
                }, 300);
                
                dialog.remove();
            } catch (error) {
                console.error('Error removing message:', error);
                showNotification('Failed to remove message', 'error');
                dialog.remove();
            }
        }
    };
    
    // Handle cancel action
    const cancelBtn = dialog.querySelector('.cancel');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            dialog.style.opacity = '0';
            setTimeout(() => dialog.remove(), 200);
        };
    }
    
    // Close on overlay click
    dialog.onclick = (e) => {
        if (e.target === dialog) {
            dialog.style.opacity = '0';
            setTimeout(() => dialog.remove(), 200);
        }
    };
}

function selectMessage(messageElement) {
    messageElement.classList.toggle('selected');
    showNotification('Message selected', 'info');
}

function shareMessage(messageElement) {
    const messageText = messageElement.querySelector('.message-bubble').textContent;
    if (navigator.share) {
        navigator.share({
            title: 'Shared Message',
            text: messageText
        });
    } else {
        navigator.clipboard.writeText(messageText).then(() => {
            showNotification('Message copied to clipboard', 'success');
        });
    }
}

// ===== EMOJI PICKER =====
function showEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.classList.add('show');
}

function hideEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.classList.remove('show');
}

function insertEmoji(emoji) {
    const messageInput = document.getElementById('messageInput');
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(messageInput.selectionEnd);
    
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();
    messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    
    hideEmojiPicker();
}

// ===== SEARCH FUNCTIONALITY =====
function searchMessages(query) {
    if (!query.trim()) {
        renderCurrentChat();
        return;
    }
    
    const currentMessages = getCurrentChatMessages();
    const filteredMessages = currentMessages.filter(message => 
        message.content.toLowerCase().includes(query.toLowerCase()) ||
        message.sender.toLowerCase().includes(query.toLowerCase())
    );
    
    renderSearchResults(filteredMessages, query);
}

function renderSearchResults(messages, query) {
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-dim);">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <div style="font-size: 18px; margin-bottom: 8px;">No results found</div>
                <div style="font-size: 14px;">No messages match "${query}"</div>
            </div>
        `;
        messagesContainer.appendChild(noResults);
        return;
    }
    
    messages.forEach(message => {
        const messageDiv = addMessage(message);
        // Highlight search terms
        highlightSearchTerms(messageDiv, query);
    });
}

function highlightSearchTerms(messageElement, query) {
    const messageBubble = messageElement.querySelector('.message-bubble');
    if (messageBubble) {
        const text = messageBubble.textContent;
        const highlightedText = text.replace(
            new RegExp(query, 'gi'),
            `<mark style="background: var(--accent-cyan); color: var(--bg-deep); padding: 2px 4px; border-radius: 3px;">$&</mark>`
        );
        messageBubble.innerHTML = highlightedText;
    }
}

// Function to reset polling interval on user activity
function resetPollingInterval() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollInterval = 5000; // Reset to initial interval
        pollingInterval = setInterval(() => {
            if (!document.hidden) {
                eel.send_message('request_chat_history', '', {})();
                eel.refresh_user_list()();
            }
        }, pollInterval);
    }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    // Load persistent groups on startup
    console.log('===== LOADING PERSISTENT GROUPS ON STARTUP =====');
    updateGroupsList();
    
    // Connect refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            refreshChatData(true); // Force refresh
        });
    }
    
    // Add keyboard shortcut for refresh (Ctrl+R)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            refreshChatData(true); // Force refresh
        }
    });
    
    // Reset polling on user activity
    ['click', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetPollingInterval, { passive: true });
    });
    
    // Reset polling when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            resetPollingInterval();
            // Re-check video call states when tab becomes visible
            restoreVideoCallStates();
        }
    });

    // Emoji picker
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const closeEmojiBtn = document.getElementById('closeEmojiBtn');
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', showEmojiPicker);
    }
    
    if (closeEmojiBtn) {
        closeEmojiBtn.addEventListener('click', hideEmojiPicker);
    }
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
            hideEmojiPicker();
        }
    });
    
    // Emoji selection
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('emoji')) {
            const emoji = e.target.dataset.emoji;
            insertEmoji(emoji);
        }
    });
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchMessages(e.target.value);
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchMessages(e.target.value);
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchMessages(searchInput.value);
        });
    }
    
    // Add message menu buttons to existing messages
    addMessageMenuButtons();
});

function addMessageMenuButtons() {
    const messages = document.querySelectorAll('.message');
    messages.forEach((message, index) => {
        if (!message.querySelector('.message-menu-btn')) {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'message-menu-btn';
            menuBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            `;
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                message.dataset.messageId = `msg_${Date.now()}_${index}`;
                showMessageContextMenu(e, message);
            };
            message.appendChild(menuBtn);
        }
    });
}

console.log('Shadow Nexus initialized');