// SIMPLE REPLY SYSTEM - No Preview, Just Send with Reply Data
// This approach skips the preview and focuses on the final result

// Simple reply state
let currentReply = null;

function simpleReplyToMessage(messageElement) {
    // Get message details
    const messageBubble = messageElement.querySelector('.message-bubble');
    if (!messageBubble) return;
    
    let messageText = '';
    if (messageBubble.querySelector('.file-item')) {
        messageText = '📎 File';
    } else if (messageBubble.querySelector('.audio-item')) {
        messageText = '🎵 Audio';
    } else {
        messageText = messageBubble.textContent.trim();
    }
    
    const sender = messageElement.dataset.sender || messageElement.querySelector('.message-sender')?.textContent || 'User';
    const messageId = messageElement.dataset.messageId || Date.now().toString();
    
    if (!messageText) return;
    
    // Store reply info (no preview needed)
    currentReply = {
        id: messageId,
        sender: sender,
        text: messageText
    };
    
    // Focus input and show simple indicator
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    messageInput.focus();
    messageInput.placeholder = `Replying to ${sender}: ${messageText.substring(0, 50)}...`;
    sendBtn.textContent = 'Send Reply';
    sendBtn.style.background = '#009688'; // WhatsApp green
    
    // Show notification
    showNotification(`Replying to ${sender}`, 'info');
}

function cancelReply() {
    currentReply = null;
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    messageInput.placeholder = 'Type your message...';
    sendBtn.textContent = 'Send';
    sendBtn.style.background = ''; // Reset
}

// Override the send message function to include reply data
function sendMessageWithReply() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    // Prepare message data
    let messageData = {
        content: messageText
    };
    
    // Add reply metadata if replying
    if (currentReply) {
        messageData.metadata = {
            replyTo: currentReply
        };
    }
    
    // Send based on current chat type
    if (currentChatType === 'private' && currentChatTarget) {
        eel.send_message('private', messageText, {
            receiver: currentChatTarget,
            metadata: currentReply ? { replyTo: currentReply } : undefined
        })();
    } else if (currentChatType === 'group' && currentChatTarget) {
        eel.send_message('group_message', messageText, {
            group_id: currentChatTarget,
            metadata: currentReply ? { replyTo: currentReply } : undefined
        })();
    } else {
        eel.send_message('chat', messageText, {
            metadata: currentReply ? { replyTo: currentReply } : undefined
        })();
    }
    
    // Clear input and reply state
    messageInput.value = '';
    cancelReply();
    
    showNotification('Message sent!', 'success');
}

// Enhanced message display with reply headers
function addReplyHeader(messageDiv, replyInfo) {
    const replyHeader = document.createElement('div');
    replyHeader.className = 'whatsapp-reply-header';
    replyHeader.style.cssText = `
        background: rgba(0, 150, 136, 0.1);
        border-left: 4px solid #009688;
        padding: 8px 12px;
        margin-bottom: 8px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s ease;
    `;
    
    replyHeader.innerHTML = `
        <div style="font-weight: 600; color: #009688; margin-bottom: 4px; font-size: 13px;">
            ${replyInfo.sender}
        </div>
        <div style="color: rgba(255, 255, 255, 0.8); font-size: 13px; line-height: 1.3;">
            ${replyInfo.text.substring(0, 100)}${replyInfo.text.length > 100 ? '...' : ''}
        </div>
    `;
    
    // Add hover effect
    replyHeader.addEventListener('mouseenter', () => {
        replyHeader.style.background = 'rgba(0, 150, 136, 0.15)';
    });
    
    replyHeader.addEventListener('mouseleave', () => {
        replyHeader.style.background = 'rgba(0, 150, 136, 0.1)';
    });
    
    // Insert at the beginning of message content
    const messageContent = messageDiv.querySelector('.message-content');
    if (messageContent) {
        messageContent.insertBefore(replyHeader, messageContent.firstChild);
    }
}

// Initialize simple reply system
function initSimpleReplySystem() {
    // Override existing send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.onclick = sendMessageWithReply;
    }
    
    // Add Escape key to cancel reply
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentReply) {
            cancelReply();
        }
    });
    
    console.log('✅ Simple Reply System Initialized');
}

// Export functions for global use
window.simpleReplyToMessage = simpleReplyToMessage;
window.cancelReply = cancelReply;
window.addReplyHeader = addReplyHeader;
window.initSimpleReplySystem = initSimpleReplySystem;
