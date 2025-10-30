// Shadow Nexus - Complete Fixed Client with Persistent Chat History

let currentChatType = 'global';
let currentChatTarget = null;
let username = '';
let recentChats = [];
let allUsers = [];

// Store all chat histories locally with localStorage persistence
const chatHistories = {
    global: JSON.parse(localStorage.getItem('chatHistories_global') || '[]'),
    private: JSON.parse(localStorage.getItem('chatHistories_private') || '{}'),
    group: JSON.parse(localStorage.getItem('chatHistories_group') || '{}')
};

// Log loaded messages on startup
console.log('🔄 Loaded from localStorage:', {
    globalMessages: chatHistories.global.length,
    privateChats: Object.keys(chatHistories.private).length,
    groupChats: Object.keys(chatHistories.group).length
});

// Test localStorage functionality
try {
    localStorage.setItem('test', 'working');
    const test = localStorage.getItem('test');
    if (test === 'working') {
        console.log('✅ localStorage is working');
        localStorage.removeItem('test');
    } else {
        console.log('❌ localStorage test failed');
    }
} catch (e) {
    console.log('❌ localStorage error:', e);
}

// Function to save chat histories to localStorage
function saveChatHistoriesToStorage() {
    try {
        // Keep only the last 500 messages for global chat to prevent localStorage from growing too large
        if (chatHistories.global.length > 500) {
            chatHistories.global = chatHistories.global.slice(-500);
        }

        localStorage.setItem('chatHistories_global', JSON.stringify(chatHistories.global));
        localStorage.setItem('chatHistories_private', JSON.stringify(chatHistories.private));
        localStorage.setItem('chatHistories_group', JSON.stringify(chatHistories.group));
        console.log('💾 Saved chat histories to localStorage');
    } catch (error) {
        console.error('❌ Error saving chat histories:', error);
    }
}

// Track archived chats (prevent them from appearing in private chats list)
const archivedChats = new Set();

// Load archived chats from localStorage
try {
    const saved = localStorage.getItem('archivedChats');
    if (saved) {
        JSON.parse(saved).forEach(chat => archivedChats.add(chat));
    }
} catch (e) {
    console.log('Could not load archived chats:', e);
}

// Store groups persistently
const persistentGroups = JSON.parse(localStorage.getItem('persistentGroups') || '{}');

// Helper function to save groups to localStorage
function saveGroupsToLocalStorage() {
    try {
        localStorage.setItem('persistentGroups', JSON.stringify(persistentGroups));
        console.log(` Saved ${Object.keys(persistentGroups).length} groups to localStorage`);
    } catch (error) {
        console.error(' Error saving groups to localStorage:', error);
    }
}

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

// Track if we're in a page refresh/reload state
let isPageRefresh = true;

// Track last date to show dividers - reset per chat
var lastMessageDate = null;

// Add a more aggressive message rendering for page refreshes
function ensureMessagesVisible() {
    if (currentChatType === 'global' && chatHistories.global.length > 0 && messagesContainer.children.length === 0) {
        console.log('ENSURE: Messages not visible, forcing render...');
        renderCurrentChat(false);
        return true;
    }
    return false;
}

// Debug function to check chat state
function debugChatState() {
    console.log('=== CHAT DEBUG STATE ===');
    console.log('Current chat type:', currentChatType);
    console.log('Current chat target:', currentChatTarget);
    console.log('Global messages in memory:', chatHistories.global.length);
    console.log('Messages in DOM:', messagesContainer.children.length);
    console.log('localStorage global:', JSON.parse(localStorage.getItem('chatHistories_global') || '[]').length);
    console.log('First few messages:', chatHistories.global.slice(0, 3));
    console.log('========================');
}

// Make debug function available globally for testing
window.debugChatState = debugChatState;

// Debug function to test date functionality
window.testDateFunction = function() {
    console.log('=== TESTING DATE FUNCTION ===');
    
    // Test current timestamp
    const now = new Date();
    const currentTimestamp = now.getFullYear() + '-' + 
        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getDate()).padStart(2, '0') + ' ' +
        now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    
    console.log('Current timestamp:', currentTimestamp);
    console.log('Parsed date:', getDateFromTimestamp(currentTimestamp));
    
    // Test different timestamp formats
    const testTimestamps = [
        '2025-10-28 03:56 PM',
        '03:56 PM',
        '2025-10-28T15:56:00',
        new Date().toISOString()
    ];
    
    testTimestamps.forEach(ts => {
        console.log(`Timestamp: ${ts} -> Date: ${getDateFromTimestamp(ts)}`);
    });
    
    console.log('lastMessageDate variable:', lastMessageDate);
    console.log('========================');
};

// Debug function to manually add a date divider for testing
window.testDateDivider = function() {
    console.log('=== TESTING DATE DIVIDER ===');
    
    const currentDate = getDateFromTimestamp();
    console.log('Current date string:', currentDate);
    
    const dateDivider = document.createElement('div');
    dateDivider.className = 'date-divider';
    dateDivider.textContent = currentDate;
    dateDivider.dataset.date = currentDate;
    dateDivider.style.cssText = 'background: var(--bg-card); border: 2px solid var(--accent-cyan); border-radius: 16px; padding: 10px 20px; font-size: 13px; color: var(--accent-cyan); font-weight: 700; text-align: center; margin: 20px 0; text-transform: uppercase; letter-spacing: 1px; font-family: "Comic Neue", cursive; align-self: center;';
    
    messagesContainer.appendChild(dateDivider);
    console.log('Added test date divider:', dateDivider);
    console.log('========================');
};

// Test function to manually save/load messages
window.testLocalStorage = function () {
    console.log('=== TESTING LOCALSTORAGE ===');

    // Save a test message
    const testMessage = {
        type: 'chat',
        sender: 'TEST',
        content: 'Test message ' + Date.now(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };

    chatHistories.global.push(testMessage);
    saveChatHistoriesToStorage();

    console.log('Saved test message, total messages:', chatHistories.global.length);

    // Try to reload from localStorage
    const reloaded = JSON.parse(localStorage.getItem('chatHistories_global') || '[]');
    console.log('Reloaded from localStorage:', reloaded.length);

    // Render
    if (currentChatType === 'global') {
        renderCurrentChat(false);
    }
};

// Add keyboard shortcut for debugging (Ctrl+Shift+D)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        debugChatState();

        // Also try to force request chat history
        console.log('🔧 Manual chat history request triggered');
        eel.send_message('request_chat_history', '', {})();
    }
});

// ===== FORGOT PASSWORD SYSTEM =====
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const closeForgotPasswordBtn = document.getElementById('closeForgotPasswordBtn');
const submitAnswersBtn = document.getElementById('submitAnswersBtn');
const passwordResetModal = document.getElementById('passwordResetModal');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const rejectionModal = document.getElementById('rejectionModal');

// Forgot password link click
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'flex';

        // Reset form
        document.querySelectorAll('input[name="question1"]').forEach(input => input.checked = false);
        document.querySelectorAll('input[name="question2"]').forEach(input => input.checked = false);
    });
}

// Close forgot password modal
if (closeForgotPasswordBtn) {
    closeForgotPasswordBtn.addEventListener('click', () => {
        forgotPasswordModal.style.display = 'none';
    });
}

// Submit answers
if (submitAnswersBtn) {
    submitAnswersBtn.addEventListener('click', () => {
        const answer1 = document.querySelector('input[name="question1"]:checked')?.value;
        const answer2 = document.querySelector('input[name="question2"]:checked')?.value;

        if (!answer1 || !answer2) {
            showNotification('Please answer both questions!', 'error');
            return;
        }

        // Correct answers: 1)d and 2)b
        if (answer1 === 'd' && answer2 === 'b') {
            // Correct answers - show password reset modal
            forgotPasswordModal.style.animation = 'modalExit 0.3s ease-in forwards';

            setTimeout(() => {
                forgotPasswordModal.style.display = 'none';
                forgotPasswordModal.style.animation = '';

                // Clear the password reset form
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                passwordMatchIndicator.textContent = '';
                passwordMatchIndicator.classList.remove('match', 'no-match');
                resetPasswordBtn.disabled = true;

                // Show password reset modal
                passwordResetModal.style.display = 'flex';
                passwordResetModal.style.animation = 'modalEnter 0.3s ease-out forwards';

                // Focus on new password input
                setTimeout(() => {
                    newPasswordInput.focus();
                }, 100);

                showNotification('✅ Security questions verified! Set your new password.', 'success');
            }, 300);
        } else {
            // Wrong answers - show dramatic rejection
            forgotPasswordModal.style.display = 'none';
            showDramaticRejection();
        }
    });
}

// Real-time password matching validation
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const passwordMatchIndicator = document.getElementById('passwordMatchIndicator');

function checkPasswordMatch() {
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    if (!confirmPass) {
        passwordMatchIndicator.classList.remove('show');
        return;
    }

    passwordMatchIndicator.classList.add('show');

    if (newPass === confirmPass && newPass.length >= 4) {
        passwordMatchIndicator.classList.remove('no-match');
        passwordMatchIndicator.classList.add('match');
        passwordMatchIndicator.textContent = '✓ Passwords match!';
        resetPasswordBtn.disabled = false;
    } else if (newPass === confirmPass && newPass.length < 4) {
        passwordMatchIndicator.classList.remove('match');
        passwordMatchIndicator.classList.add('no-match');
        passwordMatchIndicator.textContent = '✗ Password must be at least 4 characters';
        resetPasswordBtn.disabled = true;
    } else {
        passwordMatchIndicator.classList.remove('match');
        passwordMatchIndicator.classList.add('no-match');
        passwordMatchIndicator.textContent = '✗ Passwords do not match';
        resetPasswordBtn.disabled = true;
    }
}

if (newPasswordInput && confirmPasswordInput) {
    newPasswordInput.addEventListener('input', checkPasswordMatch);
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
}

// Password reset functionality
if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', async () => {
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!newPassword || !confirmPassword) {
            showNotification('Please fill in both password fields!', 'error');
            return;
        }

        if (newPassword.length < 4) {
            showNotification('Password must be at least 4 characters!', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            return;
        }

        try {
            resetPasswordBtn.disabled = true;
            resetPasswordBtn.textContent = '🔄 Resetting...';

            // Call backend to reset password
            const result = await eel.reset_password(newPassword)();

            if (result.success) {
                showNotification('✅ Password reset successfully!', 'success');

                // Smooth transition animation
                passwordResetModal.style.animation = 'modalExit 0.3s ease-in forwards';

                setTimeout(() => {
                    // Close modal and return to login
                    passwordResetModal.style.display = 'none';
                    passwordResetModal.style.animation = '';
                    document.getElementById('forgotPasswordContainer').style.display = 'none';
                    failedLoginAttempts = 0;

                    // Clear password fields
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    passwordMatchIndicator.classList.remove('show');

                    // Focus on password input
                    setTimeout(() => {
                        loginPasswordInput.focus();
                    }, 100);
                }, 300);
            } else {
                showNotification('❌ Failed to reset password: ' + result.message, 'error');
            }
        } catch (error) {
            showNotification('❌ Error resetting password', 'error');
            console.error('Reset password error:', error);
        } finally {
            resetPasswordBtn.disabled = false;
            resetPasswordBtn.textContent = '🚀 Reset Password';
        }
    });
}

// Dramatic rejection function
function showDramaticRejection() {
    rejectionModal.style.display = 'flex';

    let countdown = 3;
    const countdownElement = document.getElementById('countdown');

    const countdownInterval = setInterval(() => {
        countdown--;
        countdownElement.textContent = countdown;

        if (countdown <= 0) {
            clearInterval(countdownInterval);

            // Close the application with multiple fallback methods
            console.log('🚫 Closing application - unauthorized access detected');

            try {
                // Method 1: Try Eel close_application
                if (typeof eel !== 'undefined') {
                    eel.close_application()();
                    console.log('✅ Called eel.close_application()');
                }

                // Method 2: Try to close the window
                setTimeout(() => {
                    try {
                        window.close();
                        console.log('✅ Called window.close()');
                    } catch (e) {
                        console.log('❌ window.close() failed:', e);
                    }
                }, 100);

                // Method 3: Try to navigate away
                setTimeout(() => {
                    try {
                        window.location.href = 'about:blank';
                        console.log('✅ Navigated to about:blank');
                    } catch (e) {
                        console.log('❌ Navigation failed:', e);
                    }
                }, 200);

                // Method 4: Hide the entire app
                setTimeout(() => {
                    try {
                        document.body.style.display = 'none';
                        document.title = 'Access Denied';
                        console.log('✅ Hidden application');
                    } catch (e) {
                        console.log('❌ Hide failed:', e);
                    }
                }, 300);

            } catch (error) {
                console.error('❌ Error during application closure:', error);

                // Final fallback - just hide everything
                document.body.innerHTML = `
                    <div style="
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: #000;
                        color: #ff0000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: 'Comic Neue', cursive;
                        font-size: 24px;
                        z-index: 99999;
                    ">
                        🚫 ACCESS DENIED - APPLICATION TERMINATED 🚫
                    </div>
                `;
            }
        }
    }, 1000);
}

// Close modals when clicking outside
[forgotPasswordModal, passwordResetModal, rejectionModal].forEach(modal => {
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
});

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

// DOM Elements - Auth Screens
const signupScreen = document.getElementById('signupScreen');
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');

// Signup elements
const signupBtn = document.getElementById('signupBtn');
const signupUsernameInput = document.getElementById('signupUsernameInput');
const signupPasswordInput = document.getElementById('signupPasswordInput');

// Login elements
const loginBtn = document.getElementById('loginBtn');
const loginPasswordInput = document.getElementById('loginPasswordInput');
const loginUsername = document.getElementById('loginUsername');
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
const audioCallBtn = document.getElementById('audioCallBtn');
const videoCallBtn = document.getElementById('videoCallBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
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
    } catch (e) { /* noop */ }
}

// ===== AUTHENTICATION FLOW =====
// Helper function to trigger logo spin animation
function spinLogo(screen) {
    const logoIcon = screen.querySelector('.logo-icon');
    if (logoIcon) {
        logoIcon.classList.add('spinning');
        setTimeout(() => {
            logoIcon.classList.remove('spinning');
        }, 1000);
    }
}

