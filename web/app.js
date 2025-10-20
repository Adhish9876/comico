// Shadow Nexus - Updated Client Logic with Fixed Private File Sharing

let currentChatType = 'global';
let currentChatTarget = null;
let username = '';
let recentChats = [];
let allUsers = [];

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
            userName.textContent = user;
            connectionScreen.classList.remove('active');
            mainApp.classList.add('active');
            showNotification('Connected!', 'success');
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
function handleMessage(message) {
    console.log('===== RAW MESSAGE RECEIVED =====');
    console.log('Message:', message);
    console.log('Current chat type:', currentChatType);
    console.log('Message type:', message.type);
    console.log('================================');
    const msgType = message.type;

    if (msgType === 'chat' && currentChatType === 'global') {
        addMessage(message);
    }
    else if (msgType === 'private') {
        console.log('Private message from', message.sender, 'to', message.receiver);
        const isRelevant = (message.sender === username && currentChatTarget === message.receiver) ||
                           (message.receiver === username && currentChatTarget === message.sender);
        
        if (currentChatType === 'private' && isRelevant) {
            addMessage(message);
        }
        
        if (message.receiver === username) {
            addToRecentChats(message.sender);
        }
    }
    else if (msgType === 'private_file') {
        console.log('Private file from', message.sender, 'to', message.receiver);
        const isRelevant = (message.sender === username && currentChatTarget === message.receiver) ||
                           (message.receiver === username && currentChatTarget === message.sender);
        
        if (currentChatType === 'private' && isRelevant) {
            addMessage(message);
            addFileToList(message);
        }
        
        if (message.receiver === username) {
            addToRecentChats(message.sender);
            showNotification(`${message.sender} shared a file`, 'info');
        }
    }
    else if (msgType === 'group_message') {
        console.log('Processing group message:', message);
        if (currentChatType === 'group' && currentChatTarget === message.group_id) {
            // Allow sender to see their own messages too
            addMessage(message);
        }
    }
    else if (msgType === 'group_file') {
        console.log('Processing group file:', message);
        if (currentChatType === 'group' && currentChatTarget === message.group_id) {
            addMessage(message);
            addFileToList(message);
        }
    }
    else if (msgType === 'system') {
        console.log('Processing system message:', message);
        addSystemMessage(message.content);
    }
    else if (msgType === 'chat_history') {
        console.log('Processing chat history:', message);
        messagesContainer.innerHTML = '';
        message.messages.forEach(msg => addMessage(msg));
    }
    else if (msgType === 'private_history') {
        console.log('Processing private history:', message);
        if (currentChatType === 'private' && currentChatTarget === message.target_user) {
            messagesContainer.innerHTML = '';
            message.messages.forEach(msg => {
                addMessage(msg);
                // Add files to the shared files list
                if (msg.type === 'private_file') {
                    addFileToList(msg);
                }
            });
        }
    }
    else if (msgType === 'group_history') {
        console.log('Processing group history:', message);
        if (currentChatType === 'group' && currentChatTarget === message.group_id) {
            messagesContainer.innerHTML = '';
            message.messages.forEach(msg => {
                addMessage(msg);
                // Add files to the shared files list
                if (msg.type === 'group_file') {
                    addFileToList(msg);
                }
            });
        }
    }
    else if (msgType === 'user_list') {
        console.log('Processing user list update:', message.users);
        updateUsersList(message.users);
    }
    else if (msgType === 'group_list') {
        console.log('Processing group list update:', message);
        updateGroupsList(message.groups);
    }
    else if (msgType === 'file_notification') {
        console.log('Processing file notification:', message);
        console.log('File notification received for:', message.file_name, 'from:', message.sender);
        addFileToList(message);
        // Show file for ALL users (including sender) in ALL chat types
        addMessage({
            type: 'file_share',
            file_id: message.file_id,
            file_name: message.file_name || message.name,
            sender: message.sender,
            size: message.size || message.file_size,
            file_size: message.size || message.file_size,
            timestamp: message.timestamp || getCurrentTime(),
            isOwn: message.sender === username
        });
        console.log('File message added to chat for:', message.file_name);
        if (message.sender !== username) {
            showNotification(`${message.sender} shared a file`, 'info');
        }
    }
    else if (msgType === 'file_metadata') {
        console.log('Processing file metadata:', message);
        message.files.forEach(file => addFileToList(file));
    }
}

