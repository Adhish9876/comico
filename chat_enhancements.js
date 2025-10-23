// Chat Enhancements - Reply, Forward, and Animations
// This file adds reply/forward functionality and smooth animations to the chat app

// Global variables for reply/forward
let replyingTo = null;
let forwardingMessage = null;

// Add reply indicator above message input
function showReplyIndicator(message) {
    const existingIndicator = document.getElementById('replyIndicator');
    if (existingIndicator) existingIndicator.remove();
    
    const replyIndicator = document.createElement('div');
    replyIndicator.id = 'replyIndicator';
    replyIndicator.style.cssText = `
        background: linear-gradient(135deg, #252936, #2d3142);
        border-left: 3px solid #00b8d4;
        padding: 10px 15px;
        margin-bottom: 10px;
        border-radius: 6px;
        position: relative;
        animation: slideDown 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    replyIndicator.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="color: #00b8d4; font-size: 12px; margin-bottom: 4px;">
                    Replying to ${message.sender}
                </div>
                <div style="color: #9199b8; font-size: 14px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${message.content || 'Media message'}
                </div>
            </div>
            <button onclick="cancelReply()" style="
                background: none;
                border: none;
                color: #9199b8;
                cursor: pointer;
                font-size: 20px;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">
                ×
            </button>
        </div>
    `;
    
    const messageInputContainer = messageInput.parentElement;
    messageInputContainer.insertBefore(replyIndicator, messageInputContainer.firstChild);
    
    replyingTo = message;
}

function cancelReply() {
    const indicator = document.getElementById('replyIndicator');
    if (indicator) {
        indicator.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => indicator.remove(), 300);
    }
    replyingTo = null;
}

// Show forward modal
function showForwardModal(message) {
    forwardingMessage = message;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #252936, #1a1d29);
        border: 2px solid #c62828;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        max-height: 500px;
        overflow-y: auto;
        animation: scaleIn 0.3s ease;
        box-shadow: 0 10px 40px rgba(198, 40, 40, 0.3);
    `;
    
    // Get all available recipients
    const recipients = [...allUsers.filter(u => u !== username)];
    const groups = Object.values(persistentGroups);
    
    modalContent.innerHTML = `
        <div style="font-size: 20px; font-weight: bold; color: #e4e7f0; margin-bottom: 20px;">
            Forward Message
        </div>
        <div style="background: #2d3142; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
            <div style="color: #9199b8; font-size: 12px; margin-bottom: 6px;">Message to forward:</div>
            <div style="color: #e4e7f0; font-size: 14px;">
                ${message.content ? message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '') : 'Media message'}
            </div>
        </div>
        <div style="margin-bottom: 16px;">
            <div style="color: #9199b8; font-size: 12px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
                Select Recipients
            </div>
            <div style="max-height: 250px; overflow-y: auto;">
                ${recipients.map(user => `
                    <label style="display: flex; align-items: center; padding: 8px; margin-bottom: 4px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" 
                           onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
                           onmouseout="this.style.background='none'">
                        <input type="checkbox" value="user:${user}" style="margin-right: 10px;">
                        <span style="color: #e4e7f0;">👤 ${user}</span>
                    </label>
                `).join('')}
                ${groups.map(group => `
                    <label style="display: flex; align-items: center; padding: 8px; margin-bottom: 4px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" 
                           onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
                           onmouseout="this.style.background='none'">
                        <input type="checkbox" value="group:${group.id}" style="margin-right: 10px;">
                        <span style="color: #e4e7f0;">👥 ${group.name}</span>
                    </label>
                `).join('')}
            </div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="document.querySelector('.modal-overlay').remove(); forwardingMessage = null;" style="
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e4e7f0;
                padding: 8px 20px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                Cancel
            </button>
            <button onclick="forwardMessage()" style="
                background: linear-gradient(135deg, #c62828, #8b0000);
                border: none;
                color: white;
                padding: 8px 20px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(198, 40, 40, 0.3);
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(198, 40, 40, 0.4)'" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(198, 40, 40, 0.3)'">
                Forward
            </button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.3s ease';
            modalContent.style.animation = 'scaleOut 0.3s ease';
            setTimeout(() => {
                modal.remove();
                forwardingMessage = null;
            }, 300);
        }
    });
}

// Forward the message to selected recipients
async function forwardMessage() {
    const modal = document.querySelector('.modal-overlay');
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        showNotification('Select at least one recipient', 'warning');
        return;
    }
    
    const forwardContent = `[Forwarded]\n${forwardingMessage.content}`;
    
    for (const checkbox of checkboxes) {
        const [type, target] = checkbox.value.split(':');
        
        if (type === 'user') {
            await eel.send_message('private_message', forwardContent, {receiver: target})();
        } else if (type === 'group') {
            await eel.send_message('group_message', forwardContent, {group_id: target})();
        }
    }
    
    showNotification('Message forwarded', 'success');
    modal.remove();
    forwardingMessage = null;
}