// Helper function to show notification
function showNotification(message, type = 'info') {
    const banner = document.createElement('div');

    // Determine colors based on type
    let borderColor, textColor;
    if (type === 'error') {
        borderColor = '#ef5350';  // Red
        textColor = '#ef5350';
    } else if (type === 'success') {
        borderColor = '#66bb6a';  // Green
        textColor = '#66bb6a';
    } else if (type === 'warning' || type === 'offline') {
        borderColor = '#ffa726';  // Orange/Brown
        textColor = '#ffa726';
    } else {
        borderColor = '#00b8d4';  // Cyan (info)
        textColor = '#00b8d4';
    }

    banner.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: transparent;
        color: ${textColor};
        padding: 15px 20px;
        border: 2px solid ${borderColor};
        border-radius: 10px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    `;
    banner.textContent = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3000);
}

// Password visibility toggle functionality
function setupPasswordToggle(toggleBtn, passwordInput) {
    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleBtn.title = isPassword ? 'Hide password' : 'Show password';

        // Toggle active class for rotation animation
        toggleBtn.classList.toggle('active');

        // Update icon (eye vs eye-slash)
        const svg = toggleBtn.querySelector('.eye-icon');
        if (isPassword) {
            // Show eye-slash (password visible)
            svg.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
        } else {
            // Show eye (password hidden)
            svg.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
        }
    });
}

// Check device registration on page load
window.addEventListener('DOMContentLoaded', async () => {
    console.log('[AUTH] Starting app with splash screen...');

    // Force default cyan/pink theme on app launch
    document.body.classList.remove('theme-alt');
    localStorage.setItem('theme', 'default');
    console.log('[AUTH] Forced default cyan/pink theme on launch');

    // Setup password toggle buttons
    const signupPasswordToggle = document.getElementById('signupPasswordToggle');
    const loginPasswordToggle = document.getElementById('loginPasswordToggle');
    setupPasswordToggle(signupPasswordToggle, signupPasswordInput);
    setupPasswordToggle(loginPasswordToggle, loginPasswordInput);

    const splashScreen = document.getElementById('splashScreen');
    const signupScreen = document.getElementById('signupScreen');
    const loginScreen = document.getElementById('loginScreen');

    // Show splash screen briefly, then check registration
    setTimeout(() => {
        console.log('[AUTH] Logo spinning...');
        // Logo spins fast for visual effect
    }, 200);

    // After 1.2s total, check registration and transition (faster)
    setTimeout(async () => {
        console.log('[AUTH] Checking device registration...');

        let targetScreen = signupScreen; // Default to signup

        if (typeof eel !== 'undefined') {
            try {
                const result = await eel.check_device_registration()();
                console.log('[AUTH] Registration check result:', result);

                if (result.is_registered && result.username) {
                    // Device is registered, show login screen
                    console.log('[AUTH] Device registered, will show login screen');
                    loginUsername.textContent = result.username;
                    username = result.username; // Store username globally
                    targetScreen = loginScreen;
                } else {
                    // Device not registered, show signup screen
                    console.log('[AUTH] Device not registered, will show signup screen');
                    targetScreen = signupScreen;
                }
            } catch (error) {
                console.error('[AUTH] Error checking registration:', error);
                // Default to signup on error
                targetScreen = signupScreen;
            }
        } else {
            console.log('[AUTH] Eel not available, showing signup screen');
            targetScreen = signupScreen;
        }

        // Fade out splash screen
        splashScreen.classList.add('fade-out');

        // After fade out completes, show target screen
        setTimeout(() => {
            splashScreen.classList.remove('active', 'fade-out');
            targetScreen.classList.add('active');
            console.log('[AUTH] Transitioned to target screen');
        }, 300); // Match faster fade-out animation

    }, 1200); // Total time: faster at 1.2s
});

// Signup button handler
signupBtn.addEventListener('click', async () => {
    const user = signupUsernameInput.value.trim();
    const password = signupPasswordInput.value.trim();

    if (!user) {
        showNotification('Please enter a username', 'error');
        return;
    }

    if (!password) {
        showNotification('Please enter a password', 'error');
        return;
    }

    if (password.length < 4) {
        showNotification('Password must be at least 4 characters', 'error');
        return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = 'SIGNING UP...';

    try {
        const result = await eel.signup_user(user, password)();

        if (result.success) {
            username = result.username;
            showNotification('Signup successful!', 'success');

            // Spin logo and transition to tutorial
            spinLogo(signupScreen);
            
            setTimeout(() => {
                signupScreen.classList.remove('active');
                document.getElementById('tutorialScreen').classList.add('active');
                
                // Initialize tutorial
                initTutorial();
            }, 1000);
        } else {
            showNotification(result.message, 'error');
            signupBtn.disabled = false;
            signupBtn.textContent = 'SIGN UP';
        }
    } catch (error) {
        showNotification('Signup failed', 'error');
        signupBtn.disabled = false;
        signupBtn.textContent = 'SIGN UP';
    }
});

// Track failed login attempts
let failedLoginAttempts = 0;

// Login button handler
loginBtn.addEventListener('click', async () => {
    const password = loginPasswordInput.value.trim();
    const host = hostInput.value.trim() || 'localhost';
    const port = parseInt(portInput.value.trim() || '5555');

    if (!password) {
        showNotification('Please enter your password', 'error');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'VERIFYING...';

    try {
        // First verify password
        const authResult = await eel.login_user(password)();

        if (!authResult.success) {
            failedLoginAttempts++;

            // Show specific error message for wrong password
            const errorMsg = authResult.message === 'Incorrect password'
                ? '❌ Wrong Password! Please try again.'
                : authResult.message;
            showNotification(errorMsg, 'error');

            // Shake animation on password input
            loginPasswordInput.style.animation = 'shake 0.6s, errorPulse 1s';
            setTimeout(() => {
                loginPasswordInput.style.animation = '';
            }, 1000);

            // Add error class for visual feedback
            loginPasswordInput.classList.add('error-state');
            setTimeout(() => {
                loginPasswordInput.classList.remove('error-state');
            }, 1000);

            // Show forgot password option after 2 failed attempts
            if (failedLoginAttempts >= 2) {
                document.getElementById('forgotPasswordContainer').style.display = 'block';
                showNotification('🔐 Forgot your password? Click the link below!', 'info');
            }

            // Clear password field
            loginPasswordInput.value = '';
            loginPasswordInput.focus();

            loginBtn.disabled = false;
            loginBtn.textContent = 'CONNECT';
            return;
        }

        // Reset failed attempts on successful login
        failedLoginAttempts = 0;

        username = authResult.username;
        loginBtn.textContent = 'CONNECTING...';

        // Now connect to server
        const result = await eel.connect_to_server(username, host, port)();
        if (result.success) {
            // Step 1: Start spinning the logo on login screen (immediately)
            const logoContainer = loginScreen.querySelector('.logo-container');
            logoContainer.classList.add('spinning');

            // Step 2: After 0.3s, start tile animation in background
            const loginLoader = document.getElementById('loginLoader');
            setTimeout(() => {
                loginLoader.classList.add('login-loader--active');
            }, 300);

            // Step 3: Fade out login form/text while logo continues
            setTimeout(() => {
                loginScreen.classList.add('login-fade-out');
            }, 600);

            // Step 4: After ~1.6s total, transition directly to main app (no old spinner)
            setTimeout(() => {
                // Prepare user info
                userName.textContent = username + ' ';
                const statusIcon = document.createElement('span');
                statusIcon.innerHTML = '🟢';
                statusIcon.style.color = '#2ecc71';
                statusIcon.style.fontSize = '12px';
                statusIcon.style.verticalAlign = 'middle';
                userName.appendChild(statusIcon);

                // Switch screens smoothly
                loginScreen.classList.remove('active');
                logoContainer.classList.remove('spinning');
                loginLoader.classList.remove('login-loader--active');
                mainApp.classList.add('active', 'main-app-fade-in');


                // Initialize global chat state
                currentChatType = 'global';
                currentChatTarget = null;

                // Highlight the global network item
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                globalNetworkItem.classList.add('active');

                showNotification('Connected!', 'success');

                // CRITICAL FIX: Add message menu buttons immediately after login
                setTimeout(() => {
                    console.log('🔧 Adding message menu buttons after login');
                    addMessageMenuButtons();
                }, 500);

                // Ensure badges are created
                ensureBadges();

                // Polling disabled - messages come via WebSocket in real-time
                // setTimeout(() => {
                //     console.log('===== STARTING DATA POLLING =====');
                //     pollForData();
                // }, 500);

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
                }, 300);

                // Force render after a short delay to ensure data is received
                setTimeout(() => {
                    console.log('===== FORCE RENDERING AFTER CONNECT =====');
                    console.log('Global history length:', chatHistories.global.length);

                    // Always request chat history explicitly to ensure we get it
                    console.log('Requesting chat history explicitly...');
                    eel.send_message('request_chat_history', '', {})();
                    eel.refresh_user_list()();

                    // If we still don't have data after localStorage, show what we have
                    if (chatHistories.global.length === 0) {
                        console.log('No messages in localStorage or from server yet');
                    } else {
                        console.log('Have messages from localStorage:', chatHistories.global.length);
                    }

                    // Load persistent groups
                    console.log('===== LOADING PERSISTENT GROUPS =====');
                    console.log(`Found ${Object.keys(persistentGroups).length} groups in localStorage`);
                    updateGroupsList();

                    // Always render to ensure messages are displayed (including from localStorage)
                    console.log('Initial render with localStorage messages:', chatHistories.global.length);
                    console.log('🔍 DEBUG: Messages before render:', chatHistories.global.map(m => `${m.sender}: ${m.content?.substring(0, 20)}...`));

                    if (chatHistories.global.length > 0) {
                        console.log('📱 Displaying messages from localStorage - no refresh delay!');
                        // Clear any existing messages first to prevent duplicates
                        messagesContainer.innerHTML = '';

                        // Set scroll to bottom BEFORE rendering to prevent glitch
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;

                        renderCurrentChat(false);

                        // Ensure we stay at bottom after render
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;

                        console.log('🔍 DEBUG: Messages in DOM after render:', messagesContainer.children.length);
                    } else {
                        // No messages in localStorage, just render empty chat
                        console.log('📱 No messages in localStorage, rendering empty chat');
                        messagesContainer.innerHTML = '';
                        renderCurrentChat(false);
                    }

                    // Add multiple backup renders to handle race conditions
                    setTimeout(() => {
                        if (currentChatType === 'global' && messagesContainer.children.length === 0 && chatHistories.global.length > 0) {
                            console.log('BACKUP 1: Messages not displayed, forcing render...');
                            messagesContainer.innerHTML = '';
                            renderCurrentChat(false);
                        }
                    }, 500);

                    setTimeout(() => {
                        if (currentChatType === 'global' && messagesContainer.children.length === 0 && chatHistories.global.length > 0) {
                            console.log('BACKUP 2: Messages still not displayed, forcing render...');
                            messagesContainer.innerHTML = '';
                            renderCurrentChat(false);
                        }
                        // Mark page refresh as complete
                        isPageRefresh = false;
                    }, 1500);

                    setTimeout(() => {
                        if (currentChatType === 'global' && messagesContainer.children.length === 0 && chatHistories.global.length > 0) {
                            console.log('BACKUP 3: Final attempt to render messages...');
                            messagesContainer.innerHTML = '';
                            renderCurrentChat(false);
                        }
                    }, 3000);

                    // Backup request for chat history if we still don't have any after 2 seconds
                    setTimeout(() => {
                        if (chatHistories.global.length === 0) {
                            console.log('BACKUP: Still no chat history, requesting again...');
                            eel.send_message('request_chat_history', '', {})();
                        }
                    }, 2000);
                }, 800);

                // Clean up animation class
                setTimeout(() => mainApp.classList.remove('main-app-fade-in'), 500);
            }, 1600);

            return;
        } else {
            showNotification(result.message, 'error');
            loginBtn.disabled = false;
            loginBtn.textContent = 'CONNECT';
        }
    } catch (error) {
        showNotification('Connection failed', 'error');
        loginBtn.disabled = false;
        loginBtn.textContent = 'CONNECT';
    }
});

// Enter key support for signup
signupUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signupPasswordInput.focus();
});
signupPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signupBtn.click();
});

// Enter key support for login
loginPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});
[hostInput, portInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });
});

// ===== DRAFT MESSAGE MANAGEMENT =====
// Save draft message to localStorage whenever user types
function saveDraftMessage() {
    const chatKey = currentChatType === 'global' ? 'global' : `${currentChatType}_${currentChatTarget}`;
    const draftText = messageInput.value;

    const drafts = JSON.parse(localStorage.getItem('messageDrafts') || '{}');
    if (draftText.trim()) {
        drafts[chatKey] = draftText;
    } else {
        delete drafts[chatKey];
    }
    localStorage.setItem('messageDrafts', JSON.stringify(drafts));
}

// Restore draft message when switching chats
function restoreDraftMessage() {
    const chatKey = currentChatType === 'global' ? 'global' : `${currentChatType}_${currentChatTarget}`;
    const drafts = JSON.parse(localStorage.getItem('messageDrafts') || '{}');

    if (drafts[chatKey]) {
        messageInput.value = drafts[chatKey];
    } else {
        messageInput.value = '';
    }
}

// Clear draft for current chat
function clearDraftMessage() {
    const chatKey = currentChatType === 'global' ? 'global' : `${currentChatType}_${currentChatTarget}`;
    const drafts = JSON.parse(localStorage.getItem('messageDrafts') || '{}');
    delete drafts[chatKey];
    localStorage.setItem('messageDrafts', JSON.stringify(drafts));
}

// Save draft as user types
messageInput.addEventListener('input', saveDraftMessage);

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

    // Prevent crashes from extremely large content
    const MAX_MESSAGE_LENGTH = 10000; // 10k characters
    if (content.length > MAX_MESSAGE_LENGTH) {
        showNotification(`Message too long (${content.length} chars). Maximum ${MAX_MESSAGE_LENGTH} characters.`, 'error');
        return;
    }

    // Check if this is a reply
    const replyContainer = document.querySelector('.reply-container');
    let metadata = {};

    if (replyContainer && replyContainer.style.display !== 'none' && replyContainer.dataset.replyTo) {
        metadata = {
            replyTo: {
                id: replyContainer.dataset.replyTo,
                sender: replyContainer.dataset.originalSender,
                text: replyContainer.dataset.originalText
            }
        };
    }

    // Create the message object immediately with full date timestamp
    const now = new Date();
    const timestamp = now.getFullYear() + '-' + 
        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getDate()).padStart(2, '0') + ' ' +
        now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

    const messageObj = {
        type: currentChatType === 'global' ? 'chat' : (currentChatType === 'private' ? 'private' : 'group_message'),
        sender: username,
        content: content,
        timestamp: timestamp,
        metadata: metadata.replyTo ? metadata : null
    };

    // Add additional fields for non-global messages
    if (currentChatType === 'private') {
        messageObj.receiver = currentChatTarget;
    } else if (currentChatType === 'group') {
        messageObj.group_id = currentChatTarget;
    }

    // DON'T add to local storage immediately - let server handle it
    // This prevents duplication issues

    messageInput.value = '';
    messageInput.focus();

    // Clear reply container if it was a reply
    if (replyContainer && replyContainer.dataset.replyTo) {
        replyContainer.style.display = 'none';
        replyContainer.dataset.replyTo = '';
    }

    // Clear draft message when sent
    clearDraftMessage();

    // Mark chat as viewed and update last seen index when sending
    const chatKey = currentChatType === 'global' ? 'global' : `${currentChatType}_${currentChatTarget}`;
    viewedChats.add(chatKey);

    // Update last seen index to current message count (will include the sent message once received)
    if (currentChatType === 'global') {
        lastSeenMessageIndex.global = chatHistories.global.length;
    } else if (currentChatType === 'private' && currentChatTarget) {
        if (!lastSeenMessageIndex.private[currentChatTarget]) {
            lastSeenMessageIndex.private[currentChatTarget] = 0;
        }
        lastSeenMessageIndex.private[currentChatTarget] = (chatHistories.private[currentChatTarget] || []).length;
    } else if (currentChatType === 'group' && currentChatTarget) {
        if (!lastSeenMessageIndex.group[currentChatTarget]) {
            lastSeenMessageIndex.group[currentChatTarget] = 0;
        }
        lastSeenMessageIndex.group[currentChatTarget] = (chatHistories.group[currentChatTarget] || []).length;
    }

    // Save last seen index to localStorage
    try {
        localStorage.setItem('lastSeenMessageIndex', JSON.stringify(lastSeenMessageIndex));
    } catch (e) {
        console.log('Could not save last seen index:', e);
    }

    try {
        if (currentChatType === 'private' && currentChatTarget) {
            // Check if user is offline and show notification only once
            if (!allUsers.includes(currentChatTarget) && !offlineNotificationsShown.has(currentChatTarget)) {
                showNotification(`${currentChatTarget} is offline. They will receive your message when they come online.`, 'warning');
                offlineNotificationsShown.add(currentChatTarget);
            }

            // Check if this user was in active list and move them to private chats immediately
            const activeUserItem = document.querySelector(`.active-user-item[data-user="${currentChatTarget}"]`);
            if (activeUserItem) {
                console.log(`Moving ${currentChatTarget} from active to private chats immediately`);
                moveUserToChattedList(currentChatTarget);
            }

            addToRecentChats(currentChatTarget);
            await eel.send_message('private', content, {
                receiver: currentChatTarget,
                metadata: metadata.replyTo ? metadata : undefined
            })();
        } else if (currentChatType === 'group') {
            await eel.send_message('group_message', content, {
                group_id: currentChatTarget,
                metadata: metadata.replyTo ? metadata : undefined
            })();
        } else {
            await eel.send_message('chat', content, {
                metadata: metadata.replyTo ? metadata : undefined
            })();
        }
    } catch (error) {
        console.error('Failed to send message:', error);
        showNotification('Failed to send message. Please check your connection.', 'error');
        // Restore the message in input so user doesn't lose it
        messageInput.value = content;
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

    // Helper function to ensure badge exists on element
    const ensureBadge = (element) => {
        let badge = element.querySelector('.unread-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'unread-count';
            badge.style.display = 'none';
            element.appendChild(badge);
        }
        return badge;
    };

    // Update chat list items (private)
    Object.entries(unreadCounts.private).forEach(([user, count]) => {
        const chatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
        if (chatItem) {
            const nameEl = chatItem.querySelector('.chat-name');
            if (nameEl) {
                let unreadBadge = ensureBadge(nameEl);
                if (count > 0) {
                    unreadBadge.textContent = count > 99 ? '99+' : count;
                    unreadBadge.style.display = 'inline-block';
                } else {
                    unreadBadge.style.display = 'none';
                }
            }
        }
    });

    // Also remove badges from users not in unreadCounts.private
    document.querySelectorAll(`.chat-item[data-user] .unread-count`).forEach(badge => {
        const chatItem = badge.closest('.chat-item');
        const user = chatItem.dataset.user;
        if (!unreadCounts.private[user] || unreadCounts.private[user] === 0) {
            badge.style.display = 'none';
        }
    });

    // Update active users list items with unread badges
    Object.entries(unreadCounts.private).forEach(([user, count]) => {
        const activeUserItem = document.querySelector(`.active-user-item[data-user="${user}"]`);
        if (activeUserItem) {
            const nameEl = activeUserItem.querySelector('.active-user-name');
            if (nameEl) {
                let unreadBadge = ensureBadge(nameEl);
                if (count > 0) {
                    unreadBadge.textContent = count > 99 ? '99+' : count;
                    unreadBadge.style.display = 'inline-block';
                } else {
                    unreadBadge.style.display = 'none';
                }
            }
        }
    });

    // Also remove badges from active users not in unreadCounts.private
    document.querySelectorAll(`.active-user-item[data-user] .unread-count`).forEach(badge => {
        const activeUserItem = badge.closest('.active-user-item');
        const user = activeUserItem.dataset.user;
        if (!unreadCounts.private[user] || unreadCounts.private[user] === 0) {
            badge.style.display = 'none';
        }
    });

    // Update group list items
    Object.entries(unreadCounts.group).forEach(([gid, count]) => {
        const chatItem = document.querySelector(`.chat-item[data-group-id="${gid}"]`);
        if (chatItem) {
            const nameEl = chatItem.querySelector('.chat-name');
            if (nameEl) {
                let unreadBadge = ensureBadge(nameEl);
                if (count > 0) {
                    unreadBadge.textContent = count > 99 ? '99+' : count;
                    unreadBadge.style.display = 'inline-block';
                } else {
                    unreadBadge.style.display = 'none';
                }
            }
        }
    });

    // Also remove badges from groups not in unreadCounts.group
    document.querySelectorAll(`.chat-item[data-group-id] .unread-count`).forEach(badge => {
        const chatItem = badge.closest('.chat-item');
        const gid = chatItem.dataset.groupId;
        if (!unreadCounts.group[gid] || unreadCounts.group[gid] === 0) {
            badge.style.display = 'none';
        }
    });

    // Update Global Network unread badge
    const globalNetworkItem = document.getElementById('globalNetworkItem');
    if (globalNetworkItem) {
        const nameEl = globalNetworkItem.querySelector('.chat-name');
        if (nameEl) {
            let globalBadge = ensureBadge(nameEl);
            const globalCount = unreadCounts.global || 0;
            if (globalCount > 0) {
                globalBadge.textContent = globalCount > 99 ? '99+' : globalCount;
                globalBadge.style.display = 'inline-block';
            } else {
                globalBadge.style.display = 'none';
            }
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

    // Special logging for chat_history messages
    if (message.type === 'chat_history') {
        console.log('🎯 CHAT HISTORY RECEIVED!');
        console.log('Messages count:', message.messages?.length || 0);
    }

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
        saveChatHistoriesToStorage(); // Save to localStorage

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

        // Check for duplicates
        const isDuplicate = message.sender === username &&
            chatHistories.private[otherUser].some(m =>
                m.sender === message.sender &&
                m.content === message.content &&
                Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 2000
            );

        if (!isDuplicate) {
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
        }

        // Don't automatically move user from active list when receiving message
        // Only move to private chats when user initiates the chat
        if (message.receiver === username) {
            // Check if user already exists in private chats list
            const existingChatItem = document.querySelector(`.chat-item[data-user="${message.sender}"]`);
            if (existingChatItem) {
                // User already in private chats, add to recent
                addToRecentChats(message.sender);
            }
            // Otherwise, keep them in active users with unread badge
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
            // Check if user already exists in private chats list
            const existingChatItem = document.querySelector(`.chat-item[data-user="${message.sender}"]`);
            if (existingChatItem) {
                // User already in private chats, add to recent
                addToRecentChats(message.sender);
            }
            showNotification(`${message.sender} shared a file`, 'info');
        }
    }
    else if (msgType === 'group_message') {
        if (!chatHistories.group[message.group_id]) {
            chatHistories.group[message.group_id] = [];
        }

        // Check for duplicates
        const isDuplicate = message.sender === username &&
            chatHistories.group[message.group_id].some(m =>
                m.sender === message.sender &&
                m.content === message.content &&
                Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 2000
            );

        if (!isDuplicate) {
            chatHistories.group[message.group_id].push(message);

            // Cache to localStorage
            try {
                const allGroups = JSON.parse(localStorage.getItem('chatHistories_group') || '{}');
                allGroups[message.group_id] = chatHistories.group[message.group_id];
                localStorage.setItem('chatHistories_group', JSON.stringify(allGroups));
            } catch (e) {
                console.log('Could not cache group message:', e);
            }

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
        console.log('📢 System message received:', message.content);
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

        const serverMessages = message.messages || [];

        // SERVER IS SOURCE OF TRUTH - Use server messages directly
        // Only preserve audio_data from localStorage if it exists
        console.log('📥 Server messages:', serverMessages.length);
        console.log('💾 Local messages before:', chatHistories.global.length);

        // Create a map of localStorage messages to preserve audio_data
        const localAudioData = new Map();
        chatHistories.global.forEach(msg => {
            if (msg.audio_data) {
                const key = `${msg.sender}|${msg.timestamp}|${msg.content}`;
                localAudioData.set(key, msg.audio_data);
            }
        });

        // Use server messages and restore audio_data if available
        chatHistories.global = serverMessages.map(msg => {
            const key = `${msg.sender}|${msg.timestamp}|${msg.content}`;
            if (localAudioData.has(key) && !msg.audio_data) {
                console.log('🎤 Restoring audio_data for:', msg.sender);
                msg.audio_data = localAudioData.get(key);
            }
            return msg;
        });

        console.log('✅ Final message count:', chatHistories.global.length);
        saveChatHistoriesToStorage();

        if (isViewingGlobal) {
            console.log('🎨 Rendering global chat...');
            renderCurrentChat(false);
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
    else if (msgType === 'user_chat_deleted') {
        const targetUser = message.target_user;
        const success = message.success;
        
        if (success) {
            console.log(`✅ Server confirmed deletion of chat with ${targetUser}`);
            showNotification(`Chat with ${targetUser} deleted successfully`, 'success');
        } else {
            console.error(`❌ Server failed to delete chat with ${targetUser}`);
            showNotification(`Failed to delete chat with ${targetUser}`, 'error');
        }
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
    else if (msgType === 'audio_share' || msgType === 'audio_message' || msgType === 'private_audio' || msgType === 'group_audio') {
        console.log('🎤 Audio message received:', msgType, 'from:', message.sender);
        console.log('🎤 Current chat:', currentChatType, currentChatTarget);

        if (msgType === 'audio_share' || msgType === 'audio_message') {
            console.log('🎤 Adding to global history');
            chatHistories.global.push(message);
            saveChatHistoriesToStorage(); // Save to localStorage

            if (currentChatType === 'global') {
                console.log('🎤 Displaying in global chat');
                addMessage(message);
            } else {
                console.log('🎤 Not in global chat, not displaying');
            }
        }
        else if (msgType === 'private_audio') {
            const otherUser = message.sender === username ? message.receiver : message.sender;
            console.log('🎤 Private audio, other user:', otherUser);

            if (!chatHistories.private[otherUser]) {
                chatHistories.private[otherUser] = [];
            }

            chatHistories.private[otherUser].push(message);
            console.log('🎤 Added to private history for:', otherUser);

            if (currentChatType === 'private' && currentChatTarget === otherUser) {
                console.log('🎤 Displaying in private chat');
                addMessage(message);
            }

            if (message.receiver === username) {
                addToRecentChats(message.sender);
                showNotification(`${message.sender} sent an audio message`, 'info');
            }
        }
        else if (msgType === 'group_audio') {
            console.log('🎤 Group audio, group ID:', message.group_id);

            if (!chatHistories.group[message.group_id]) {
                chatHistories.group[message.group_id] = [];
            }

            chatHistories.group[message.group_id].push(message);
            console.log('🎤 Added to group history');

            if (currentChatType === 'group' && currentChatTarget === message.group_id) {
                console.log('🎤 Displaying in group chat');
                addMessage(message);
            }
        }
    }
    // Handle audio invites with proper storage
    else if (msgType === 'audio_invite') {
        console.log('[AUDIO] Global audio invite received');
        chatHistories.global.push(message);

        // Display the invite if we're viewing global chat
        if (currentChatType === 'global') {
            if (message.is_acknowledgment) {
                // This is just an acknowledgment, don't show the invite again
                return;
            }
            handleAudioInvite(message);
        } else if (message.sender !== username) {
            // We're not in global chat but someone else started a call
            showNotification(`${message.sender} started an audio call in Global Network`, 'info');
        }
    }
    else if (msgType === 'audio_invite_private') {
        console.log('[AUDIO] Private audio invite received');
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
            handleAudioInvite(message);
        } else if (message.sender !== username) {
            // We're the receiver but not viewing this chat
            showNotification(`${message.sender} started an audio call`, 'info');
        }
    }
    else if (msgType === 'audio_invite_group') {
        console.log('[AUDIO] Group audio invite received');

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
            handleAudioInvite(message);
        } else if (message.sender !== username) {
            // We're not viewing this group but someone else started a call
            showNotification(`${message.sender} started an audio call in group`, 'info');
        }
    }
    else if (msgType === 'audio_missed') {
        // Only handle the missed call state, don't show AudioServer system message
        if (message.sender === 'AudioServer') {
            // Silently update the call states without showing a system message
            handleAudioMissed(message);
            return; // Don't add to chat history
        }
        handleAudioMissed(message);
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
    console.log('First few messages:', chatHistories.global.slice(0, 3));
    console.log('Messages container exists:', !!messagesContainer);
    console.log('Current container children:', messagesContainer ? messagesContainer.children.length : 'N/A');

    // Reset date tracker when rendering a new chat
    resetDateTracker();

    // Date dividers will be handled per message during rendering

    // Store current scroll position and check if we're at bottom
    const wasAtBottom = isAtBottom();
    const scrollPosition = messagesContainer.scrollTop;
    const scrollHeight = messagesContainer.scrollHeight;

    console.log('🧹 CLEARING MESSAGES CONTAINER - Before clear:', messagesContainer.children.length);
    messagesContainer.innerHTML = '';
    console.log('🧹 CLEARED MESSAGES CONTAINER - After clear:', messagesContainer.children.length);

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
        console.log('🔄 RENDERING GLOBAL MESSAGES - Count:', chatHistories.global.length);
        chatHistories.global.forEach((msg, index) => {
            // Insert new messages divider ONLY if not our own message
            if (showNewMessagesDivider && index === newMessageStartIndex && msg.sender !== username) {
                insertNewMessagesDivider();
            }

            if (msg.type === 'audio_invite') {
                handleAudioInvite(msg, true); // true = from history
            } else if (msg.type === 'video_invite') {
                handleVideoInvite(msg, true); // true = from history
            } else {
                addMessage(msg, false); // Don't auto-scroll for each message
            }
        });
        console.log('🔄 FINISHED RENDERING - DOM children:', messagesContainer.children.length);
    } else if (currentChatType === 'private' && currentChatTarget) {
        const history = chatHistories.private[currentChatTarget] || [];
        history.forEach((msg, index) => {
            // Insert new messages divider
            if (showNewMessagesDivider && index === newMessageStartIndex) {
                insertNewMessagesDivider();
            }

            if (msg.type === 'audio_invite_private') {
                handleAudioInvite(msg, true); // true = from history
            } else if (msg.type === 'video_invite_private') {
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

            if (msg.type === 'audio_invite_group') {
                handleAudioInvite(msg, true); // true = from history
            } else if (msg.type === 'video_invite_group') {
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
        if (wasAtBottom) {
            // Scroll to bottom if we were at bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            // Try to maintain relative scroll position
            const newScrollHeight = messagesContainer.scrollHeight;
            const heightDiff = newScrollHeight - scrollHeight;
            messagesContainer.scrollTop = scrollPosition + heightDiff;
        }
    } else {
        // When not preserving scroll (initial render ONLY)
        if (showNewMessagesDivider && !hasBeenViewed) {
            // Only scroll to divider on FIRST view of this chat ever
            setTimeout(() => {
                const divider = messagesContainer.querySelector('.new-messages-divider');
                if (divider) {
                    divider.scrollIntoView({ behavior: 'instant', block: 'center' });
                    // Mark as viewed immediately to prevent future scrolls
                    viewedChats.add(chatKey);
                }
            }, 50);
        } else {
            // Scroll to bottom for new users or when no divider
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Update pinned messages bar after rendering
    updatePinnedMessagesBar();

    console.log('✅ RENDER COMPLETE - Final DOM children count:', messagesContainer.children.length);
    console.log('✅ RENDER COMPLETE - Chat type:', currentChatType, 'Target:', currentChatTarget);
}

// Helper function to check if scroll is at bottom
function isAtBottom() {
    const threshold = 50; // pixels from bottom to consider "at bottom"
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= threshold;
}

function addMessage(message, autoScroll = true) {
    // Skip VideoServer and AudioServer system messages completely
    if (message.sender === 'VideoServer' || message.sender === 'VIDEOSERVER' ||
        message.sender === 'AudioServer' || message.sender === 'AUDIOSERVER') {
        return null;
    }

    // Check if we were at bottom before adding message
    const wasAtBottom = isAtBottom();

    // Check if this message was deleted by the user
    const deletedMessages = JSON.parse(localStorage.getItem('deletedMessages') || '{}');
    if (deletedMessages[message.id || message.timestamp]) {
        return null; // Skip this message if it was deleted
    }

    // Check if this is a reply to another message
    const isReply = message.replyTo || (message.metadata && message.metadata.replyTo);
    const replyInfo = message.replyTo || (message.metadata && message.metadata.replyTo);

    // Debug log for replies
    if (isReply && replyInfo) {
        console.log('🔄 Found reply message:', {
            sender: message.sender,
            replyTo: replyInfo,
            fullMessage: message
        });
    }

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
            background: ${isOwn ? 'rgba(198, 40, 40, 0.15)' : 'rgba(100, 100, 100, 0.2)'};
            border-left: 3px solid ${isOwn ? '#c62828' : '#888'};
            padding: 8px 10px;
            margin-bottom: 6px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
        `;

        const replySender = document.createElement('div');
        replySender.style.cssText = 'font-weight: 600; color: #c62828; margin-bottom: 3px; font-size: 13px;';
        replySender.textContent = replyInfo.sender === username ? 'You' : replyInfo.sender;

        const replyText = document.createElement('div');
        replyText.style.cssText = 'color: rgba(255, 255, 255, 0.7); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;';
        const replyContent = replyInfo.text || replyInfo.content || '';
        replyText.textContent = replyContent.substring(0, 100);

        replyQuote.appendChild(replySender);
        replyQuote.appendChild(replyText);
        content.appendChild(replyQuote);
    }


    const sender = document.createElement('span');
    sender.className = 'message-sender';
    sender.textContent = isOwn ? 'You' : message.sender;

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTimeWithoutSeconds(message.timestamp || getCurrentTime());

    header.appendChild(sender);
    header.appendChild(time);
    content.appendChild(header);

    // Check if we need to add a date divider
    const currentDate = getDateFromTimestamp(message.timestamp);
    console.log('🗓️ Date divider check:', {
        timestamp: message.timestamp,
        currentDate: currentDate,
        sender: message.sender
    });
    
    if (currentDate) {
        // Check if the last message in the container has a different date
        const lastMessage = messagesContainer.lastElementChild;
        let shouldAddDivider = false;
        
        if (!lastMessage) {
            // First message - always add date divider
            shouldAddDivider = true;
            console.log('🗓️ First message - adding date divider');
        } else if (lastMessage.classList.contains('date-divider')) {
            // Last element is already a date divider - check if it's different
            shouldAddDivider = lastMessage.textContent !== currentDate;
            console.log('🗓️ Last element is date divider:', lastMessage.textContent, 'vs', currentDate, '-> shouldAdd:', shouldAddDivider);
        } else {
            // Last element is a message - check its date
            const lastMessageDate = lastMessage.dataset.messageDate;
            shouldAddDivider = !lastMessageDate || lastMessageDate !== currentDate;
            console.log('🗓️ Last element is message with date:', lastMessageDate, 'vs', currentDate, '-> shouldAdd:', shouldAddDivider);
        }
        
        if (shouldAddDivider) {
            const dateDivider = document.createElement('div');
            dateDivider.className = 'date-divider';
            dateDivider.textContent = currentDate;
            dateDivider.dataset.date = currentDate;
            messagesContainer.appendChild(dateDivider);
            console.log('🗓️ Added date divider:', currentDate);
        }
        
        // Store the date on the message element for future reference
        messageDiv.dataset.messageDate = currentDate;
    }

    // Handle different message types
    if ((message.type === 'file_share' || message.type === 'file_notification' || message.type === 'private_file' || message.type === 'group_file') && message.file_id) {
        const fileName = message.file_name || message.name || '';
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);

        if (isImage && message.file_data) {
            // Display image inline
            const imageContainer = document.createElement('div');
            imageContainer.className = 'message-bubble image-message';
            imageContainer.style.cssText = 'padding: 0; max-width: 300px; border-radius: 12px; overflow: hidden; cursor: pointer;';

            const img = document.createElement('img');
            img.src = `data:image/jpeg;base64,${message.file_data}`;
            img.style.cssText = 'width: 100%; height: auto; display: block;';
            img.alt = fileName;

            // Click to open full size
            img.onclick = () => {
                window.open(img.src, '_blank');
            };

            imageContainer.appendChild(img);
            content.appendChild(imageContainer);
        } else {
            // Regular file display
            const fileItem = document.createElement('div');
            fileItem.className = 'message-bubble file-item';

            const infoSection = document.createElement('div');
            infoSection.className = 'file-info-section';
            infoSection.innerHTML = `
                <div class="file-name">${fileName}</div>
                <div class="file-detail">${formatFileSize(message.size || message.file_size)} • ${message.sender}</div>
            `;

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'file-download-btn';
            downloadBtn.textContent = isImage ? 'View Image' : 'Download';
            downloadBtn.onclick = () => downloadFile(message);

            fileItem.appendChild(infoSection);
            fileItem.appendChild(downloadBtn);
            content.appendChild(fileItem);
        }
    }
    else if (message.type === 'audio_message' || message.type === 'private_audio' || message.type === 'group_audio') {
        const audioItem = document.createElement('div');
        audioItem.className = 'message-bubble audio-item';

        const infoSection = document.createElement('div');
        infoSection.className = 'audio-info-section';
        infoSection.innerHTML = `
            <div class="audio-title">🎵 Audio Message</div>
            <div class="audio-detail">${message.duration || '0'}s • ${message.sender}</div>
        `;

        const playBtn = document.createElement('button');
        playBtn.className = 'audio-play-btn';
        playBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg> Play
        `;

        // Debug logging
        if (!message.audio_data && message.has_audio) {
            console.warn('⚠️ Audio message missing audio_data:', {
                sender: message.sender,
                timestamp: message.timestamp,
                has_audio: message.has_audio,
                audio_data_length: message.audio_data ? message.audio_data.length : 0
            });
        }

        if (message.audio_data) {
            playBtn.onclick = () => {
                showAudioPlayback(message.audio_data, message.duration, message.sender);
            };
        } else if (message.has_audio) {
            // Audio data is missing - this shouldn't happen after the fix
            playBtn.textContent = '⚠️ Audio data missing';
            playBtn.disabled = true;
            playBtn.style.opacity = '0.5';
            playBtn.title = 'Audio data not available. Please restart the server.';
        } else {
            playBtn.textContent = 'Audio not available';
            playBtn.disabled = true;
        }

        audioItem.appendChild(infoSection);
        audioItem.appendChild(playBtn);
        content.appendChild(audioItem);
    }
    else if (!['private_file', 'file_share', 'file_notification', 'group_file', 'audio_message', 'private_audio', 'group_audio', 'audio_invite', 'audio_invite_private', 'audio_invite_group', 'video_invite', 'video_invite_private', 'video_invite_group'].includes(message.type)) {
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

    // Auto-scroll to bottom if we were at bottom or if this is our own message
    if (autoScroll && (wasAtBottom || message.sender === username)) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 10);
    }

    // Restore emoji reactions if any
    const allReactions = JSON.parse(localStorage.getItem('messageReactions') || '{}');
    if (allReactions[messageId]) {
        renderMessageReactions(messageDiv, messageId, allReactions[messageId]);
    }

    // Restore starred state
    const starredMessages = JSON.parse(localStorage.getItem('starredMessages') || '{}');
    if (starredMessages[messageId]) {
        messageDiv.classList.add('starred');
        const starIcon = document.createElement('span');
        starIcon.className = 'star-icon';
        starIcon.innerHTML = '⭐';
        starIcon.style.position = 'absolute';
        starIcon.style.right = '4px';
        starIcon.style.top = '4px';
        starIcon.style.fontSize = '12px';
        messageDiv.appendChild(starIcon);
    }

    // Restore pinned state
    const pinnedMessages = JSON.parse(localStorage.getItem('pinnedMessages') || '{}');
    if (pinnedMessages[messageId]) {
        messageDiv.classList.add('pinned');
        const pinIcon = document.createElement('span');
        pinIcon.className = 'pin-icon';
        pinIcon.innerHTML = '📌';
        pinIcon.style.position = 'absolute';
        pinIcon.style.right = '8px';
        pinIcon.style.top = '8px';
        pinIcon.style.fontSize = '14px';
        messageDiv.appendChild(pinIcon);
    }

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

    // Determine if this is the user's own video call
    const isOwn = sender === username;

    // Create wrapper message div
    const messageWrapper = document.createElement('div');
    messageWrapper.className = isOwn ? 'message own' : 'message';
    if (session_id) messageWrapper.dataset.sessionId = session_id;

    // Create avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender.charAt(0).toUpperCase();

    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'message-content';

    // Create the video message div (this will be the inner content)
    const videoMessage = document.createElement('div');
    videoMessage.style.display = 'contents';
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
            data-session-id="${session_id}"
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
                   box-shadow: 0 2px 6px rgba(198, 40, 40, 0.4);"
            onmouseover="if(!this.disabled) { this.style.background='linear-gradient(135deg, #d32f2f, #c62828)'; this.style.boxShadow='0 4px 12px rgba(198, 40, 40, 0.6)'; }"
            onmouseout="if(!this.disabled) { this.style.background='linear-gradient(135deg, #c62828, #c62828)'; this.style.boxShadow='0 2px 6px rgba(198, 40, 40, 0.4)'; }">
        <span>🎥</span>
        <span>Join Video Call</span>
    </button>
</div>


        `;
    }

    // Append video message to content wrapper
    content.appendChild(videoMessage);

    // Build the message structure: avatar + content
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(content);

    // Append to messages container
    messagesContainer.appendChild(messageWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleAudioInvite(message, isFromHistory = false) {
    const { sender, link, session_id } = message;
    console.log('[AUDIO] Handling audio invite from', sender, 'isFromHistory:', isFromHistory);

    // Check if this call was marked as missed in localStorage
    const missedCalls = JSON.parse(localStorage.getItem('missedAudioCalls') || '{}');
    const wasMissed = missedCalls[session_id];

    const isMissed = message.is_missed || wasMissed || false;
    const missedTime = message.missed_at || (wasMissed ? wasMissed.timestamp : '');

    // Determine if this is the user's own audio call
    const isOwn = sender === username;

    // Create wrapper message div
    const messageWrapper = document.createElement('div');
    messageWrapper.className = isOwn ? 'message own' : 'message';
    if (session_id) messageWrapper.dataset.sessionId = session_id;

    // Create avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender.charAt(0).toUpperCase();

    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'message-content';

    // Create the audio message div (this will be the inner content)
    const audioMessage = document.createElement('div');
    audioMessage.style.display = 'contents';
    if (session_id) audioMessage.dataset.sessionId = session_id;

    // Show modal ONLY for real-time incoming calls (not historical ones, not your own calls)
    if (!isMissed && sender !== username && !isFromHistory) {
        showIncomingAudioCallModal(sender, link, session_id);
    }

    if (isMissed) {
        // Reduced size and updated styling for missed call message
        audioMessage.innerHTML = `
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
                    opacity: 0.8;">🔇</div>
        <div style="flex: 1; 
                    min-width: 0;">
            <div style="font-weight: 500; 
                        font-size: 14px; 
                        color: #c4c0c0; 
                        margin-bottom: 4px; 
                        line-height: 1.4;">
                ${sender} started an audio call
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
        <span style="filter: grayscale(40%) brightness(0.7);">🔇</span>
        <span>Missed Call (${missedTime})</span>
    </button>
</div>

        `;
    } else {
        // Reduced size and updated styling for active audio call invitation
        audioMessage.innerHTML = `
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
                    filter: grayscale(20%) brightness(0.9);">🎙️</div>
        <div style="flex: 1; 
                    min-width: 0;">
            <div style="font-weight: 500; 
                        font-size: 14px; 
                        color: #e0dede; 
                        margin-bottom: 4px; 
                        line-height: 1.4;">
                ${sender} started an audio call
            </div>
            <div style="font-size: 11px; 
                        color: #9a9696; 
                        line-height: 1.3;">
                ${message.timestamp || new Date().toLocaleTimeString()}
            </div>
        </div>
    </div>
    <button class="join-call-btn" 
            data-session-id="${session_id}"
            onclick="window.open('${link}?username=${encodeURIComponent(username)}', 'audio_call', 'width=600,height=500')"
            style="width: 100%; 
                   background: linear-gradient(135deg, #00b8d4, #00b8d4); 
                   border: 1px solid #00acc1; 
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
                   box-shadow: 0 2px 6px rgba(0, 184, 212, 0.4);"
            onmouseover="if(!this.disabled) { this.style.background='linear-gradient(135deg, #00acc1, #00b8d4)'; this.style.boxShadow='0 4px 12px rgba(0, 184, 212, 0.6)'; }"
            onmouseout="if(!this.disabled) { this.style.background='linear-gradient(135deg, #00b8d4, #00b8d4)'; this.style.boxShadow='0 2px 6px rgba(0, 184, 212, 0.4)'; }">
        <span>🎙️</span>
        <span>Join Audio Call</span>
    </button>
</div>


        `;
    }

    // Append audio message to content wrapper
    content.appendChild(audioMessage);

    // Build the message structure: avatar + content
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(content);

    // Append to messages container
    messagesContainer.appendChild(messageWrapper);
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

function showIncomingAudioCallModal(sender, link, sessionId) {
    // Check if this call has been ignored
    const ignoredCalls = JSON.parse(localStorage.getItem('ignoredAudioCalls') || '{}');
    if (ignoredCalls[sessionId]) {
        console.log('[AUDIO] Call already ignored, not showing modal');
        return;
    }

    // Remove any existing modal
    const existing = document.getElementById('incomingAudioCallModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'incomingAudioCallModal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: linear-gradient(135deg, #2d3142, #1a1d29); border: 3px solid #00b8d4; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; box-shadow: 0 8px 32px rgba(0, 184, 212, 0.6); animation: slideIn 0.3s ease;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 64px; margin-bottom: 16px; animation: pulse 2s infinite;">🎙️</div>
                    <h2 style="color: var(--text-bright); font-family: 'Bangers', cursive; font-size: 24px; margin: 0 0 8px 0; letter-spacing: 2px;">${sender} is calling...</h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin: 0;">Incoming audio call</p>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button id="answerAudioCallBtn" style="flex: 1; background: linear-gradient(135deg, #00b8d4, #0097a7); border: none; border-radius: 8px; padding: 14px; color: white; font-weight: 600; font-size: 15px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(0, 184, 212, 0.4); transition: all 0.2s;">
                        📞 Answer
                    </button>
                    <button id="ignoreAudioCallBtn" style="flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 14px; color: #bbb; font-weight: 600; font-size: 15px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: all 0.2s;">
                        ❌ Ignore
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Add hover effects and click handlers
    const answerBtn = document.getElementById('answerAudioCallBtn');
    const ignoreBtn = document.getElementById('ignoreAudioCallBtn');

    answerBtn.onmouseover = () => answerBtn.style.transform = 'scale(1.05)';
    answerBtn.onmouseout = () => answerBtn.style.transform = 'scale(1)';
    answerBtn.onclick = () => {
        // Remove from ignored calls when answering
        const ignoredCalls = JSON.parse(localStorage.getItem('ignoredAudioCalls') || '{}');
        if (ignoredCalls[sessionId]) {
            delete ignoredCalls[sessionId];
            localStorage.setItem('ignoredAudioCalls', JSON.stringify(ignoredCalls));
        }
        window.open(`${link}?username=${encodeURIComponent(username)}`, 'audio_call', 'width=600,height=500');
        modal.remove();
    };

    ignoreBtn.onmouseover = () => { ignoreBtn.style.background = 'rgba(255,255,255,0.15)'; ignoreBtn.style.color = '#fff'; };
    ignoreBtn.onmouseout = () => { ignoreBtn.style.background = 'rgba(255,255,255,0.1)'; ignoreBtn.style.color = '#bbb'; };
    ignoreBtn.onclick = () => {
        // Mark this call as ignored in localStorage
        const ignoredCalls = JSON.parse(localStorage.getItem('ignoredAudioCalls') || '{}');
        ignoredCalls[sessionId] = true;
        localStorage.setItem('ignoredAudioCalls', JSON.stringify(ignoredCalls));
        console.log('[AUDIO] Call ignored and saved:', sessionId);
        modal.remove();
    };

    // Auto-remove modal after 30 seconds
    setTimeout(() => {
        if (document.getElementById('incomingAudioCallModal')) {
            modal.remove();
        }
    }, 30000);
}

function handleAudioMissed(message) {
    const sessionId = message.session_id;
    const timestamp = message.timestamp || getCurrentTime();
    if (!sessionId) return;

    console.log('[AUDIO] Handling missed call for session:', sessionId);

    // Close incoming call modal if it's open
    const modal = document.getElementById('incomingAudioCallModal');
    if (modal) modal.remove();

    // Remove from ignored calls (since it's now officially missed)
    const ignoredCalls = JSON.parse(localStorage.getItem('ignoredAudioCalls') || '{}');
    if (ignoredCalls[sessionId]) {
        delete ignoredCalls[sessionId];
        localStorage.setItem('ignoredAudioCalls', JSON.stringify(ignoredCalls));
    }

    // Store missed call state in localStorage to persist across tab switches
    const missedCalls = JSON.parse(localStorage.getItem('missedAudioCalls') || '{}');
    missedCalls[sessionId] = {
        timestamp: timestamp,
        session_type: message.session_type,
        chat_id: message.chat_id
    };
    localStorage.setItem('missedAudioCalls', JSON.stringify(missedCalls));

    // Find all audio invite messages with this session ID
    const selectors = document.querySelectorAll(`[data-session-id="${sessionId}"]`);
    console.log('[AUDIO] Found', selectors.length, 'invite messages to update');

    selectors.forEach(el => {
        const btn = el.querySelector('.join-call-btn');
        if (btn && !btn.disabled) {  // Only update if not already disabled
            console.log('[AUDIO] Updating button to missed call');
            btn.disabled = true;
            btn.textContent = `🔇 Missed Call (${timestamp})`;
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
            (msg.type === 'audio_invite' || msg.type === 'audio_invite_private' || msg.type === 'audio_invite_group' ||
                msg.type === 'video_invite' || msg.type === 'video_invite_private' || msg.type === 'video_invite_group')) {
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

    // Skip empty or undefined content
    if (!content || content.trim() === '') {
        console.log('⚠️ Skipping empty system message');
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
    for (const key in chatHistories.private) {
        const messages = chatHistories.private[key];
        if (!messages || messages.length === 0) continue;
        const hasMyMessages = messages.some(msg =>
            msg.sender === username || msg.receiver === username
        );
        if (hasMyMessages) {
            const parts = key.split('_');
            const otherUser = parts[0] === username ? parts[1] : parts[0];
            if (otherUser && otherUser !== username) {
                chattedUsers.add(otherUser);
            }
        }
    }

    // Separate online users into active (not chatted) and chatted
    const onlineUsers = users.filter(u => u !== username);
    const activeOnlyUsers = onlineUsers.filter(u => !chattedUsers.has(u));
    const chattedOnlineUsers = onlineUsers.filter(u => chattedUsers.has(u));

    // Update Active Users Section
    updateActiveUsersSection(activeOnlyUsers);

    // Update Private Chats List (only show users we've chatted with, excluding archived)
    usersList.innerHTML = '';
    // Filter out archived chats
    const activeChattedUsers = Array.from(chattedUsers).filter(u => !archivedChats.has(u));

    if (activeChattedUsers.length === 0) {
        noUsersMsg.style.display = 'block';
        return;
    }
    noUsersMsg.style.display = 'none';

    // Sort users by unread count (descending) and last message timestamp (most recent first)
    activeChattedUsers.sort((a, b) => {
        // Current chat always at top if actively chatting
        if (currentChatType === 'private') {
            if (a === currentChatTarget) return -1;
            if (b === currentChatTarget) return 1;
        }

        // Sort by unread count (higher first)
        const unreadA = unreadCounts.private[a] || 0;
        const unreadB = unreadCounts.private[b] || 0;
        if (unreadA !== unreadB) {
            return unreadB - unreadA;
        }

        // If unread counts are equal, sort by last message timestamp
        const messagesA = chatHistories.private[a] || [];
        const messagesB = chatHistories.private[b] || [];
        const lastMsgA = messagesA.length > 0 ? new Date(messagesA[messagesA.length - 1].timestamp).getTime() : 0;
        const lastMsgB = messagesB.length > 0 ? new Date(messagesB[messagesB.length - 1].timestamp).getTime() : 0;
        return lastMsgB - lastMsgA;
    });

    activeChattedUsers.forEach(user => {
        const isOnline = users.includes(user);
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.user = user;
        chatItem.onclick = () => switchToPrivateChat(user);

        // Get last message for this user
        // Get last message from private chat history
        const messages = chatHistories.private[user] || [];
        let lastMsgText = 'No messages yet';

        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.content) {
                // Truncate long messages
                const content = lastMessage.content.substring(0, 35);
                lastMsgText = content + (lastMessage.content.length > 35 ? '...' : '');

                // Add prefix if you sent it
                if (lastMessage.sender === username) {
                    lastMsgText = 'You: ' + lastMsgText;
                }
            } else if (lastMessage.type === 'private_file') {
                lastMsgText = '📎 File shared';
            } else if (lastMessage.type === 'private_audio') {
                lastMsgText = '🎤 Audio message';
            }
        }

        chatItem.innerHTML = `
            <div class="chat-avatar">👤</div>
            <div class="chat-info">
                <div class="chat-name">
                    <span>${user}</span>
                    <span style="font-size: 18px; vertical-align: middle; color: ${isOnline ? '#2ecc71' : '#95a5a6'}; margin-left: 2px;">●</span>
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
        // Add badge after rendering
        const nameEl = chatItem.querySelector('.chat-name');
        const badge = document.createElement('span');
        badge.className = 'unread-count';
        nameEl.appendChild(badge);
        // Set unread badge for this user immediately
        const privCount = unreadCounts.private[user] || 0;
        if (privCount > 0) {
            badge.textContent = privCount > 99 ? '99+' : privCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    });
    // After rendering list, sync unread badges to ensure correct visibility
    updateUnreadCountsUI();
}

// Update Active Users Section
function updateActiveUsersSection(activeUsers) {
    const activeUsersSection = document.getElementById('activeUsersSection');
    const activeUsersList = document.getElementById('activeUsersList');
    const activeUsersCount = document.getElementById('activeUsersCount');

    if (activeUsers.length === 0) {
        activeUsersSection.style.display = 'none';
        return;
    }

    activeUsersSection.style.display = 'block';
    // Don't display the count (hidden in HTML)
    activeUsersCount.textContent = activeUsers.length;
    activeUsersList.innerHTML = '';

    activeUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'active-user-item';
        userItem.dataset.user = user;
        userItem.onclick = () => {
            // Switch to private chat when clicked
            switchToPrivateChat(user);
        };

        const userNameDiv = document.createElement('div');
        userNameDiv.className = 'active-user-name';
        userNameDiv.textContent = user;
        
        // Add unread badge support
        const unreadCount = unreadCounts.private[user] || 0;
        if (unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread-count';
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'inline-block';
            userNameDiv.appendChild(badge);
        }

        userItem.innerHTML = `
            <div class="active-user-avatar">${user.charAt(0).toUpperCase()}</div>
            <div class="active-user-info">
            </div>
        `;
        
        const userInfo = userItem.querySelector('.active-user-info');
        userInfo.appendChild(userNameDiv);
        
        const statusDiv = document.createElement('div');
        statusDiv.className = 'active-user-status';
        statusDiv.textContent = 'Online';
        userInfo.appendChild(statusDiv);

        activeUsersList.appendChild(userItem);
    });
}

// Move user from active to chatted when first message sent
function moveUserToChattedList(user) {
    console.log(`🚀 IMMEDIATE MOVE: Moving ${user} from active to chatted list`);

    // Immediately remove from active users section
    const activeUserItem = document.querySelector(`.active-user-item[data-user="${user}"]`);
    if (activeUserItem) {
        activeUserItem.remove();
        console.log(`✅ Removed ${user} from active users DOM`);
    }

    // Update active users count
    const activeUsersList = document.getElementById('activeUsersList');
    const activeUsersCount = document.getElementById('activeUsersCount');
    const activeUsersSection = document.getElementById('activeUsersSection');

    if (activeUsersList && activeUsersList.children.length === 0) {
        activeUsersSection.style.display = 'none';
    } else if (activeUsersCount) {
        activeUsersCount.textContent = activeUsersList.children.length;
    }

    // Add to private chats list immediately
    const usersList = document.getElementById('usersList');
    const noUsersMsg = document.getElementById('noUsersMsg');

    // Check if user already exists in private chats
    if (!document.querySelector(`.chat-item[data-user="${user}"]`)) {
        noUsersMsg.style.display = 'none';

        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.user = user;
        chatItem.onclick = () => switchToPrivateChat(user);

        const isOnline = allUsers.includes(user);

        // Create avatar
        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar';
        avatar.textContent = '👤';
        chatItem.appendChild(avatar);

        // Create chat info
        const info = document.createElement('div');
        info.className = 'chat-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'chat-name';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user;
        nameDiv.appendChild(nameSpan);

        const statusSpan = document.createElement('span');
        statusSpan.style.cssText = `font-size: 14px; vertical-align: middle; color: ${isOnline ? '#2ecc71' : '#95a5a6'}; margin-left: 2px;`;
        statusSpan.textContent = '●';
        nameDiv.appendChild(statusSpan);

        const lastMsg = document.createElement('div');
        lastMsg.className = 'chat-last-msg';
        lastMsg.textContent = 'Just now';

        info.appendChild(nameDiv);
        info.appendChild(lastMsg);
        chatItem.appendChild(info);

        // Create menu button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'chat-menu-btn';
        menuBtn.onclick = (e) => { e.stopPropagation(); showChatContextMenu(e, user); };
        menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>`;
        chatItem.appendChild(menuBtn);

        usersList.insertBefore(chatItem, usersList.firstChild);

        // Create and add badge
        const badge2 = document.createElement('span');
        badge2.className = 'unread-count';
        nameDiv.appendChild(badge2);

        // Apply unread count if exists for this user
        const count = unreadCounts.private[user] || 0;
        if (count > 0) {
            badge2.textContent = count > 99 ? '99+' : count;
            badge2.style.display = 'inline-block';
        } else {
            badge2.style.display = 'none';
        }
        console.log(`✅ Added ${user} to private chats DOM`);
    }
}

// Debounce timer for group list updates
let groupListUpdateTimer = null;
let pendingServerGroups = [];

function updateGroupsList(groups = []) {
    console.log(`📋 UPDATE GROUPS LIST CALLED`);
    console.log(`📊 Persistent groups: ${Object.keys(persistentGroups).length}`);
    console.log(`📊 Server groups received: ${groups.length}`);

    // Store server groups if provided
    if (groups && groups.length > 0) {
        pendingServerGroups = groups;
    }

    // Clear any pending update
    if (groupListUpdateTimer) {
        clearTimeout(groupListUpdateTimer);
    }

    // Debounce to prevent multiple rapid updates
    groupListUpdateTimer = setTimeout(() => {
        renderGroupsList();
    }, 100);
}

function renderGroupsList() {
    console.log(`🎨 RENDERING GROUPS LIST`);

    // Combine server groups with persistent groups (server groups take priority)
    const allGroups = {};

    // First add persistent groups (only if user is a member)
    for (const groupId in persistentGroups) {
        const group = persistentGroups[groupId];
        if (group.members && group.members.includes(username)) {
            allGroups[groupId] = group;
            console.log(`📦 Persistent: ${group.name} (${groupId.substring(0, 20)}...)`);
        }
    }

    // Then add/update with server groups (these override persistent ones)
    if (pendingServerGroups && pendingServerGroups.length > 0) {
        pendingServerGroups.forEach(group => {
            if (group.members && group.members.includes(username)) {
                // Update persistent storage with server data
                persistentGroups[group.id] = group;
                allGroups[group.id] = group;
                console.log(`📡 Server: ${group.name} (${group.id.substring(0, 20)}...)`);
            }
        });
        // Save updated groups to localStorage
        saveGroupsToLocalStorage();
        // Clear pending server groups
        pendingServerGroups = [];
    }

    console.log(`📊 Total unique groups for ${username}: ${Object.keys(allGroups).length}`);

    const groupIds = Object.keys(allGroups);

    // CLEAR the list completely before rendering
    groupsList.innerHTML = '';

    if (groupIds.length === 0) {
        noGroupsMsg.style.display = 'block';
        console.log('📭 No groups to display');
        return;
    }

    noGroupsMsg.style.display = 'none';

    // Sort groups by unread count (descending) and last message timestamp (most recent first)
    groupIds.sort((a, b) => {
        // Current chat always at top if actively chatting
        if (currentChatType === 'group') {
            if (a === currentChatTarget) return -1;
            if (b === currentChatTarget) return 1;
        }

        // Sort by unread count (higher first)
        const unreadA = unreadCounts.group[a] || 0;
        const unreadB = unreadCounts.group[b] || 0;
        if (unreadA !== unreadB) {
            return unreadB - unreadA;
        }

        // If unread counts are equal, sort by last message timestamp
        const messagesA = chatHistories.group[a] || [];
        const messagesB = chatHistories.group[b] || [];
        const lastMsgA = messagesA.length > 0 ? new Date(messagesA[messagesA.length - 1].timestamp).getTime() : 0;
        const lastMsgB = messagesB.length > 0 ? new Date(messagesB[messagesB.length - 1].timestamp).getTime() : 0;
        return lastMsgB - lastMsgA;
    });

    // Render each unique group ONCE
    groupIds.forEach(groupId => {
        const groupInfo = allGroups[groupId];

        if (!groupInfo || !groupInfo.name) {
            console.error(`❌ Invalid group info for: ${groupId}`, groupInfo);
            return;
        }

        console.log(`✅ Rendering: ${groupInfo.name} (${groupId.substring(0, 20)}...)`)
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.groupId = groupInfo.id;
        chatItem.onclick = () => switchToGroupChat(groupInfo.id, groupInfo.name);

        // Check if any group member is online
        const hasOnlineMembers = groupInfo.members && groupInfo.members.some(member => allUsers.includes(member));
        const onlineStatusDot = hasOnlineMembers ? '<span style="font-size: 18px; vertical-align: middle; color: #2ecc71; margin-left: 4px;">●</span>' : '';

        // Get last message for this group
        const messages = chatHistories.group[groupInfo.id] || [];
        let lastMsgText = 'No messages yet';

        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.content) {
                // Truncate long messages
                const content = lastMessage.content.substring(0, 30);
                lastMsgText = content + (lastMessage.content.length > 30 ? '...' : '');

                // Add sender name prefix
                const senderName = lastMessage.sender === username ? 'You' : lastMessage.sender;
                lastMsgText = `${senderName}: ${lastMsgText}`;
            } else if (lastMessage.type === 'group_file') {
                lastMsgText = '📎 File shared';
            } else if (lastMessage.type === 'group_audio') {
                lastMsgText = '🎤 Audio message';
            } else if (lastMessage.type === 'group_created') {
                lastMsgText = '✨ Group created';
            }
        }
        chatItem.innerHTML = `
            <div class="chat-avatar">👥</div>
            <div class="chat-info">
                <div class="chat-name">
                    <span>${groupInfo.name}</span>
                    ${onlineStatusDot}
                    <span class="unread-count" style="display: none;"></span>
                </div>
                <div class="chat-last-msg">${lastMsgText}</div>
            </div>
            <button class="chat-menu-btn" onclick="event.stopPropagation(); showGroupContextMenu(event, '${groupInfo.id}', '${groupInfo.name}', ${JSON.stringify(groupInfo.members || []).replace(/"/g, '&quot;')}, '${groupInfo.admin || ''}')">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            </button>
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
    console.log(`🔄 SWITCHING TO PRIVATE CHAT: ${user}`);

    // Reset date tracker when switching chats
    resetDateTracker();

    // Clean up viewed state for chats with no unread messages when leaving
    cleanupViewedChats();

    // If this chat was archived, unarchive it
    if (archivedChats.has(user)) {
        console.log(`📅 Unarchiving chat with ${user}`);
        archivedChats.delete(user);

        // Save updated archived state
        try {
            localStorage.setItem('archivedChats', JSON.stringify(Array.from(archivedChats)));
        } catch (e) {
            console.error('Failed to save archived chats:', e);
        }

        // Remove from active if exists and add back to private chats list
        const activeItem = document.querySelector(`.active-user-item[data-user="${user}"]`);
        if (activeItem) {
            activeItem.remove();

            // Update active count
            const activeUsersList = document.getElementById('activeUsersList');
            const activeUsersCount = document.getElementById('activeUsersCount');
            const activeUsersSection = document.getElementById('activeUsersSection');

            if (activeUsersList && activeUsersList.children.length === 0) {
                activeUsersSection.style.display = 'none';
            } else if (activeUsersCount) {
                activeUsersCount.textContent = activeUsersList.children.length;
            }

            console.log(`✅ Removed ${user} from active users`);
        }

        // Add to private chats if not already there
        const existingChatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
        if (!existingChatItem) {
            moveUserToChattedList(user);
        }
    }

    currentChatType = 'private';
    currentChatTarget = user;
    chatHeaderName.textContent = user;
    chatHeaderStatus.textContent = 'Private Chat';

    // Hide group settings button
    const groupSettingsBtn = document.getElementById('groupSettingsHeaderBtn');
    if (groupSettingsBtn) {
        groupSettingsBtn.style.display = 'none';
    }

    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    globalNetworkItem.classList.remove('active');
    addToRecentChats(user);

    // Only set active if user already exists in private chats
    // DON'T create temporary chat item - user should only move after sending first message
    const existingChatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
    if (existingChatItem) {
        existingChatItem.classList.add('active');
        console.log(`✅ User ${user} already in private chats, set as active`);
    } else {
        console.log(`📝 User ${user} from active section - just opening chat, not moving yet`);
    }

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

    // Restore draft message for this chat
    restoreDraftMessage();

    // Then request updated history from server
    await eel.send_message('request_private_history', '', { target_user: user })();
    await eel.set_current_chat('private', user)();
}

async function switchToGroupChat(groupId, groupName) {
    // Reset date tracker when switching chats
    resetDateTracker();

    // Clean up viewed state for chats with no unread messages when leaving
    cleanupViewedChats();

    currentChatType = 'group';
    currentChatTarget = groupId;
    chatHeaderName.textContent = groupName;
    chatHeaderStatus.textContent = 'Group Chat';

    // Show group settings button in header
    const groupSettingsBtn = document.getElementById('groupSettingsHeaderBtn');
    if (groupSettingsBtn) {
        groupSettingsBtn.style.display = 'block';
    }

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

    // Restore draft message for this chat
    restoreDraftMessage();

    // Then request updated history from server
    await eel.send_message('request_group_history', '', { group_id: groupId })();
    await eel.set_current_chat('group', groupId)();
}

globalNetworkItem.addEventListener('click', async function () {
    // Reset date tracker when switching chats
    resetDateTracker();

    // Clean up viewed state for chats with no unread messages when leaving
    cleanupViewedChats();

    currentChatType = 'global';
    currentChatTarget = null;
    chatHeaderName.textContent = 'Global Network';
    chatHeaderStatus.textContent = 'Secure broadcast channel';

    // Hide group settings button
    const groupSettingsBtn = document.getElementById('groupSettingsHeaderBtn');
    if (groupSettingsBtn) {
        groupSettingsBtn.style.display = 'none';
    }

    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    this.classList.add('active');

    // Track this chat switch
    lastChatSwitchTime = Date.now();
    lastChatSwitchTarget = 'global';

    // Render (will use last seen index to show divider)
    renderCurrentChat(false);

    // Clear unread count and update last seen AFTER rendering
    clearUnreadForCurrentChat();

    // Restore draft message for this chat
    restoreDraftMessage();

    // Then request updated history from server
    console.log('🔄 Requesting chat history for global chat...');
    await eel.send_message('request_chat_history', '', {})();
    await eel.set_current_chat('global', null)();

    // Ensure messages are visible after a short delay
    setTimeout(() => {
        ensureMessagesVisible();
    }, 200);

    // Additional backup request if no messages appear
    setTimeout(() => {
        if (messagesContainer.children.length === 0) {
            console.log('🔄 BACKUP: No messages visible, requesting chat history again...');
            eel.send_message('request_chat_history', '', {})();
        }
    }, 1000);
});

// ===== AUDIO CALL =====
audioCallBtn.addEventListener('click', async () => {
    if (!currentChatType) {
        showNotification('Select a chat first', 'warning');
        return;
    }

    // Validate that we have the required chat target for non-global calls
    if (currentChatType === 'private' && !currentChatTarget) {
        showNotification('Please select a user for private audio call', 'warning');
        return;
    }

    if (currentChatType === 'group' && !currentChatTarget) {
        showNotification('Please select a group for group audio call', 'warning');
        return;
    }

    // Determine chat ID to pass to audio server
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

    if (!confirm(`Start audio call in ${chatTypeDisplay}?`)) {
        return;
    }

    console.log(`[AUDIO] Starting ${currentChatType} audio call with chat_id: ${chatId}`);

    try {
        const result = await eel.start_audio_call(currentChatType, chatId)();

        if (result.success) {
            // Open audio call window immediately
            window.open(`${result.link}?username=${encodeURIComponent(username)}`, 'audio_call', 'width=600,height=500');
            showNotification('Audio call started!', 'success');

            // Note: The audio invite message will be displayed when the server broadcasts it back
        } else {
            showNotification(`Failed to start call: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('[AUDIO] Error starting audio call:', error);
        showNotification('Error starting audio call', 'error');
    }
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
            // Open video call window immediately
            window.open(`${result.link}?username=${encodeURIComponent(username)}`, 'video_call', 'width=1200,height=800');
            showNotification('Video call started!', 'success');

            // Note: The video invite message will be displayed when the server broadcasts it back
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

        // Create and show the recording UI (matching comic book theme)
        const recordingUI = document.createElement('div');
        recordingUI.id = 'recordingUI';
        recordingUI.innerHTML = `
            <div style="
                position: absolute;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: #1a1a1a;
                border: 2px solid #c62828;
                border-radius: 16px;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                gap: 15px;
                box-shadow: 0 4px 16px rgba(198, 40, 40, 0.4), 0 0 30px rgba(198, 40, 40, 0.2);
                z-index: 10001;
                animation: slideUp 0.3s ease-out;
            ">
                <div style="
                    width: 14px;
                    height: 14px;
                    background: #c62828;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                    box-shadow: 0 0 15px rgba(198, 40, 40, 0.8);
                "></div>
                <span id="recordingTime" style="
                    color: #00d4ff;
                    font-family: 'Rajdhani', monospace, sans-serif;
                    font-weight: 700;
                    font-size: 20px;
                    min-width: 60px;
                    text-shadow: 0 0 8px rgba(0, 212, 255, 0.6);
                ">0:00</span>
                <button id="stopRecording" style="
                    background: linear-gradient(135deg, #c62828, #a01e1e);
                    border: 1px solid #ff3333;
                    border-radius: 10px;
                    padding: 10px 24px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: 'Rajdhani', sans-serif;
                    font-weight: 700;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    box-shadow: 0 3px 10px rgba(198, 40, 40, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2);
                ">⏹ Stop</button>
            </div>
        `;
        // Append to chat-area instead of body
        const chatArea = document.querySelector('.chat-area');
        if (chatArea) {
            chatArea.appendChild(recordingUI);
        } else {
            document.body.appendChild(recordingUI);
        }

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
        <div class="audio-preview-modal">
            <div class="audio-preview-title">🎤 Audio Message</div>
            <audio id="audioPreviewPlayer" controls class="audio-preview-player"></audio>
            <div class="audio-preview-buttons">
                <button id="discardAudio" class="modal-btn cancel">🗑️ Discard</button>
                <button id="sendAudio" class="modal-btn create">📤 Send</button>
            </div>
        </div>
    `;
    // Append to chat-area instead of body
    const chatArea = document.querySelector('.chat-area');
    if (chatArea) {
        chatArea.appendChild(previewUI);
    } else {
        document.body.appendChild(previewUI);
    }

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
        console.log('🎤 SEND AUDIO CLICKED');
        console.log(`📊 Current chat: ${currentChatType} -> ${currentChatTarget}`);
        console.log(`⏱️ Recording duration: ${recordingDuration}s`);

        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            console.log(`📦 Audio data size: ${base64Audio.length} characters`);

            try {
                // Send the audio message based on current chat type
                if (currentChatType === 'private' && currentChatTarget) {
                    console.log(`📤 Sending private audio to: ${currentChatTarget}`);
                    await eel.send_message('private_audio', base64Audio, {
                        receiver: currentChatTarget,
                        audio_data: base64Audio,
                        duration: recordingDuration
                    })();
                } else if (currentChatType === 'group' && currentChatTarget) {
                    console.log(`📤 Sending group audio to: ${currentChatTarget}`);
                    await eel.send_message('group_audio', base64Audio, {
                        group_id: currentChatTarget,
                        audio_data: base64Audio,
                        duration: recordingDuration
                    })();
                } else {
                    console.log(`📤 Sending global audio message`);
                    console.log(`📤 Audio data length: ${base64Audio.length}`);
                    console.log(`📤 Duration: ${recordingDuration}s`);

                    await eel.send_message('audio_share', base64Audio, {
                        audio_data: base64Audio,
                        duration: recordingDuration
                    })();
                }

                console.log('✅ Audio message sent successfully');
                showNotification('🎤 Audio message sent', 'success');

                // Don't add locally - let the server broadcast handle it to avoid duplicates
                // The server will send it back and handleMessage() will add it properly
            } catch (error) {
                console.error('❌ Error sending audio:', error);
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
    modalContent.className = 'modal-content settings-modal';

    modalContent.innerHTML = `
        <div class="settings-header">
            <h3 class="modal-title">Create New Group</h3>
            <button class="close-modal-btn" id="closeGroupModalBtn">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        </div>
        <div class="settings-content">
            <!-- Group Name Section -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54h2.5l3.5-4.36H6.5l3.54 4.36h-2.96l4.42-5.38z"/>
                    </svg>
                    <h4 style="font-size: 18px;">Group Name</h4>
                </div>
                <input type="text" id="newGroupNameInput" placeholder="Enter group name" style="width: 100%; padding: 14px 16px; background: var(--bg-card); border: 3px solid var(--border-main); color: var(--text-bright); border-radius: 10px; font-family: 'Comic Neue', cursive; font-size: 15px; font-weight: 600; margin-bottom: 14px; transition: all var(--transition-fast);">
            </div>
            
            <!-- Group Admin Section -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <h4 style="font-size: 18px;">Group Admin</h4>
                </div>
                <select id="newGroupAdminSelect" style="width: 100%; padding: 14px 16px; background: var(--bg-card); border: 3px solid var(--border-main); color: var(--text-bright); border-radius: 10px; font-family: 'Comic Neue', cursive; font-size: 15px; font-weight: 600; cursor: pointer; transition: all var(--transition-fast);">
                    <option value="${username}">${username} (You)</option>
                    ${users.map(u => `<option value="${u}">${u}</option>`).join('')}
                </select>
            </div>
            
            <!-- Members Section -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    <h4 style="font-size: 18px;">Select Members</h4>
                </div>
                <div class="user-select-list">
                    ${users.map(user => `
                        <div class="user-checkbox">
                            <input type="checkbox" value="${user}" id="user_${user}">
                            <label for="user_${user}" style="font-size: 15px;">${user}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div style="display: flex; gap: 14px; justify-content: flex-end; margin-top: 24px; padding-top: 24px; border-top: 3px solid var(--border-main);">
            <button class="modal-btn cancel" id="cancelBtn" style="padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all var(--transition-fast); text-transform: uppercase; font-family: 'Bangers', cursive; background: var(--bg-card); border: 3px solid var(--border-main); color: var(--text-muted);">Cancel</button>
            <button class="modal-btn create" id="createBtn" style="padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all var(--transition-fast); text-transform: uppercase; font-family: 'Bangers', cursive; background: var(--accent-cyan); border: none; color: var(--bg-deep);">Create Group</button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    document.getElementById('closeGroupModalBtn').onclick = () => modal.remove();
    document.getElementById('cancelBtn').onclick = () => modal.remove();

    // Prevent multiple clicks
    let isCreating = false;

    document.getElementById('createBtn').onclick = async () => {
        if (isCreating) {
            console.log('⚠️ Group creation already in progress...');
            return;
        }

        const groupNameInput = document.getElementById('newGroupNameInput');
        const groupName = groupNameInput.value.trim();
        const admin = document.getElementById('newGroupAdminSelect').value;
        const checkboxes = document.querySelectorAll('.user-select-list input[type="checkbox"]:checked');
        const members = Array.from(checkboxes).map(cb => cb.value);

        console.log(`📝 CREATE GROUP - Group name: "${groupName}"`);
        console.log(`👑 Admin: ${admin}`);
        console.log(`👥 Selected members: ${members.join(', ')}`);

        if (!groupName) {
            console.log(`❌ Group name is empty!`);
            groupNameInput.style.border = '2px solid #c62828';
            groupNameInput.focus();
            showNotification('Please enter a group name', 'error');
            return;
        }
        if (members.length === 0) {
            showNotification('Select at least one member', 'warning');
            return;
        }

        isCreating = true;

        members.push(admin);
        const uniqueMembers = [...new Set(members)];

        try {
            // DON'T generate group ID on client - let server create it
            // Just send the group creation request
            await eel.send_message('group_create', `Created group: ${groupName}`, {
                group_name: groupName,
                members: uniqueMembers,
                admin: admin
            })();

            console.log(`✅ Group creation request sent: ${groupName}`);
            console.log(`👥 Members: ${uniqueMembers.join(', ')}`);

            showNotification(`Group "${groupName}" created`, 'success');

            // Server will broadcast group_list with the new group
            // which will automatically update the UI and save to localStorage
            console.log('⏳ Waiting for server to broadcast group...');
        } catch (error) {
            console.error('❌ Error creating group:', error);
            showNotification('Failed to create group', 'error');
        } finally {
            modal.remove();
            isCreating = false;
        }
    };
}

// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`.tab-content[data-tab="${tab}"]`).classList.add('active');
    });
});

if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener('click', () => {
        eel.refresh_user_list()();
    });
}




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
                    const newCount = Math.max(0, filteredMessages.length - oldLength);
                    if (newCount > 0) {
                        showNotification(`Loaded ${newCount} new messages`, 'info');
                    }
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

// Optimized polling with smart intervals and backoff
let pollInterval = 3000; // Start with 3s
let lastActivityTime = Date.now();
let isUserActive = true;

// Track user activity for smart polling
function trackUserActivity() {
    lastActivityTime = Date.now();
    isUserActive = true;

    // Reset to fast polling when user is active
    if (pollInterval > 3000) {
        pollInterval = 3000;
        resetPollingInterval();
    }
}

// Add activity listeners
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
    document.addEventListener(event, trackUserActivity, { passive: true });
});

// Main optimized polling function
function pollForData() {
    console.log('===== STARTING OPTIMIZED POLLING =====');

    // Initial refresh
    refreshChatData();

    // Set up adaptive polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    // Smart polling with adaptive intervals
    pollingInterval = setInterval(() => {
        // Only poll if tab is visible
        if (document.hidden) return;

        const timeSinceActivity = Date.now() - lastActivityTime;

        // Adaptive polling intervals based on user activity
        if (timeSinceActivity < 30000) { // 30s
            pollInterval = 3000; // Fast: 3s when active
        } else if (timeSinceActivity < 300000) { // 5m
            pollInterval = 10000; // Medium: 10s when idle
        } else {
            pollInterval = 30000; // Slow: 30s when inactive
        }

        // Only refresh if we need to (smart debouncing)
        const shouldRefresh =
            isUserActive ||
            timeSinceActivity < 60000 || // Always refresh within 1m of activity
            Math.random() < 0.3; // Occasionally refresh when inactive

        if (shouldRefresh) {
            refreshChatData(false); // Don't force refresh unless necessary
        }

        isUserActive = false; // Reset until next activity
    }, pollInterval);

    // Immediate refresh when tab becomes visible
    const handleVisibilityChange = () => {
        if (!document.hidden) {
            trackUserActivity(); // Mark as active
            refreshChatData(false); // Quick refresh on focus
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
window.addEventListener('beforeunload', function () {
    // Clean disconnect when closing
    stopPolling();
    if (typeof eel !== 'undefined') {
        eel.disconnect();
    }
});

// ===== SETTINGS =====
document.addEventListener('DOMContentLoaded', function () {
    // Open settings modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            // Use setTimeout to ensure the modal opens after the current event cycle
            setTimeout(() => {
                settingsModal.style.display = 'flex';
                console.log('Settings modal opened');

                // THIS IS THE FIX - Call addMessageMenuButtons when settings opens
                // This suggests the buttons weren't being created properly before
                console.log('🔧 Calling addMessageMenuButtons from settings modal');
                addMessageMenuButtons();
            }, 0);
        });
    }

    // Close settings modal
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            settingsModal.style.display = 'none';
            console.log('Settings modal closed');
        });
    }

    // Close modal when clicking outside
    if (settingsModal) {
        settingsModal.addEventListener('click', function (e) {
            e.stopPropagation(); // Prevent event from bubbling to document
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });
    }

    // Theme switching is handled by the enhanced theme system below

    // Theme loading is handled by the enhanced theme system below

    // Settings toggles
    // Remove duplicate variable declarations in DOMContentLoaded
    // notificationsToggle, soundsToggle, onlineStatusToggle are already declared above

    if (notificationsToggle) {
        if (localStorage.getItem('notifications') === 'false') {
            notificationsToggle.checked = false;
        }

        notificationsToggle.addEventListener('change', function () {
            localStorage.setItem('notifications', this.checked);
            console.log('Notifications:', this.checked);
        });
    }

    if (soundsToggle) {
        if (localStorage.getItem('sounds') === 'false') {
            soundsToggle.checked = false;
        }

        soundsToggle.addEventListener('change', function () {
            localStorage.setItem('sounds', this.checked);
            console.log('Sounds:', this.checked);
        });
    }

    if (onlineStatusToggle) {
        if (localStorage.getItem('onlineStatus') === 'false') {
            onlineStatusToggle.checked = false;
        }

        onlineStatusToggle.addEventListener('change', function () {
            localStorage.setItem('onlineStatus', this.checked);
            console.log('Online status:', this.checked);
        });
    }

    // Enhanced Settings Implementation
    const autoSaveToggle = document.getElementById('autoSaveToggle');
    const enterToSendToggle = document.getElementById('enterToSendToggle');
    const timestampsToggle = document.getElementById('timestampsToggle');
    const emojiReactionsToggle = document.getElementById('emojiReactionsToggle');
    const reduceAnimationsToggle = document.getElementById('reduceAnimationsToggle');
    const messageLimitSelect = document.getElementById('messageLimitSelect');

    // Auto-save toggle
    if (autoSaveToggle) {
        if (localStorage.getItem('autoSave') === 'false') {
            autoSaveToggle.checked = false;
        }
        autoSaveToggle.addEventListener('change', function () {
            localStorage.setItem('autoSave', this.checked);
            console.log('Auto-save:', this.checked);
        });
    }

    // Enter to send toggle
    if (enterToSendToggle) {
        if (localStorage.getItem('enterToSend') === 'false') {
            enterToSendToggle.checked = false;
        }
        enterToSendToggle.addEventListener('change', function () {
            localStorage.setItem('enterToSend', this.checked);
            console.log('Enter to send:', this.checked);
        });
    }

    // Timestamps toggle
    if (timestampsToggle) {
        if (localStorage.getItem('showTimestamps') === 'false') {
            timestampsToggle.checked = false;
        }
        timestampsToggle.addEventListener('change', function () {
            localStorage.setItem('showTimestamps', this.checked);
            console.log('Show timestamps:', this.checked);
            // Apply timestamp visibility immediately
            document.body.classList.toggle('hide-timestamps', !this.checked);
        });
        // Apply initial state
        if (localStorage.getItem('showTimestamps') === 'false') {
            document.body.classList.add('hide-timestamps');
        }
    }

    // Emoji reactions toggle
    if (emojiReactionsToggle) {
        if (localStorage.getItem('emojiReactions') === 'false') {
            emojiReactionsToggle.checked = false;
        }
        emojiReactionsToggle.addEventListener('change', function () {
            localStorage.setItem('emojiReactions', this.checked);
            console.log('Emoji reactions:', this.checked);
        });
    }

    // Reduce animations toggle
    if (reduceAnimationsToggle) {
        if (localStorage.getItem('reduceAnimations') === 'true') {
            reduceAnimationsToggle.checked = true;
            document.body.classList.add('reduce-animations');
        }
        reduceAnimationsToggle.addEventListener('change', function () {
            localStorage.setItem('reduceAnimations', this.checked);
            document.body.classList.toggle('reduce-animations', this.checked);
            console.log('Reduce animations:', this.checked);
        });
    }

    // Message limit select
    if (messageLimitSelect) {
        const savedLimit = localStorage.getItem('messageLimit') || '500';
        messageLimitSelect.value = savedLimit;
        messageLimitSelect.addEventListener('change', function () {
            localStorage.setItem('messageLimit', this.value);
            console.log('Message limit:', this.value);
        });
    }

    // Enhanced theme handling with new themes
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        option.addEventListener('click', function () {
            const theme = this.dataset.theme;

            // Remove active class from all options
            themeOptions.forEach(opt => opt.classList.remove('active'));

            // Add active class to clicked option
            this.classList.add('active');

            // Remove all theme classes
            document.body.classList.remove('theme-alt', 'theme-orange', 'theme-green');

            // Apply new theme
            if (theme === 'alt') {
                document.body.classList.add('theme-alt');
            } else if (theme === 'orange') {
                document.body.classList.add('theme-orange');
            } else if (theme === 'green') {
                document.body.classList.add('theme-green');
            }

            // Save theme preference
            localStorage.setItem('selectedTheme', theme);
            console.log('Theme changed to:', theme);
        });
    });

    // Load saved theme on startup
    const savedTheme = localStorage.getItem('selectedTheme') || 'alt';
    
    // Remove all theme classes first
    document.body.classList.remove('theme-default', 'theme-alt', 'theme-orange', 'theme-green');
    
    // Apply the saved theme
    if (savedTheme !== 'default') {
        document.body.classList.add(`theme-${savedTheme}`);
    }
    
    // Update active button
    const savedOption = document.querySelector(`[data-theme="${savedTheme}"]`);
    if (savedOption) {
        themeOptions.forEach(opt => opt.classList.remove('active'));
        savedOption.classList.add('active');
    }
});

// ===== UTILITY FUNCTIONS =====
eel.expose(onDisconnected);
function onDisconnected() {
    console.log('[DISCONNECT] Server connection lost');
    showNotification('⚠️ Server disconnected. Please reconnect.', 'error');
    
    // Immediately go back to login screen without spinner
    const spinner = document.getElementById('fullScreenSpinner');
    const spinnerSubtitle = spinner.querySelector('.spinner-subtitle');
    
    // Ensure spinner is hidden
    spinner.classList.remove('active');
    
    // Hide main app and show login screen
    mainApp.classList.remove('active');
    loginScreen.classList.add('active');
    
    // Reset login button
    loginBtn.disabled = false;
    loginBtn.textContent = 'CONNECT';
    
    // Reset spinner subtitle for next connection
    if (spinnerSubtitle) {
        spinnerSubtitle.textContent = 'Connecting to Shadow Network...';
    }
    
    // Clear any stored state
    localStorage.removeItem('currentUsername');
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

// Duplicate showNotification function removed - using original one

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

function showAudioPlayback(audioData, duration, sender) {
    const playbackUI = document.createElement('div');
    playbackUI.id = 'audioPlayback';
    playbackUI.innerHTML = `
        <div class="audio-playback-modal">
            <div class="audio-playback-title">🎵 Audio Message</div>
            <div class="audio-playback-info">From: ${sender} • ${duration}s</div>
            <audio id="audioPlaybackPlayer" controls class="audio-playback-player"></audio>
            <div class="audio-playback-buttons">
                <button id="closeAudioPlayback" class="modal-btn cancel">✕ Close</button>
            </div>
        </div>
    `;
    // Append to messagesContainer to center within chat area
    messagesContainer.appendChild(playbackUI);

    // Set up the audio playback
    const audioPlayer = document.getElementById('audioPlaybackPlayer');
    const audioURL = `data:audio/wav;base64,${audioData}`;
    audioPlayer.src = audioURL;
    audioPlayer.style.background = 'var(--bg-card)';

    // Auto-play the audio
    audioPlayer.play().catch(e => {
        console.warn('Audio autoplay prevented:', e);
    });

    // Handle close button
    document.getElementById('closeAudioPlayback').onclick = () => {
        audioPlayer.pause();
        playbackUI.remove();
        URL.revokeObjectURL(audioURL);
    };

    // Auto-close when audio ends
    audioPlayer.onended = () => {
        setTimeout(() => {
            playbackUI.remove();
            URL.revokeObjectURL(audioURL);
        }, 1000);
    };

    // Close on escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            audioPlayer.pause();
            playbackUI.remove();
            URL.revokeObjectURL(audioURL);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatTimeWithoutSeconds(timestamp) {
    if (!timestamp) return getCurrentTime();
    // Handle various timestamp formats
    if (timestamp.includes(':')) {
        const parts = timestamp.split(':');
        return parts[0] + ':' + parts[1]; // Remove seconds
    }
    return timestamp;
}

// Get date string from timestamp (e.g., "Wednesday 17-10-25")
function getDateFromTimestamp(timestamp) {
    try {
        let dateObj;
        
        if (!timestamp) {
            dateObj = new Date();
        } else {
            // Try to parse different timestamp formats
            if (timestamp.includes('T')) {
                // ISO format
                dateObj = new Date(timestamp);
            } else if (timestamp.match(/^\d{4}-\d{2}-\d{2}/)) {
                // New format: "2025-10-28 03:56 PM"
                dateObj = new Date(timestamp);
            } else if (timestamp.includes('-') && timestamp.includes(':')) {
                // Date with time format
                dateObj = new Date(timestamp);
            } else if (timestamp.includes(':')) {
                // Time only format like "03:56 AM" - assume today's date
                const today = new Date();
                const parts = timestamp.split(/\s+/);
                const timePart = parts[0];
                const period = parts[1];
                
                const [hours, minutes] = timePart.split(':').map(Number);
                
                let hour24 = hours;
                if (period && period.toUpperCase() === 'PM' && hours !== 12) {
                    hour24 += 12;
                } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
                    hour24 = 0;
                }
                
                dateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour24, minutes);
            } else {
                // Fallback to current date
                dateObj = new Date();
            }
        }
        
        // Validate the date
        if (isNaN(dateObj.getTime())) {
            dateObj = new Date();
        }
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[dateObj.getDay()];
        const date = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const year = dateObj.getFullYear().toString().slice(-2);
        
        return `${dayName} ${date}-${month}-${year}`;
    } catch (e) {
        console.log('Error parsing timestamp:', timestamp, e);
        // Fallback to current date
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[now.getDay()];
        const date = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear().toString().slice(-2);
        return `${dayName} ${date}-${month}-${year}`;
    }
}

// Reset date tracker when switching chats
function resetDateTracker() {
    lastMessageDate = null;
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
    console.log(`📋 CONTEXT MENU: Showing menu for user ${user}`);
    event.preventDefault();
    event.stopPropagation();

    const menu = document.getElementById('chatContextMenu');
    if (!menu) {
        console.error('❌ Chat context menu not found!');
        return;
    }

    console.log(`✅ Menu found, positioning...`);

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

    // CRITICAL FIX: Move menu to end of body to escape any clipping
    document.body.appendChild(menu);

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.classList.add('show');
    menu.dataset.user = user;

    console.log(`✅ Menu shown at position (${posX}, ${posY}) for user ${user}`);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

function showMessageContextMenu(event, messageElement) {
    console.log('🎯 showMessageContextMenu called!');
    console.log('📋 Event:', event);
    console.log('📋 Message element:', messageElement);

    event.preventDefault();
    event.stopPropagation();

    // Hide any existing context menus
    document.querySelectorAll('.context-menu').forEach(menu => {
        menu.classList.remove('show');
    });

    const menu = document.getElementById('messageContextMenu');
    console.log('📋 Menu element found:', menu);
    if (!menu) {
        console.error('❌ messageContextMenu not found!');
        return;
    }

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

    // CRITICAL FIX: Move menu to end of body to escape any clipping
    document.body.appendChild(menu);

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.classList.add('show');
    menu.dataset.messageId = messageElement.dataset.messageId;

    console.log('✅ Menu should now be visible with class "show"');
    console.log('📋 Menu display:', window.getComputedStyle(menu).display);
    console.log('📋 Menu position:', menu.style.left, menu.style.top);
    console.log('📋 Menu z-index:', window.getComputedStyle(menu).zIndex);
    console.log('📋 Menu parent:', menu.parentElement);

    // Close menu when clicking outside - with proper delay to avoid immediate closure
    setTimeout(() => {
        const closeMenu = (e) => {
            // Don't close if clicking on the menu itself or a message menu button
            if (!menu.contains(e.target) && !e.target.closest('.message-menu-btn')) {
                console.log('🚪 Closing menu due to outside click');
                menu.classList.remove('show');
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 200); // Increased delay to prevent immediate closure
}

// Handle context menu actions - Enhanced with better event handling
document.addEventListener('click', (e) => {
    console.log(`🖱️ Document click detected on:`, e.target);

    const contextMenuItem = e.target.closest('.context-menu-item');
    if (contextMenuItem) {
        e.preventDefault();
        e.stopPropagation();

        console.log(`🖱️ CONTEXT MENU ITEM CLICKED`);
        console.log(`🖱️ Target element:`, e.target);
        console.log(`🖱️ Closest context-menu-item:`, contextMenuItem);

        const action = contextMenuItem.getAttribute('data-action');
        const menu = contextMenuItem.closest('.context-menu');

        console.log(`📋 Action: ${action}, Menu ID: ${menu ? menu.id : 'NO MENU FOUND'}`);
        console.log(`📋 Menu dataset:`, menu ? menu.dataset : 'NO DATASET');

        if (!action || !menu) {
            console.error('❌ Missing action or menu!');
            return;
        }

        if (menu.id === 'chatContextMenu') {
            console.log(`✅ Handling chat context action: ${action} for user ${menu.dataset.user}`);
            handleChatContextAction(action, menu.dataset.user);
            menu.classList.remove('show');
        } else if (menu.id === 'groupContextMenu') {
            console.log(`✅ Handling group context action: ${action}`);
            handleGroupContextAction(action);
            menu.classList.remove('show');
        } else if (menu.id === 'messageContextMenu') {
            console.log(`✅ Handling message context action: ${action}`);
            console.log(`✅ Message ID from menu dataset: ${menu.dataset.messageId}`);

            handleMessageContextAction(action, menu.dataset.messageId);

            // Don't close menu immediately for emoji action to allow picker to open
            if (action !== 'emoji') {
                menu.classList.remove('show');
            } else {
                // Close menu after a delay for emoji action
                setTimeout(() => {
                    menu.classList.remove('show');
                }, 50);
            }
        }
    }
}, true); // Use capture phase to ensure we catch the event first

function handleChatContextAction(action, user) {
    console.log(`🚀 EXECUTING ACTION: ${action} for user ${user}`);
    switch (action) {
        case 'archive':
            console.log(`📦 CALLING archiveChat for ${user}`);
            archiveChat(user);
            break;
        case 'delete-chat':
            console.log(`🗑️ CALLING deleteChat for ${user}`);
            deleteChat(user);
            break;
        default:
            console.log(`❌ Unknown action: ${action}`);
    }
    console.log(`✅ ACTION ${action} COMPLETED for ${user}`);
}

function handleMessageContextAction(action, messageId) {
    console.log(`🎯 handleMessageContextAction called with action: ${action}, messageId: ${messageId}`);

    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) {
        console.log(`❌ No message element found for ID: ${messageId}`);
        return;
    }

    console.log(`✅ Found message element:`, messageElement);

    switch (action) {
        case 'reply':
            console.log(`📤 Calling replyToMessage`);
            replyToMessage(messageElement);
            break;
        case 'emoji':
            console.log(`😀 Calling showEmojiReactionPicker`);
            showEmojiReactionPicker(messageElement);
            break;
        case 'copy':
            console.log(`📋 Calling copyMessage`);
            copyMessage(messageElement);
            break;
        case 'forward':
            console.log(`➡️ Calling forwardMessage`);
            forwardMessage(messageElement);
            break;
        case 'delete':
            console.log(`🗑️ Calling deleteMessage`);
            deleteMessage(messageElement);
            break;
        case 'select':
            console.log(`✅ Calling selectMessage`);
            selectMessage(messageElement);
            break;
        case 'share':
            console.log(`📤 Calling shareMessage`);
            shareMessage(messageElement);
            break;
        default:
            console.log(`❌ Unknown action: ${action}`);
    }
}

// ===== GROUP CONTEXT MENU =====
let currentGroupContext = {
    id: null,
    name: null,
    members: [],
    admin: null
};

function showGroupContextMenu(event, groupId, groupName, members, admin) {
    console.log(`📋 GROUP CONTEXT MENU: Showing menu for group ${groupName}`);
    event.preventDefault();
    event.stopPropagation();

    const menu = document.getElementById('groupContextMenu');
    if (!menu) {
        console.error('❌ Group context menu not found!');
        return;
    }

    // Store group context
    currentGroupContext = {
        id: groupId,
        name: groupName,
        members: Array.isArray(members) ? members : [],
        admin: admin
    };

    console.log(`✅ Group context stored:`, currentGroupContext);

    // Calculate menu position
    const menuHeight = 150;
    const menuWidth = 180;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    let posX = event.pageX;
    let posY = event.pageY;

    if (posY + menuHeight > windowHeight - 20) {
        posY = windowHeight - menuHeight - 20;
    }

    if (posX + menuWidth > windowWidth - 20) {
        posX = windowWidth - menuWidth - 20;
    }

    // CRITICAL FIX: Move menu to end of body to escape any clipping
    document.body.appendChild(menu);

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.classList.add('show');

    console.log(`✅ Menu shown at position (${posX}, ${posY})`);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

function handleGroupContextAction(action) {
    console.log(`🚀 GROUP ACTION: ${action} for group ${currentGroupContext.name}`);

    switch (action) {
        case 'settings':
            openGroupSettings();
            break;
        case 'leave':
            leaveGroup();
            break;
        case 'delete-group':
            deleteGroup();
            break;
        default:
            console.log(`❌ Unknown group action: ${action}`);
    }
}

function openGroupSettings() {
    console.log('📂 openGroupSettings called');
    console.log('Current group context:', currentGroupContext);

    const modal = document.getElementById('groupSettingsModal');
    const titleEl = document.getElementById('groupSettingsTitle');
    const nameInput = document.getElementById('groupNameInput');
    const adminSelect = document.getElementById('newAdminSelect');
    const kickSelect = document.getElementById('kickUserSelect');

    if (!modal) {
        console.error('❌ Modal not found!');
        return;
    }

    console.log('📝 Setting modal content...');
    titleEl.textContent = `${currentGroupContext.name} Settings`;
    nameInput.value = currentGroupContext.name;

    // Populate admin select
    adminSelect.innerHTML = '<option value="">Select new admin...</option>';
    currentGroupContext.members.forEach(member => {
        if (member !== username) {
            const option = document.createElement('option');
            option.value = member;
            option.textContent = member;
            adminSelect.appendChild(option);
        }
    });

    // Populate kick select
    kickSelect.innerHTML = '<option value="">Select user to kick...</option>';
    currentGroupContext.members.forEach(member => {
        if (member !== username) {
            const option = document.createElement('option');
            option.value = member;
            option.textContent = member;
            kickSelect.appendChild(option);
        }
    });

    console.log('✅ Displaying modal...');
    modal.style.display = 'flex';
    console.log('Modal display set to:', modal.style.display);
}

function closeGroupSettings() {
    document.getElementById('groupSettingsModal').style.display = 'none';
}

function changeGroupName() {
    const newName = document.getElementById('groupNameInput').value.trim();
    if (!newName) {
        showNotification('Please enter a group name', 'error');
        return;
    }

    console.log(`📝 Changing group name to: ${newName}`);

    // Update persistent groups
    if (persistentGroups[currentGroupContext.id]) {
        persistentGroups[currentGroupContext.id].name = newName;
        saveGroupsToLocalStorage();
    }

    currentGroupContext.name = newName;
    showNotification(`Group name changed to "${newName}"`, 'success');
    closeGroupSettings();

    // Refresh groups list
    updateGroupsList();
}

function changeGroupAdmin() {
    const newAdmin = document.getElementById('newAdminSelect').value;
    if (!newAdmin) {
        showNotification('Please select a new admin', 'error');
        return;
    }

    // Check if current user is admin
    if (currentGroupContext.admin !== username) {
        showNotification('Only admin can transfer admin rights', 'error');
        return;
    }

    console.log(`👑 Transferring admin to: ${newAdmin}`);

    // Update persistent groups
    if (persistentGroups[currentGroupContext.id]) {
        persistentGroups[currentGroupContext.id].admin = newAdmin;
        saveGroupsToLocalStorage();
    }

    currentGroupContext.admin = newAdmin;
    showNotification(`Admin transferred to ${newAdmin}`, 'success');
    closeGroupSettings();
}

function kickUser() {
    const userToKick = document.getElementById('kickUserSelect').value;
    if (!userToKick) {
        showNotification('Please select a user to kick', 'error');
        return;
    }

    // Check if current user is admin
    if (currentGroupContext.admin !== username) {
        showNotification('Only admin can kick users', 'error');
        return;
    }

    if (!confirm(`Kick ${userToKick} from the group?`)) {
        return;
    }

    console.log(`🚫 Kicking user: ${userToKick}`);

    // Remove from members
    const index = currentGroupContext.members.indexOf(userToKick);
    if (index > -1) {
        currentGroupContext.members.splice(index, 1);
    }

    // Update persistent groups
    if (persistentGroups[currentGroupContext.id]) {
        persistentGroups[currentGroupContext.id].members = currentGroupContext.members;
        saveGroupsToLocalStorage();
    }

    showNotification(`${userToKick} has been kicked from the group`, 'success');
    closeGroupSettings();
}

function leaveGroup() {
    if (!confirm(`Leave "${currentGroupContext.name}"?`)) {
        return;
    }

    console.log(`🚪 Leaving group: ${currentGroupContext.name}`);

    // Remove from persistent groups
    delete persistentGroups[currentGroupContext.id];
    saveGroupsToLocalStorage();

    // Remove from chat histories
    delete chatHistories.group[currentGroupContext.id];

    // Remove from UI
    const groupItem = document.querySelector(`.chat-item[data-group-id="${currentGroupContext.id}"]`);
    if (groupItem) {
        groupItem.remove();
    }

    // If this was the current chat, switch to global
    if (currentChatType === 'group' && currentChatTarget === currentGroupContext.id) {
        globalNetworkItem.click();
    }

    showNotification(`Left "${currentGroupContext.name}"`, 'success');
    updateGroupsList();
}

function deleteGroup() {
    // Check if current user is admin
    if (currentGroupContext.admin !== username) {
        showNotification('Only admin can delete the group', 'error');
        return;
    }

    if (!confirm(`Delete "${currentGroupContext.name}"? This action cannot be undone.`)) {
        return;
    }

    console.log(`🗑️ Deleting group: ${currentGroupContext.name}`);

    // Remove from persistent groups
    delete persistentGroups[currentGroupContext.id];
    saveGroupsToLocalStorage();

    // Remove from chat histories
    delete chatHistories.group[currentGroupContext.id];

    // Remove from UI
    const groupItem = document.querySelector(`.chat-item[data-group-id="${currentGroupContext.id}"]`);
    if (groupItem) {
        groupItem.remove();
    }

    // If this was the current chat, switch to global
    if (currentChatType === 'group' && currentChatTarget === currentGroupContext.id) {
        globalNetworkItem.click();
    }

    showNotification(`Group "${currentGroupContext.name}" deleted`, 'success');
    updateGroupsList();
}

// Context menu action implementations
function archiveChat(user) {
    console.log(`📦 archiveChat called for user: ${user}`);

    const confirmed = confirm(`Archive chat with ${user}?`);
    if (!confirmed) return;

    // Mark as archived in state
    archivedChats.add(user);

    // Save archived state to localStorage
    try {
        localStorage.setItem('archivedChats', JSON.stringify(Array.from(archivedChats)));
    } catch (e) {
        console.error('Failed to save archived chats:', e);
    }

    console.log(`📦 ARCHIVING: ${user}`);

    // Remove chat item from UI
    const chatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
    if (chatItem) {
        chatItem.remove();
        console.log(`✅ Removed ${user} from private chats`);
    }

    // If this was the current chat, switch to global
    if (currentChatType === 'private' && currentChatTarget === user) {
        globalNetworkItem.click();
    }

    // Move to active if online
    const usersList = document.getElementById('usersList');
    const activeUsersList = document.getElementById('activeUsersList');
    const activeUsersSection = document.getElementById('activeUsersSection');
    const activeUsersCount = document.getElementById('activeUsersCount');

    const isUserOnline = allUsers && allUsers.includes(user);
    console.log(`🔍 ARCHIVE: Is ${user} online? ${isUserOnline}`);

    if (isUserOnline) {
        console.log(`✅ ARCHIVE: User ${user} is ONLINE, moving to active`);

        if (!document.querySelector(`.active-user-item[data-user="${user}"]`)) {
            activeUsersSection.style.display = 'block';

            const userItem = document.createElement('div');
            userItem.className = 'active-user-item';
            userItem.dataset.user = user;
            userItem.onclick = () => switchToPrivateChat(user);

            userItem.innerHTML = `
                <div class="active-user-avatar">${user.charAt(0).toUpperCase()}</div>
                <div class="active-user-info">
                    <div class="active-user-name">${user}</div>
                    <div class="active-user-status">Online</div>
                </div>
            `;

            activeUsersList.appendChild(userItem);
            activeUsersCount.textContent = activeUsersList.children.length;
            console.log(`✅ ARCHIVE: Added ${user} to active users`);
        }
    }

    // Show "no users" message if empty
    if (usersList.children.length === 0) {
        const noUsersMsg = document.getElementById('noUsersMsg');
        if (noUsersMsg) {
            noUsersMsg.style.display = 'block';
        }
    }

    showNotification(`Chat with ${user} archived`, 'success');
}

function deleteChat(user) {
    console.log(`🗑️ deleteChat called for user: ${user}`);

    const confirmed = confirm(`Delete chat with ${user}? This action cannot be undone.`);
    if (!confirmed) return;

    console.log(`🗑️ DELETING: ${user}`);

    // Delete from server JSON file
    eel.send_message('delete_user_chat', '', {
        sender: username,
        target_user: user
    })().then(() => {
        console.log(`✅ Server delete request sent for: ${user}`);
    }).catch(err => {
        console.error(`❌ Failed to send delete request to server: ${err}`);
    });

    // Delete chat history from frontend
    delete chatHistories.private[user];
    
    // Clear unread count for this user
    if (unreadCounts.private[user]) {
        delete unreadCounts.private[user];
        updateTotalUnreadCount();
        updateUnreadCountsUI();
    }

    // Remove archived state
    archivedChats.delete(user);

    // Save updated archived state
    try {
        localStorage.setItem('archivedChats', JSON.stringify(Array.from(archivedChats)));
    } catch (e) {
        console.error('Failed to save archived chats:', e);
    }

    // Remove chat item from UI
    const chatItem = document.querySelector(`.chat-item[data-user="${user}"]`);
    if (chatItem) {
        chatItem.remove();
        console.log(`✅ Removed ${user} from private chats`);
    }

    // If this was the current chat, switch to global
    if (currentChatType === 'private' && currentChatTarget === user) {
        globalNetworkItem.click();
    }

    // Move to active if online
    const usersList = document.getElementById('usersList');
    const activeUsersList = document.getElementById('activeUsersList');
    const activeUsersSection = document.getElementById('activeUsersSection');
    const activeUsersCount = document.getElementById('activeUsersCount');

    const isUserOnline = allUsers && allUsers.includes(user);
    console.log(`🔍 DELETE: Is ${user} online? ${isUserOnline}`);

    if (isUserOnline) {
        console.log(`✅ DELETE: User ${user} is ONLINE, moving to active`);

        if (!document.querySelector(`.active-user-item[data-user="${user}"]`)) {
            activeUsersSection.style.display = 'block';

            const userItem = document.createElement('div');
            userItem.className = 'active-user-item';
            userItem.dataset.user = user;
            userItem.onclick = () => switchToPrivateChat(user);

            userItem.innerHTML = `
                <div class="active-user-avatar">${user.charAt(0).toUpperCase()}</div>
                <div class="active-user-info">
                    <div class="active-user-name">${user}</div>
                    <div class="active-user-status">Online</div>
                </div>
            `;

            activeUsersList.appendChild(userItem);
            activeUsersCount.textContent = activeUsersList.children.length;
            console.log(`✅ DELETE: Added ${user} to active users`);
        }
    }

    // Show "no users" message if empty
    if (usersList.children.length === 0) {
        const noUsersMsg = document.getElementById('noUsersMsg');
        if (noUsersMsg) {
            noUsersMsg.style.display = 'block';
        }
    }

    showNotification(`Chat with ${user} deleted`, 'success');
}

function replyToMessage(messageElement) {
    console.log('🎯 Reply to message called!', messageElement);
    showNotification('Reply function called!', 'success');

    const messageBubble = messageElement.querySelector('.message-bubble');
    if (!messageBubble) {
        console.log('❌ No message bubble found');
        return;
    }

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

    console.log('📋 Reply details:', { messageText, sender, messageId });

    if (!messageText || !messageId) {
        console.log('❌ Missing messageText or messageId');
        return;
    }

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
    };
}

function copyMessage(messageElement) {
    console.log('📋 Copy message called!', messageElement);
    showNotification('Copy function called!', 'success');
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
                await eel.send_message('private', `📩 Forwarded: ${messageText}`, { receiver: targetUser })();
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
                        Delete 
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
    console.log('🎨 showEmojiPicker called');
    const pickerModal = document.getElementById('emojiPickerModal');
    if (pickerModal) {
        console.log('✅ Emoji picker modal found, showing');
        pickerModal.style.display = 'flex';
    } else {
        console.error('❌ Emoji picker modal element not found!');
    }
}

function hideEmojiPicker() {
    const pickerModal = document.getElementById('emojiPickerModal');
    if (pickerModal) {
        pickerModal.style.display = 'none';
    }
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

// ===== EMOJI REACTIONS =====
let currentReactionMessageElement = null;

function showEmojiReactionPicker(messageElement) {
    console.log('🎯 showEmojiReactionPicker called with:', messageElement);
    currentReactionMessageElement = messageElement;
    const picker = document.getElementById('emojiReactionPicker');
    console.log('🎯 Picker element found:', picker);
    if (!picker) {
        console.error('❌ emojiReactionPicker element not found!');
        return;
    }

    // Move picker to body to avoid parent container clipping
    if (picker.parentElement !== document.body) {
        document.body.appendChild(picker);
        console.log('✅ Moved emoji picker to document body to avoid clipping');
    }

    const messageRect = messageElement.getBoundingClientRect();

    // Position picker near the message
    picker.style.position = 'fixed';
    picker.style.transform = 'none';

    // Calculate position (above or below message depending on space)
    const pickerHeight = 200; // Approximate height
    const pickerWidth = 280; // Approximate width

    let left = messageRect.left;
    let top = messageRect.top - pickerHeight - 10;

    // If picker would go off top of screen, show below message
    if (top < 10) {
        top = messageRect.bottom + 10;
    }

    // Keep picker within horizontal bounds
    if (left + pickerWidth > window.innerWidth - 10) {
        left = window.innerWidth - pickerWidth - 10;
    }
    if (left < 10) {
        left = 10;
    }

    picker.style.left = left + 'px';
    picker.style.top = top + 'px';
    picker.style.display = 'flex';
    picker.style.flexDirection = 'column';
    picker.style.zIndex = '10001';
    picker.style.backgroundColor = '#2b2d31';
    picker.style.border = '3px solid #00b8d4';
    picker.style.borderRadius = '12px';
    picker.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.8)';
    picker.style.minWidth = '280px';
    picker.style.maxHeight = '250px';
    picker.style.width = '280px';  // Fixed width
    picker.style.height = 'auto';  // Auto height

    // Ensure the emoji grid has proper styling
    const emojiGrid = picker.querySelector('.emoji-grid');
    if (emojiGrid) {
        emojiGrid.style.display = 'grid';
        emojiGrid.style.gridTemplateColumns = 'repeat(6, 1fr)';
        emojiGrid.style.gap = '8px';
        emojiGrid.style.padding = '16px';
    }

    // Ensure the header has proper styling
    const header = picker.querySelector('.emoji-picker-header');
    if (header) {
        header.style.display = 'flex';
        header.style.justifyContent = 'center';
        header.style.alignItems = 'center';
        header.style.padding = '12px 16px';
        header.style.borderBottom = '2px solid #00b8d4';
        header.style.backgroundColor = '#1a1d29';
        header.style.borderRadius = '12px 12px 0 0';
        header.style.fontFamily = 'Comic Neue, cursive';
        header.style.fontWeight = '700';
        header.style.fontSize = '14px';
        header.style.color = '#f2f3f5';
        header.style.textTransform = 'uppercase';
        header.style.letterSpacing = '0.5px';
    }

    // Ensure emoji options have proper styling
    const emojiOptions = picker.querySelectorAll('.emoji-option');
    emojiOptions.forEach(option => {
        option.style.fontSize = '32px';
        option.style.padding = '8px';
        option.style.cursor = 'pointer';
        option.style.borderRadius = '8px';
        option.style.transition = 'all 0.2s ease';
        option.style.display = 'inline-block';
        option.style.userSelect = 'none';
        option.style.textAlign = 'center';
    });

    // Debug: Log computed styles
    const computedStyle = window.getComputedStyle(picker);
    console.log('✅ Emoji reaction picker should now be visible at:', left, top);
    console.log('🎯 Picker computed styles:', {
        display: computedStyle.display,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex,
        left: computedStyle.left,
        top: computedStyle.top,
        width: computedStyle.width,
        height: computedStyle.height,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        background: computedStyle.backgroundColor,
        border: computedStyle.border
    });

    // Close picker when clicking outside - with longer delay to avoid immediate closure
    setTimeout(() => {
        const closePickerHandler = (e) => {
            if (!picker.contains(e.target)) {
                console.log('🚪 Closing emoji reaction picker due to outside click');
                picker.style.display = 'none';
                document.removeEventListener('click', closePickerHandler);
            }
        };
        document.addEventListener('click', closePickerHandler);
    }, 300); // Increased delay to prevent immediate closure
}

function addEmojiReaction(messageElement, emoji) {
    const messageId = messageElement.dataset.messageId;
    if (!messageId) return;

    // Get or create reactions container at message level
    let reactionsContainer = messageElement.querySelector('.message-reactions');
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        // Append to message element itself, not message-content
        messageElement.appendChild(reactionsContainer);
    }

    // Store reactions in localStorage
    const reactions = JSON.parse(localStorage.getItem('messageReactions') || '{}');
    if (!reactions[messageId]) {
        reactions[messageId] = {};
    }
    if (!reactions[messageId][emoji]) {
        reactions[messageId][emoji] = [];
    }

    // Toggle reaction for current user
    const userIndex = reactions[messageId][emoji].indexOf(username);
    if (userIndex > -1) {
        reactions[messageId][emoji].splice(userIndex, 1);
        if (reactions[messageId][emoji].length === 0) {
            delete reactions[messageId][emoji];
        }
    } else {
        reactions[messageId][emoji].push(username);
    }

    localStorage.setItem('messageReactions', JSON.stringify(reactions));

    // Update UI
    renderMessageReactions(messageElement, messageId, reactions[messageId] || {});
}

function renderMessageReactions(messageElement, messageId, reactions) {
    // Find or create reactions container at message level (not in message-content)
    let reactionsContainer = messageElement.querySelector('.message-reactions');
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        // Append to message element itself, not message-content
        messageElement.appendChild(reactionsContainer);
    }

    reactionsContainer.innerHTML = '';

    Object.entries(reactions).forEach(([emoji, users]) => {
        if (users.length > 0) {
            const reactionItem = document.createElement('div');
            reactionItem.className = 'reaction-item';
            if (users.includes(username)) {
                reactionItem.classList.add('own-reaction');
            }

            reactionItem.innerHTML = `
                <span class="reaction-emoji">${emoji}</span>
                <span class="reaction-count">${users.length}</span>
            `;

            reactionItem.title = users.join(', ');
            reactionItem.onclick = (e) => {
                e.stopPropagation();
                showEmojiReactionModal(messageElement, emoji, users, messageId);
            };

            reactionsContainer.appendChild(reactionItem);
        }
    });
}

function showEmojiReactionModal(messageElement, emoji, users, messageId) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'emoji-reaction-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.2s ease;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'emoji-reaction-modal';
    modal.style.cssText = `
        background: linear-gradient(135deg, #252936, #1a1d29);
        border: 3px solid #00b8d4;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0, 184, 212, 0.3);
        animation: scaleIn 0.3s ease;
    `;

    const isOwnReaction = users.includes(username);

    // Create header with emoji
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid rgba(0, 184, 212, 0.3);
    `;
    header.innerHTML = `
        <span style="font-size: 32px; line-height: 1;">${emoji}</span>
        <span style="color: #e4e7f0; font-size: 16px; font-weight: 600;">Reaction</span>
    `;
    modal.appendChild(header);

    // Create users list
    const usersList = document.createElement('div');
    usersList.style.cssText = `
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 16px;
    `;

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px;
            margin-bottom: 6px;
            background: rgba(0, 184, 212, 0.1);
            border-left: 3px solid #00b8d4;
            border-radius: 6px;
            color: #e4e7f0;
            font-size: 14px;
            font-weight: 500;
        `;
        if (user === username) {
            userItem.innerHTML = `
                <span style="font-size: 18px; margin-right: 8px;">👤</span>
                <span>${user}</span>
                <span style="margin-left: auto; color: #00b8d4; font-weight: 600; font-size: 12px;">YOU</span>
            `;
        } else {
            userItem.innerHTML = `
                <span style="font-size: 18px; margin-right: 8px;">👤</span>
                <span>${user}</span>
            `;
        }
        usersList.appendChild(userItem);
    });
    modal.appendChild(usersList);

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    `;

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        color: #e4e7f0;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
        font-family: inherit;
    `;
    closeBtn.onmouseover = () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.15)';
        closeBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        closeBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    };
    closeBtn.onclick = () => {
        overlay.style.animation = 'fadeOut 0.2s ease';
        modal.style.animation = 'scaleOut 0.2s ease';
        setTimeout(() => overlay.remove(), 200);
    };
    buttonsContainer.appendChild(closeBtn);

    // Create remove button (only if user added this reaction)
    if (isOwnReaction) {
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.style.cssText = `
            background: linear-gradient(135deg, #c62828, #8b0000);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s ease;
            font-family: inherit;
            box-shadow: 0 2px 8px rgba(198, 40, 40, 0.3);
        `;
        removeBtn.onmouseover = () => {
            removeBtn.style.transform = 'translateY(-1px)';
            removeBtn.style.boxShadow = '0 4px 12px rgba(198, 40, 40, 0.4)';
        };
        removeBtn.onmouseout = () => {
            removeBtn.style.transform = 'translateY(0)';
            removeBtn.style.boxShadow = '0 2px 8px rgba(198, 40, 40, 0.3)';
        };
        removeBtn.onclick = () => {
            // Remove the reaction
            addEmojiReaction(messageElement, emoji);
            overlay.style.animation = 'fadeOut 0.2s ease';
            modal.style.animation = 'scaleOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
        };
        buttonsContainer.appendChild(removeBtn);
    }

    modal.appendChild(buttonsContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on background click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.style.animation = 'fadeOut 0.2s ease';
            modal.style.animation = 'scaleOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
        }
    };
}

// ===== PINNED MESSAGES =====
function updatePinnedMessagesBar() {
    const pinnedBar = document.getElementById('pinnedMessagesBar');
    const pinnedMessageText = document.getElementById('pinnedMessageText');
    const pinnedMessages = JSON.parse(localStorage.getItem('pinnedMessages') || '{}');

    const pinnedMessageIds = Object.keys(pinnedMessages).filter(id => pinnedMessages[id]);

    if (pinnedMessageIds.length > 0) {
        // Get the first pinned message to display
        const firstPinnedId = pinnedMessageIds[0];
        const messageElement = document.querySelector(`[data-message-id="${firstPinnedId}"]`);

        if (messageElement) {
            const messageBubble = messageElement.querySelector('.message-bubble');
            const messageContent = messageBubble ? messageBubble.textContent : 'Pinned message';
            const sender = messageElement.dataset.sender || 'User';

            pinnedMessageText.textContent = `${sender}: ${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}`;
            pinnedBar.style.display = 'flex';

            // Add click handler to scroll to message
            pinnedMessageText.onclick = () => {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                messageElement.style.background = 'rgba(198, 40, 40, 0.2)';
                setTimeout(() => {
                    messageElement.style.background = '';
                }, 2000);
            };
        }
    } else {
        pinnedBar.style.display = 'none';
    }
}

// ===== SEARCH FUNCTIONALITY =====
function searchUsersAndMessages(query) {
    if (!query.trim()) {
        clearSearch();
        return;
    }

    // Search and reorder users
    searchAndReorderUsers(query);

    // If in a chat, also search messages
    if (currentChatType !== 'global') {
        searchMessages(query);
    }
}

function searchAndReorderUsers(query) {
    const lowerQuery = query.toLowerCase();

    // Get current theme for highlight color
    const currentTheme = document.body.className || 'default';
    let highlightColor;
    if (currentTheme.includes('theme-red')) {
        highlightColor = 'rgba(198, 40, 40, 0.2)'; // Red theme
    } else if (currentTheme.includes('theme-alt')) {
        highlightColor = 'rgba(198, 40, 40, 0.2)'; // Alt theme (also red)
    } else {
        highlightColor = 'rgba(0, 184, 212, 0.2)'; // Default cyan theme
    }

    // Search active users
    const activeUsersList = document.getElementById('activeUsersList');
    const activeUsers = Array.from(activeUsersList.children);
    const matchingActiveUsers = [];
    const nonMatchingActiveUsers = [];

    activeUsers.forEach(userItem => {
        const userName = userItem.dataset.user.toLowerCase();
        if (userName.includes(lowerQuery)) {
            userItem.style.background = highlightColor;
            matchingActiveUsers.push(userItem);
        } else {
            userItem.style.background = '';
            nonMatchingActiveUsers.push(userItem);
        }
    });

    // Reorder active users: matching first
    activeUsersList.innerHTML = '';
    [...matchingActiveUsers, ...nonMatchingActiveUsers].forEach(item => {
        activeUsersList.appendChild(item);
    });

    // Search private chat users
    const usersList = document.getElementById('usersList');
    const chatUsers = Array.from(usersList.children);
    const matchingChatUsers = [];
    const nonMatchingChatUsers = [];

    chatUsers.forEach(userItem => {
        const userName = userItem.dataset.user?.toLowerCase() || '';
        if (userName.includes(lowerQuery)) {
            userItem.style.background = highlightColor;
            matchingChatUsers.push(userItem);
        } else {
            userItem.style.background = '';
            nonMatchingChatUsers.push(userItem);
        }
    });

    // Reorder chat users: matching first
    usersList.innerHTML = '';
    [...matchingChatUsers, ...nonMatchingChatUsers].forEach(item => {
        usersList.appendChild(item);
    });
}

function clearSearch() {
    // Remove highlights from active users
    const activeUsers = document.querySelectorAll('.active-user-item');
    activeUsers.forEach(item => {
        item.style.background = '';
    });

    // Remove highlights from chat users
    const chatUsers = document.querySelectorAll('.chat-item');
    chatUsers.forEach(item => {
        item.style.background = '';
    });

    // Restore original order by refreshing user lists
    updateUsersList(allUsers);

    // If in a chat, restore original messages
    if (currentChatType !== 'global') {
        renderCurrentChat();
    }
}

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

    // Connect refresh button to soft refresh chat data instead of full page reload
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('===== SOFT REFRESH TRIGGERED =====');

            // Show loading state
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

            // Request fresh data from server
            Promise.all([
                eel.send_message('request_chat_history', '', {})(),
                eel.refresh_user_list()()
            ]).then(() => {
                // Reset button state
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                showNotification('Chat refreshed', 'success');
            }).catch((error) => {
                console.error('Refresh failed:', error);
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                showNotification('Refresh failed', 'error');
            });
        });
    }

    // Connect group settings header button
    const groupSettingsHeaderBtn = document.getElementById('groupSettingsHeaderBtn');
    if (groupSettingsHeaderBtn) {
        console.log('✅ Group settings button found, adding listener');
        groupSettingsHeaderBtn.addEventListener('click', (e) => {
            console.log('🎯 GROUP SETTINGS BUTTON CLICKED!');
            console.log(`Current chat type: ${currentChatType}`);
            console.log(`Current chat target: ${currentChatTarget}`);

            e.preventDefault();
            e.stopPropagation();

            if (currentChatType === 'group' && currentChatTarget) {
                // Get group info from persistentGroups
                const groupInfo = persistentGroups[currentChatTarget];
                console.log('Group info:', groupInfo);

                if (groupInfo) {
                    // Set current group context for settings
                    currentGroupContext = {
                        id: currentChatTarget,
                        name: groupInfo.name,
                        members: groupInfo.members || [],
                        admin: groupInfo.admin || groupInfo.created_by || username
                    };
                    console.log('Opening group settings modal...');
                    openGroupSettings();
                } else {
                    console.error('❌ Group info not found in persistentGroups');
                }
            } else {
                console.warn('⚠️ Not in group chat or no target');
            }
        });
    } else {
        console.error('❌ Group settings button not found!');
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
    const emojiPickerModal = document.getElementById('emojiPickerModal');
    const closeEmojiBtn = document.getElementById('closeEmojiBtn');

    if (emojiBtn) {
        console.log('✅ Emoji button found, attaching click handler');
        emojiBtn.addEventListener('click', (e) => {
            console.log('🎨 Emoji button clicked!');
            e.preventDefault();
            e.stopPropagation();
            showEmojiPicker();
        });
    } else {
        console.error('❌ Emoji button not found!');
    }

    if (closeEmojiBtn) {
        closeEmojiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideEmojiPicker();
        });
    }

    // Handle emoji clicks inside the picker
    if (emojiPicker) {
        emojiPicker.addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji')) {
                const emoji = e.target.getAttribute('data-emoji');
                if (emoji) {
                    console.log('✅ Emoji clicked from picker:', emoji);
                    e.preventDefault();
                    e.stopPropagation();
                    insertEmoji(emoji);
                    hideEmojiPicker();
                }
            }
        });
    }

    // Close emoji picker when clicking outside (modal overlay)
    if (emojiPickerModal) {
        emojiPickerModal.addEventListener('click', (e) => {
            if (e.target === emojiPickerModal) {
                hideEmojiPicker();
            }
        });
    }

    // Emoji selection (only if mainApp is active)
    document.addEventListener('click', (e) => {
        const mainApp = document.getElementById('mainApp');
        if (mainApp && mainApp.classList.contains('active')) {
            if (e.target.classList.contains('emoji')) {
                const emoji = e.target.dataset.emoji;
                insertEmoji(emoji);
            }
        }
    });

    // Emoji reaction picker
    const emojiReactionPickerElement = document.getElementById('emojiReactionPicker');
    if (emojiReactionPickerElement) {
        emojiReactionPickerElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-option')) {
                const emoji = e.target.dataset.emoji;
                if (currentReactionMessageElement) {
                    addEmojiReaction(currentReactionMessageElement, emoji);
                    emojiReactionPickerElement.style.display = 'none';
                    currentReactionMessageElement = null;
                }
            }
        });
    }

    // Pinned messages bar close button
    const closePinnedBar = document.getElementById('closePinnedBar');
    if (closePinnedBar) {
        closePinnedBar.addEventListener('click', (e) => {
            e.stopPropagation();
            const pinnedBar = document.getElementById('pinnedMessagesBar');
            pinnedBar.style.display = 'none';
        });
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query) {
                searchUsersAndMessages(query);
            } else {
                clearSearch();
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    searchUsersAndMessages(query);
                } else {
                    clearSearch();
                }
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                searchUsersAndMessages(query);
            } else {
                clearSearch();
            }
        });
    }

    // Add message menu buttons to existing messages
    addMessageMenuButtons();
});

function addMessageMenuButtons() {
    const messages = document.querySelectorAll('.message');
    messages.forEach((message, index) => {
        // Check if button already exists and has handler
        let menuBtn = message.querySelector('.message-menu-btn');

        if (!menuBtn) {
            // Create new button
            menuBtn = document.createElement('button');
            menuBtn.className = 'message-menu-btn';
            menuBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            `;
            message.appendChild(menuBtn);
        }

        // Always ensure the handler is properly attached (remove old ones first)
        if (!menuBtn.dataset.handlerAttached) {
            menuBtn.addEventListener('click', function (e) {
                console.log('🖱️ Message menu button clicked!');
                e.preventDefault();
                e.stopPropagation();

                // Ensure message has a unique ID
                if (!message.dataset.messageId) {
                    message.dataset.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }

                console.log('📋 Showing context menu for message:', message.dataset.messageId);
                showMessageContextMenu(e, message);
            });

            // Mark as having handler to prevent duplicates
            menuBtn.dataset.handlerAttached = 'true';
        }
    });
}

console.log('Shadow Nexus initialized');

// ===== SOUND SYSTEM =====
class SoundManager {
    constructor() {
        this.sounds = {
            message: this.createSound(800, 0.1, 'sine'),
            notification: this.createSound(600, 0.15, 'triangle'),
            call: this.createSound(400, 0.2, 'square'),
            error: this.createSound(200, 0.3, 'sawtooth')
        };
    }

    createSound(frequency, duration, type = 'sine') {
        return () => {
            if (localStorage.getItem('sounds') === 'false') return;

            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
                oscillator.type = type;

                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + duration);
            } catch (error) {
                console.log('Sound playback failed:', error);
            }
        };
    }

    playSound(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }
}

const soundManager = new SoundManager();

// Enhanced notification function with sound
const originalShowNotification = showNotification;
showNotification = function (message, type = 'info') {
    // Play appropriate sound
    if (localStorage.getItem('notifications') !== 'false') {
        switch (type) {
            case 'error':
                soundManager.playSound('error');
                break;
            case 'success':
                soundManager.playSound('notification');
                break;
            case 'warning':
                soundManager.playSound('notification');
                break;
            default:
                soundManager.playSound('notification');
        }
    }

    // Call original notification function
    originalShowNotification(message, type);
};

// Play message sound when receiving messages
function playMessageSound() {
    if (localStorage.getItem('sounds') !== 'false') {
        soundManager.playSound('message');
    }
}

// Enhanced message handling with sound
const originalAddMessage = addMessage;
addMessage = function (message, skipSound = false) {
    const result = originalAddMessage(message);

    // Play sound for new messages (not our own)
    if (!skipSound && message.sender !== username) {
        playMessageSound();
    }

    return result;
};

// ===== BROWSER NOTIFICATIONS =====
class BrowserNotificationManager {
    constructor() {
        this.permission = 'default';
        this.requestPermission();
    }

    async requestPermission() {
        if ('Notification' in window) {
            this.permission = await Notification.requestPermission();
            console.log('Notification permission:', this.permission);
        }
    }

    showBrowserNotification(title, body, icon = null) {
        if (localStorage.getItem('notifications') === 'false') return;
        if (this.permission !== 'granted') return;
        if (document.hasFocus()) return; // Don't show if window is focused

        try {
            const notification = new Notification(title, {
                body: body,
                icon: icon || 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwYjhkNCIgc3Ryb2tlLXdpZHRoPSI1Ii8+CjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjMwIiBmaWxsPSJub25lIiBzdHJva2U9IiM5YzI3YjAiIHN0cm9rZS13aWR0aD0iMyIvPgo8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIxMCIgZmlsbD0iIzAwYjhkNCIvPgo8cGF0aCBkPSJNIDMwIDUwIEwgNzAgNTAgTSA1MCAzMCBMIDUwIDcwIiBzdHJva2U9IiMwMGI4ZDQiIHN0cm9rZS13aWR0aD0iNCIvPgo8L3N2Zz4=',
                badge: 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiMwMGI4ZDQiLz4KPC9zdmc+',
                tag: 'shadow-nexus',
                requireInteraction: false,
                silent: false
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);

        } catch (error) {
            console.log('Browser notification failed:', error);
        }
    }
}

const browserNotificationManager = new BrowserNotificationManager();

// Enhanced message handling with browser notifications
const originalHandleMessage = handleMessage;
handleMessage = function (data) {
    const result = originalHandleMessage(data);

    // Show browser notification for new messages
    if (data.type === 'message' && data.sender !== username) {
        const chatName = data.chat_type === 'global' ? 'Global Network' :
            data.chat_type === 'group' ? `Group: ${data.receiver}` :
                data.sender;

        browserNotificationManager.showBrowserNotification(
            `New message from ${data.sender}`,
            `${chatName}: ${data.content.substring(0, 100)}${data.content.length > 100 ? '...' : ''}`
        );
    }

    return result;
};
//

// Ensure emoji picker works properly
document.addEventListener('DOMContentLoaded', function () {
    console.log('🔧 Setting up emoji picker and message menu fixes...');

    // Fix emoji picker clicks
    const emojiPickerModal = document.getElementById('emojiPickerModal');
    if (emojiPickerModal) {
        emojiPickerModal.addEventListener('click', function (e) {
            console.log('🎯 Emoji picker modal clicked, target:', e.target);
            console.log('🎯 Target classes:', e.target.classList);
            console.log('🎯 Target data-emoji:', e.target.getAttribute('data-emoji'));

            if (e.target.classList.contains('emoji')) {
                const emoji = e.target.getAttribute('data-emoji');
                if (emoji) {
                    console.log('✅ Emoji clicked:', emoji);
                    e.preventDefault();
                    e.stopPropagation();
                    insertEmoji(emoji);
                    hideEmojiPicker();
                } else {
                    console.log('❌ No emoji data found');
                }
            } else {
                console.log('❌ Target does not have emoji class');
            }
        });
        console.log('✅ Emoji picker click handler attached');
    }

    // Fix emoji REACTION picker clicks
    const emojiReactionPicker = document.getElementById('emojiReactionPicker');
    if (emojiReactionPicker) {
        emojiReactionPicker.addEventListener('click', function (e) {
            console.log('🎯 Emoji REACTION picker clicked, target:', e.target);

            if (e.target.classList.contains('emoji-option')) {
                const emoji = e.target.getAttribute('data-emoji');
                if (emoji && currentReactionMessageElement) {
                    console.log('✅ Reaction emoji clicked:', emoji);
                    e.preventDefault();
                    e.stopPropagation();
                    addEmojiReaction(currentReactionMessageElement, emoji);
                    emojiReactionPicker.style.display = 'none';
                } else {
                    console.log('❌ No emoji data or message element found');
                }
            }
        });
        console.log('✅ Emoji reaction picker click handler attached');
    }

    // Fix message context menu
    const messageContextMenu = document.getElementById('messageContextMenu');
    if (messageContextMenu) {
        messageContextMenu.addEventListener('click', function (e) {
            const menuItem = e.target.closest('.context-menu-item');
            if (menuItem) {
                const action = menuItem.getAttribute('data-action');
                const messageId = messageContextMenu.dataset.messageId;
                console.log('✅ Context menu action:', action, 'for message:', messageId);

                if (action && messageId) {
                    handleMessageContextAction(action, messageId);
                    messageContextMenu.classList.remove('show');
                }
            }
        });
        console.log('✅ Message context menu handler attached');
    }

    // Ensure message menu buttons work
    function attachMessageMenuHandlers() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            const menuBtn = message.querySelector('.message-menu-btn');
            if (menuBtn && !menuBtn.dataset.handlerAttached) {
                menuBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Ensure message has an ID
                    if (!message.dataset.messageId) {
                        message.dataset.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }

                    console.log('✅ Message menu button clicked for:', message.dataset.messageId);
                    showMessageContextMenu(e, message);
                });
                menuBtn.dataset.handlerAttached = 'true';
            }
        });
    }

    // Attach handlers initially and on new messages
    attachMessageMenuHandlers();

    // Re-attach handlers when new messages are added
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        const observer = new MutationObserver(function () {
            attachMessageMenuHandlers();
        });
        observer.observe(messagesContainer, { childList: true, subtree: true });
        console.log('✅ Message observer attached');
    }

    console.log('✅ All fixes applied successfully');
});
// ===== ADDITIONAL MESSAGE MENU FIX =====
// Add event delegation for message menu buttons to ensure they always work
document.addEventListener('click', function (e) {
    // Check if clicked element is a message menu button or its child
    const menuBtn = e.target.closest('.message-menu-btn');
    if (menuBtn) {
        console.log('🎯 Message menu button clicked via delegation!');
        e.preventDefault();
        e.stopPropagation();

        // Find the parent message element
        const messageElement = menuBtn.closest('.message');
        if (messageElement) {
            // Ensure message has an ID
            if (!messageElement.dataset.messageId) {
                messageElement.dataset.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }

            console.log('📋 Calling showMessageContextMenu via delegation');
            showMessageContextMenu(e, messageElement);
        } else {
            console.error('❌ Could not find parent message element');
        }
    }
});

console.log('✅ Message menu delegation handler added');

// 

function initTutorial() {
    let curPage = 1;
    const numOfPages = document.querySelectorAll('.skw-page').length;
    const animTime = 1000;
    let scrolling = false;
    const pgPrefix = '.skw-page-';
    const scrollInstruction = document.getElementById('tutorialScrollInstruction');
    let scrollAccumulator = 0;
    const scrollThreshold = 50;

    function hideScrollInstruction() {
        if (scrollInstruction) {
            scrollInstruction.classList.add('hidden');
        }
    }

    function navigateUp() {
        if (curPage === 1 || scrolling) return;
        scrolling = true;
        hideScrollInstruction();

        document.querySelector(pgPrefix + curPage).classList.remove('active');
        document.querySelector(pgPrefix + curPage).classList.add('inactive');
        curPage--;
        document.querySelector(pgPrefix + curPage).classList.add('active');
        document.querySelector(pgPrefix + curPage).classList.remove('inactive');

        setTimeout(() => {
            scrolling = false;
            scrollAccumulator = 0;
        }, animTime);
    }

    function navigateDown() {
        if (curPage === numOfPages || scrolling) return;
        scrolling = true;
        hideScrollInstruction();

        document.querySelector(pgPrefix + curPage).classList.remove('active');
        document.querySelector(pgPrefix + curPage).classList.add('inactive');
        curPage++;
        document.querySelector(pgPrefix + curPage).classList.add('active');
        document.querySelector(pgPrefix + curPage).classList.remove('inactive');

        setTimeout(() => {
            scrolling = false;
            scrollAccumulator = 0;
        }, animTime);
    }

    function handleMouseWheel(e) {
        e.preventDefault();
        if (scrolling) return;

        scrollAccumulator += e.deltaY;

        if (Math.abs(scrollAccumulator) >= scrollThreshold) {
            if (scrollAccumulator > 0) {
                navigateDown();
            } else {
                navigateUp();
            }
            scrollAccumulator = 0;
        }

        clearTimeout(window.scrollResetTimer);
        window.scrollResetTimer = setTimeout(() => {
            scrollAccumulator = 0;
        }, 200);
    }

    function handleKeyDown(e) {
        if (scrolling) return;
        if (e.keyCode === 40 || e.keyCode === 34) {
            e.preventDefault();
            navigateDown();
        } else if (e.keyCode === 38 || e.keyCode === 33) {
            e.preventDefault();
            navigateUp();
        }
    }

    let touchStartY = 0;
    function handleTouchStart(e) {
        touchStartY = e.touches[0].clientY;
    }

    function handleTouchEnd(e) {
        if (scrolling) return;
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;

        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                navigateDown();
            } else {
                navigateUp();
            }
        }
    }

    // Add event listeners
    window.addEventListener('wheel', handleMouseWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Continue button
    const continueBtn = document.getElementById('tutorialContinueBtn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            console.log('Tutorial complete, going to login...');
            
            // Remove event listeners
            window.removeEventListener('wheel', handleMouseWheel);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
            
            // Transition to login screen
            setTimeout(() => {
                document.getElementById('tutorialScreen').classList.remove('active');
                loginScreen.classList.add('active');
                loginUsername.textContent = username;
                spinLogo(loginScreen);
            }, 500);
        });
    }

    // Auto-hide scroll instruction after 5 seconds
    setTimeout(() => {
        if (curPage === 1) {
            hideScrollInstruction();
        }
    }, 5000);
}