function addMessage(message) {
    const isOwn = message.sender === username;
    const messageDiv = document.createElement('div');
    messageDiv.className = isOwn ? 'message own' : 'message';
    
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
    
    // Check if this is a file share message
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
    } else if (message.type !== 'private_file' && message.type !== 'file_share' && message.type !== 'file_notification' && message.type !== 'group_file') {
        // Regular text message
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = message.content;
        content.appendChild(bubble);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
    console.log('updateUsersList called with:', users);
    allUsers = users.filter(u => u !== username);
    usersList.innerHTML = '';
    if (allUsers.length === 0) {
        noUsersMsg.style.display = 'block';
        return;
    }
    noUsersMsg.style.display = 'none';
    allUsers.forEach(user => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.user = user;
        chatItem.onclick = () => switchToPrivateChat(user);
        chatItem.innerHTML = `
            <div class="chat-avatar">👤</div>
            <div class="chat-info">
                <div class="chat-name">${user}</div>
                <div class="chat-last-msg">Available</div>
            </div>
        `;
        usersList.appendChild(chatItem);
    });
}

function updateGroupsList(groups) {
    const userGroups = groups.filter(g => g.members.includes(username));
    groupsList.innerHTML = '';
    
    if (userGroups.length === 0) {
        noGroupsMsg.style.display = 'block';
        return;
    }
    
    noGroupsMsg.style.display = 'none';
    
    userGroups.forEach(group => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.groupId = group.id;
        chatItem.onclick = () => switchToGroupChat(group.id, group.name);
        
        chatItem.innerHTML = `
            <div class="chat-avatar">👥</div>
            <div class="chat-info">
                <div class="chat-name">${group.name}</div>
                <div class="chat-last-msg">${group.members.length} members</div>
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
    messagesContainer.innerHTML = '';
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.chat-item[data-user="${user}"]`)?.classList.add('active');
    globalNetworkItem.classList.remove('active');
    addToRecentChats(user);
    await eel.send_message('request_private_history', '', {target_user: user})();
}

async function switchToGroupChat(groupId, groupName) {
    currentChatType = 'group';
    currentChatTarget = groupId;
    chatHeaderName.textContent = groupName;
    chatHeaderStatus.textContent = 'Group Chat';
    messagesContainer.innerHTML = '';
    
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.chat-item[data-group-id="${groupId}"]`)?.classList.add('active');
    globalNetworkItem.classList.remove('active');
    
    await eel.send_message('request_group_history', '', {group_id: groupId})();
}

globalNetworkItem.addEventListener('click', async function() {
    currentChatType = 'global';
    currentChatTarget = null;
    chatHeaderName.textContent = 'Global Network';
    chatHeaderStatus.textContent = 'Secure broadcast channel';
    messagesContainer.innerHTML = '';
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    this.classList.add('active');
    await eel.send_message('request_chat_history', '', {})();
});

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

// ===== FILES =====
filesToggleBtn.addEventListener('click', () => filesPanel.classList.toggle('active'));
closeFilesBtn.addEventListener('click', () => filesPanel.classList.remove('active'));
uploadFileBtn.addEventListener('click', () => fileInput.click());
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
        console.log('[APP] No file selected');
        return;
    }
    
    console.log('[APP] File selected:', file.name, file.size);
    
    try {
        const fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
        
        // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
        const uint8Array = new Uint8Array(fileData);
        let base64Data = '';
        const chunkSize = 8192; // Process 8KB at a time
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            base64Data += String.fromCharCode.apply(null, chunk);
        }
        
        base64Data = btoa(base64Data);
        console.log('[APP] Uploading file:', file.name, 'Size:', file.size);
        const result = await eel.upload_file(file.name, file.size, base64Data)();
        
        if (result.success) {
            showNotification(`✓ Uploaded: ${result.file_name}`, 'success');
            console.log('[APP] Upload successful:', result);
            
            // Send file to appropriate context based on current chat
            if (currentChatType === 'private' && currentChatTarget) {
                console.log('[APP] Sending to private chat with:', currentChatTarget);
                await eel.send_message('private_file', '', {
                    receiver: currentChatTarget,
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_size: file.size
                })();
            } else if (currentChatType === 'group' && currentChatTarget) {
                console.log('[APP] Sending to group chat:', currentChatTarget);
                await eel.send_message('group_file', '', {
                    group_id: currentChatTarget,
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_size: file.size
                })();
            } else {
                console.log('[APP] Sending to global chat');
                await eel.send_message('file_share', '', {
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_size: file.size
                })();
            }
        } else {
            showNotification(`✗ Upload failed: ${result.message}`, 'error');
            console.log('[APP] Upload error:', result);
        }
    } catch (error) {
        showNotification('Upload error: ' + error, 'error');
        console.error('[APP] Upload exception:', error);
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
    if (allUsers.length === 0) {
        showNotification('No other users online', 'warning');
        return;
    }
    
    showGroupModal(allUsers);
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

refreshUsersBtn.addEventListener('click', () => {
    eel.refresh_user_list()();
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
        top: 80px;
        right: 20px;
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

console.log('Shadow Nexus initialized');