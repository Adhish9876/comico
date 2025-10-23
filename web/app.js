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

// Store unread counts
const unreadCounts = {
    global: 0,
    private: {},  // username -> count
    group: {},    // groupId -> count
    total: 0
};


// Clear unread count for current chat
function clearUnreadForCurrentChat() {
    if (currentChatType === 'global') {
        unreadCounts.global = 0;
    } else if (currentChatType === 'private' && currentChatTarget) {
        unreadCounts.private[currentChatTarget] = 0;
    } else if (currentChatType === 'group' && currentChatTarget) {
        unreadCounts.group[currentChatTarget] = 0;
    }
    updateTotalUnreadCount();
    updateUnreadCountsUI();
    
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
                
                renderCurrentChat();
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
    else if (msgType === 'chat_history') {
        console.log('===== PROCESSING CHAT HISTORY =====');
        console.log('Received messages:', message.messages?.length || 0);
        chatHistories.global = message.messages || [];
        console.log('Stored in chatHistories.global:', chatHistories.global.length);
        console.log('Current chat type:', currentChatType);
        if (isViewingGlobal) {
            console.log('Rendering global chat...');
            renderCurrentChat();
        } else {
            console.log('Not in global chat, not rendering yet');
        }
    }
    else if (msgType === 'private_history') {
        // Server may send the field as 'receiver' or 'target_user' depending on source
        const targetUser = message.target_user || message.receiver || message.target || message.user;
        if (targetUser) {
            chatHistories.private[targetUser] = message.messages || [];
            if (currentChatType === 'private' && currentChatTarget === targetUser) {
                renderCurrentChat();
            }
        } else {
            console.log('WARN: private_history received without target user', message);
        }
    }
    else if (msgType === 'group_history') {
        const groupId = message.group_id;
        chatHistories.group[groupId] = message.messages || [];
        if (currentChatType === 'group' && currentChatTarget === groupId) {
            renderCurrentChat();
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
        handleVideoMissed(message);
    }
}

function renderCurrentChat(preserveScroll = true) {
    console.log('===== RENDERING CURRENT CHAT =====');
    console.log('Chat type:', currentChatType);
    console.log('Global history length:', chatHistories.global.length);
    console.log('Global history:', chatHistories.global);
    
    // Store current scroll position and check if we're at bottom
    const wasAtBottom = isAtBottom();
    const scrollPosition = messagesContainer.scrollTop;
    
    messagesContainer.innerHTML = '';
    
    if (currentChatType === 'global') {
        chatHistories.global.forEach(msg => {
            if (msg.type === 'video_invite') {
                handleVideoInvite(msg);
            } else {
                addMessage(msg, false); // Don't auto-scroll for each message
            }
        });
    } else if (currentChatType === 'private' && currentChatTarget) {
        const history = chatHistories.private[currentChatTarget] || [];
        history.forEach(msg => {
            if (msg.type === 'video_invite_private') {
                handleVideoInvite(msg);
            } else {
                addMessage(msg);
                if (msg.type === 'private_file') {
                    addFileToList(msg);
                }
            }
        });
    } else if (currentChatType === 'group' && currentChatTarget) {
        const history = chatHistories.group[currentChatTarget] || [];
        history.forEach(msg => {
            if (msg.type === 'video_invite_group') {
                handleVideoInvite(msg);
            } else {
                addMessage(msg);
                if (msg.type === 'group_file') {
                    addFileToList(msg);
                }
            }
        });
    }
}

// Helper function to check if scroll is at bottom
function isAtBottom() {
    const threshold = 50; // pixels from bottom to consider "at bottom"
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= threshold;
}

function addMessage(message, autoScroll = true) {
    const isOwn = message.sender === username;
    const messageDiv = document.createElement('div');
    messageDiv.className = isOwn ? 'message own' : 'message';
    messageDiv.style.position = 'relative';
    
    // Show menu button on hover
    messageDiv.addEventListener('mouseenter', () => {
        const menuBtn = messageDiv.querySelector('.message-menu-btn');
        if (menuBtn) menuBtn.style.opacity = '1';
    });
    
    messageDiv.addEventListener('mouseleave', () => {
        const menuBtn = messageDiv.querySelector('.message-menu-btn');
        if (menuBtn) menuBtn.style.opacity = '0';
    });
    
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
    
    if (!isOwn) {
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const sender = document.createElement('span');
        sender.className = 'message-sender';
        sender.textContent = message.sender;
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = message.timestamp || getCurrentTime();
        
        header.appendChild(sender);
        header.appendChild(time);
        content.appendChild(header);
    }
    
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
    }
    
    // Add message menu button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'message-menu-btn';
    // Position menu button based on message owner
    const menuPosition = isOwn ? 'left: -24px;' : 'right: -24px;';
    menuBtn.style.cssText = `
        position: absolute; 
        ${menuPosition}
        top: 50%; 
        transform: translateY(-50%); 
        opacity: 0; 
        transition: opacity 0.2s;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        z-index: 2;
    `;
    menuBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
    `;
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        messageDiv.dataset.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        showMessageContextMenu(e, messageDiv);
    };
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messageDiv.appendChild(menuBtn);
    
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



function handleVideoInvite(message) {
    const { sender, link, session_id } = message;
    console.log('[VIDEO] Handling video invite from', sender);
    const isMissed = message.is_missed || false;
    const missedTime = message.missed_at || '';
    const videoMessage = document.createElement('div');
    if (session_id) videoMessage.dataset.sessionId = session_id;

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
                   background: #6b4646; 
                   border: 1px solid #7a5252; 
                   border-radius: 6px; 
                   padding: 10px 12px; 
                   color: #e8e4e4; 
                   font-weight: 500; 
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
                   box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);"
            onmouseover="this.style.background='#7a5252'; this.style.borderColor='#8a6060';"
            onmouseout="this.style.background='#6b4646'; this.style.borderColor='#7a5252';">
        <span style="filter: grayscale(20%) brightness(0.9);">🎥</span>
        <span>Join Video Call</span>
    </button>
</div>


        `;
    }
    messagesContainer.appendChild(videoMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleVideoMissed(message) {
    const sessionId = message.session_id;
    const timestamp = message.timestamp || getCurrentTime();
    if (!sessionId) return;

    console.log('[VIDEO] Handling missed call for session:', sessionId);

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

function addSystemMessage(content) {
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
    console.log('===== UPDATING USER LIST =====');
    console.log('Received users:', users);
    console.log('Current username:', username);
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

function updateGroupsList(groups) {
    // Get all groups we've chatted in (including inactive ones)
    const chattedGroupIds = new Set();
    for (const groupId in chatHistories.group) {
        const messages = chatHistories.group[groupId];
        if (messages.some(msg => msg.sender === username || (msg.members && msg.members.includes(username)))) {
            chattedGroupIds.add(groupId);
        }
    }
    // Add current active groups (if not already in chattedGroupIds)
    const userGroups = groups.filter(g => g.members.includes(username));
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
        let groupInfo = userGroups.find(g => g.id === groupId);
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
    currentChatType = 'private';
    currentChatTarget = user;
    chatHeaderName.textContent = user;
    chatHeaderStatus.textContent = 'Private Chat';
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.chat-item[data-user="${user}"]`)?.classList.add('active');
    globalNetworkItem.classList.remove('active');
    addToRecentChats(user);
    // Render local history first
    // Only show messages where current user is sender or receiver and other user is the selected user
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
    messagesContainer.innerHTML = '';
    history.forEach(msg => addMessage(msg));
    // Then request updated history from server
    await eel.send_message('request_private_history', '', {target_user: user})();
    await eel.set_current_chat('private', user)();
    clearUnreadForCurrentChat();
}

async function switchToGroupChat(groupId, groupName) {
    currentChatType = 'group';
    currentChatTarget = groupId;
    chatHeaderName.textContent = groupName;
    chatHeaderStatus.textContent = 'Group Chat';
    
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.chat-item[data-group-id="${groupId}"]`)?.classList.add('active');
    globalNetworkItem.classList.remove('active');
    
    // Render local history first
    renderCurrentChat();
    
    // Then request updated history from server
    await eel.send_message('request_group_history', '', {group_id: groupId})();
    await eel.set_current_chat('group', groupId)();
    clearUnreadForCurrentChat();
}

globalNetworkItem.addEventListener('click', async function() {
    currentChatType = 'global';
    currentChatTarget = null;
    chatHeaderName.textContent = 'Global Network';
    chatHeaderStatus.textContent = 'Secure broadcast channel';
    
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    this.classList.add('active');
    
    // Render local history first
    renderCurrentChat();
    
    // Then request updated history from server
    await eel.send_message('request_chat_history', '', {})();
    await eel.set_current_chat('global', null)();
    clearUnreadForCurrentChat();
});

// ===== VIDEO CALL =====
videoCallBtn.addEventListener('click', async () => {
    if (!currentChatType) {
        showNotification('Select a chat first', 'warning');
        return;
    }
    
    const chatTypeDisplay = currentChatType === 'global' ? 'Global Network' : 
                           currentChatType === 'private' ? `Private chat with ${currentChatTarget}` :
                           `Group chat`;
    
    if (!confirm(`Start video call in ${chatTypeDisplay}?`)) {
        return;
    }
    
    try {
        const result = await eel.start_video_call(currentChatType, currentChatTarget || 'global')();
        
        if (result.success) {
            // Open video call window
            window.open(`${result.link}?username=${encodeURIComponent(username)}`, 'video_call', 'width=1200,height=800');
            showNotification('Video call started!', 'success');
        } else {
            showNotification(`Failed to start call: ${result.error}`, 'error');
        }
    } catch (error) {
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
        
        await eel.send_message('group_create', `Created group: ${groupName}`, {
            group_name: groupName,
            members: uniqueMembers,
            admin: admin
        })();
        
        modal.remove();
        showNotification(`Group created`, 'success');
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

function pollForData() {
    console.log('===== POLLING FOR DATA =====');
    
    // Store current scroll position before polling
    const wasAtBottom = isAtBottom();
    const scrollPosition = messagesContainer.scrollTop;
    
    // Request chat history from server
    eel.send_message('request_chat_history', '', {})();
    
    // Request user list from server
    eel.refresh_user_list()();
    
    // Also try to get data directly from client
    setTimeout(() => {
        console.log('===== GETTING DATA DIRECTLY =====');
        eel.get_chat_history()().then(result => {
            console.log('Direct chat history result:', result);
            if (result.success && result.messages && result.messages.length > 0) {
                console.log('Got chat history directly:', result.messages.length, 'messages');
                const oldLength = chatHistories.global.length;
                chatHistories.global = result.messages;
                
                // Only force scroll if new messages arrived and we were at bottom
                const forceScroll = wasAtBottom && result.messages.length > oldLength;
                renderCurrentChat(!forceScroll);
                
                // Restore scroll position if we weren't at bottom
                if (!forceScroll) {
                    messagesContainer.scrollTop = scrollPosition;
                }
            }
        }).catch(err => {
            console.log('Direct chat history failed:', err);
        });
        
        eel.get_user_list()().then(result => {
            console.log('Direct user list result:', result);
            if (result.success && result.users) {
                console.log('Got user list directly:', result.users.length, 'users');
                updateUsersList(result.users);
            }
        }).catch(err => {
            console.log('Direct user list failed:', err);
        });
    }, 1000);
    
    // Set up periodic polling with exponential backoff
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    let pollInterval = 5000; // Start with 5 seconds
    const maxInterval = 15000; // Max interval of 15 seconds
    
    pollingInterval = setInterval(() => {
        console.log('===== PERIODIC POLL =====');
        
        // Only poll if the tab is visible
        if (!document.hidden) {
            eel.send_message('request_chat_history', '', {})();
            eel.refresh_user_list()();
            
            // Increase polling interval gradually
            if (pollInterval < maxInterval) {
                clearInterval(pollingInterval);
                pollInterval = Math.min(pollInterval * 1.5, maxInterval);
                pollingInterval = setInterval(arguments.callee, pollInterval);
            }
        }
        
        // Also get data directly
        eel.get_chat_history()().then(result => {
            if (result.success && result.messages && result.messages.length > 0) {
                const wasAtBottom = isAtBottom();
                const scrollPosition = messagesContainer.scrollTop;
                const oldLength = chatHistories.global.length;
                chatHistories.global = result.messages;
                
                // Only force scroll if new messages arrived and we were at bottom
                const forceScroll = wasAtBottom && result.messages.length > oldLength;
                renderCurrentChat(!forceScroll);
                
                // Restore scroll position if we weren't at bottom
                if (!forceScroll) {
                    messagesContainer.scrollTop = scrollPosition;
                }
            }
        }).catch(err => {
            console.log('Periodic chat history failed:', err);
        });
        
        eel.get_user_list()().then(result => {
            if (result.success && result.users) {
                updateUsersList(result.users);
            }
        }).catch(err => {
            console.log('Periodic user list failed:', err);
        });
    }, 3000); // Poll every 3 seconds
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
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: var(--bg-secondary);
        border: 1px solid ${colors[type]};
        border-radius: 6px;
        padding: 12px 20px;
        color: ${colors[type]};
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-family: 'Rajdhani', sans-serif;
        max-width: 350px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
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
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
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
    const menu = document.getElementById('messageContextMenu');
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.classList.add('show');
    menu.dataset.messageId = messageElement.dataset.messageId;
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
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
    const messageText = messageElement.querySelector('.message-bubble').textContent;
    const messageInput = document.getElementById('messageInput');
    messageInput.value = `Replying to: ${messageText}`;
    messageInput.focus();
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
    if (messageText) {
        // Create forward dialog
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.innerHTML = `
            <div class="modal-content" style="width: 300px;">
                <h3>Forward Message</h3>
                <div class="user-select-list" style="max-height: 200px; overflow-y: auto;">
                    ${Object.keys(chatHistories.private).map(key => {
                        const otherUser = key.split('_').find(u => u !== username);
                        return `
                            <div class="user-forward-option" data-user="${otherUser}">
                                <span>${otherUser}</span>
                            </div>
                        `;
                    }).join('')}
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
                await eel.send_message('private', messageText, {receiver: targetUser})();
                dialog.remove();
                showNotification('Message forwarded', 'success');
            };
        });
        
        // Handle cancel
        dialog.querySelector('.cancel').onclick = () => dialog.remove();
    }
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
    const messageId = messageElement.dataset.messageId;
    const isPinned = messageElement.classList.toggle('pinned');
    
    // Add pin icon if not exists
    let pinIcon = messageElement.querySelector('.pin-icon');
    if (!pinIcon && isPinned) {
        pinIcon = document.createElement('span');
        pinIcon.className = 'pin-icon';
        pinIcon.innerHTML = '📌';
        pinIcon.style.position = 'absolute';
        pinIcon.style.left = '-20px';
        pinIcon.style.top = '50%';
        pinIcon.style.transform = 'translateY(-50%)';
        pinIcon.style.fontSize = '14px';
        messageElement.appendChild(pinIcon);
        
        // Move pinned message to top
        messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
    } else if (pinIcon && !isPinned) {
        pinIcon.remove();
    }
    
    // Store pinned state
    const pinnedMessages = JSON.parse(localStorage.getItem('pinnedMessages') || '{}');
    if (isPinned) {
        pinnedMessages[messageId] = true;
    } else {
        delete pinnedMessages[messageId];
    }
    localStorage.setItem('pinnedMessages', JSON.stringify(pinnedMessages));
    
    showNotification(isPinned ? 'Message pinned' : 'Message unpinned', 'success');
}

function deleteMessage(messageElement) {
    if (confirm('Delete this message? This action cannot be undone.')) {
        // Fade out animation
        messageElement.style.transition = 'opacity 0.3s, transform 0.3s';
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            messageElement.remove();
            showNotification('Message deleted', 'success');
        }, 300);
    }
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
    // Reset polling on user activity
    ['click', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetPollingInterval, { passive: true });
    });
    
    // Reset polling when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            resetPollingInterval();
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