// Enhanced message rendering with reply support
function renderMessageWithReply(message) {
    const isOwn = message.sender === username;
    const messageDiv = document.createElement('div');
    messageDiv.className = isOwn ? 'message own' : 'message';
    messageDiv.style.animation = 'fadeInUp 0.3s ease';
    
    // Add reply reference if this is a reply
    if (message.replyTo) {
        const replyRef = document.createElement('div');
        replyRef.style.cssText = `
            background: rgba(0, 184, 212, 0.1);
            border-left: 2px solid #00b8d4;
            padding: 6px 10px;
            margin-bottom: 8px;
            border-radius: 4px;
            font-size: 12px;
            color: #9199b8;
        `;
        replyRef.innerHTML = `
            <div style="color: #00b8d4; margin-bottom: 2px;">${message.replyTo.sender}</div>
            <div>${message.replyTo.content ? message.replyTo.content.substring(0, 50) + '...' : 'Media message'}</div>
        `;
        messageDiv.appendChild(replyRef);
    }
    
    // Add forwarded label if forwarded
    if (message.content && message.content.startsWith('[Forwarded]')) {
        const forwardLabel = document.createElement('div');
        forwardLabel.style.cssText = `
            color: #6b7396;
            font-size: 11px;
            font-style: italic;
            margin-bottom: 4px;
        `;
        forwardLabel.textContent = '↪ Forwarded';
        messageDiv.appendChild(forwardLabel);
        
        // Remove [Forwarded] from content display
        message.content = message.content.replace('[Forwarded]\n', '');
    }
    
    // Rest of message rendering...
    return messageDiv;
}

// Add reply and forward to context menu
function addReplyForwardToMenu(menu, message) {
    const replyOption = document.createElement('div');
    replyOption.className = 'context-menu-item';
    replyOption.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
        </svg>
        Reply
    `;
    replyOption.onclick = () => {
        showReplyIndicator(message);
        menu.remove();
    };
    
    const forwardOption = document.createElement('div');
    forwardOption.className = 'context-menu-item';
    forwardOption.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
        </svg>
        Forward
    `;
    forwardOption.onclick = () => {
        showForwardModal(message);
        menu.remove();
    };
    
    // Insert at the beginning of menu
    menu.insertBefore(forwardOption, menu.firstChild);
    menu.insertBefore(replyOption, menu.firstChild);
}

// CSS Animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes slideDown {
        from { 
            opacity: 0;
            transform: translateY(-20px);
        }
        to { 
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideUp {
        from { 
            opacity: 1;
            transform: translateY(0);
        }
        to { 
            opacity: 0;
            transform: translateY(-20px);
        }
    }
    
    @keyframes scaleIn {
        from { 
            opacity: 0;
            transform: scale(0.8);
        }
        to { 
            opacity: 1;
            transform: scale(1);
        }
    }
    
    @keyframes scaleOut {
        from { 
            opacity: 1;
            transform: scale(1);
        }
        to { 
            opacity: 0;
            transform: scale(0.8);
        }
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Message animations */
    .message {
        animation: fadeInUp 0.3s ease;
        transition: all 0.3s ease;
    }
    
    .message:hover {
        transform: translateX(2px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    /* Button hover effects */
    button {
        transition: all 0.2s ease;
    }
    
    button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    /* Modal animations */
    .modal-overlay {
        animation: fadeIn 0.3s ease;
    }
    
    .modal-content {
        animation: scaleIn 0.3s ease;
    }
    
    /* Smooth transitions for all interactive elements */
    .chat-item, .tab-btn, .theme-option, input, select, textarea {
        transition: all 0.2s ease;
    }
    
    /* Notification animations */
    .notification {
        animation: slideDown 0.3s ease;
    }
    
    /* Loading spinner */
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .spinner {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(animationStyles);

// Override the send button to include reply data
const originalSendMessage = window.sendMessage;
window.sendMessage = async function() {
    const content = messageInput.value.trim();
    if (!content) return;
    
    let messageData = {};
    
    if (replyingTo) {
        messageData.replyTo = {
            sender: replyingTo.sender,
            content: replyingTo.content,
            timestamp: replyingTo.timestamp
        };
    }
    
    if (currentChatType === 'private' && currentChatTarget) {
        await eel.send_message('private_message', content, {
            receiver: currentChatTarget,
            ...messageData
        })();
    } else if (currentChatType === 'group' && currentChatTarget) {
        await eel.send_message('group_message', content, {
            group_id: currentChatTarget,
            ...messageData
        })();
    } else {
        await eel.send_message('chat_message', content, messageData)();
    }
    
    messageInput.value = '';
    cancelReply();
};

console.log('Chat enhancements loaded: Reply, Forward, and Animations enabled');
