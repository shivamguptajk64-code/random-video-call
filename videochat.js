// ============ STATE ============
const state = {
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    unreadChatCount: 0,
    unreadChatSenders: [],
    isConnected: false,
    isSearching: false,
    isMicOn: true,
    isCamOn: true,
    timerInterval: null,
    timerSeconds: 0,
    chatCollapsed: true,
    strangerName: 'Stranger',
    strangerCountry: 'Global',
    currentMask: 'none',
    currentFilter: 'none',
    facingMode: 'user',
    setupStep: 0,
    preferences: {
        gender: '',
        country: '',
        interests: [],
        language: [],
        intent: ''
    }
};

const videoChatStorageKey = 'vibematch_video_chats';
const videoChatFriendsKey = 'vibematch_video_friends';
const videoChatHistoryKey = 'vibematch_video_history';
const videoChatBlockedKey = 'vibematch_video_blocked_users';
const videoChatSentFriendRequestsKey = 'vibematch_sent_friend_requests';
const videoChatFriendRequestsKey = 'vibematch_friend_requests';
const messageRequestsStorageKey = 'vibematch_message_requests';

if (window.VibeMatchTokens) {
    window.VibeMatchTokens.mountWidget('#messageTokenSlot');
}

function getChatTime() {
    const date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    return hours + ':' + minutes + ' ' + ampm;
}

function readSavedVideoChats() {
    try {
        const saved = JSON.parse(localStorage.getItem(videoChatStorageKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function readSavedVideoFriends() {
    try {
        const saved = JSON.parse(localStorage.getItem(videoChatFriendsKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function saveVideoFriends(friends) {
    localStorage.setItem(videoChatFriendsKey, JSON.stringify(friends));
}

function readSentFriendRequests() {
    try {
        const saved = JSON.parse(localStorage.getItem(videoChatSentFriendRequestsKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function saveSentFriendRequests(requests) {
    localStorage.setItem(videoChatSentFriendRequestsKey, JSON.stringify(requests));
}

function readFriendRequests() {
    try {
        const saved = JSON.parse(localStorage.getItem(videoChatFriendRequestsKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function saveFriendRequests(requests) {
    localStorage.setItem(videoChatFriendRequestsKey, JSON.stringify(requests));
}

function readMessageRequests() {
    try {
        const saved = JSON.parse(localStorage.getItem(messageRequestsStorageKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function saveMessageRequests(requests) {
    localStorage.setItem(messageRequestsStorageKey, JSON.stringify(requests));
}

function readSavedVideoHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem(videoChatHistoryKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function readBlockedVideoUsers() {
    try {
        const saved = JSON.parse(localStorage.getItem(videoChatBlockedKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function saveBlockedVideoUsers(users) {
    localStorage.setItem(videoChatBlockedKey, JSON.stringify(users));
}

function getCurrentStrangerBlockId() {
    return getCurrentStrangerFriendId();
}

function isCurrentStrangerBlocked() {
    const blockId = getCurrentStrangerBlockId();
    return readBlockedVideoUsers().some(function(user) {
        return user && user.id === blockId;
    });
}

function blockCurrentStranger() {
    if (!state.strangerName) return;

    const blocked = readBlockedVideoUsers();
    const blockId = getCurrentStrangerBlockId();

    if (!blocked.some(function(user) { return user && user.id === blockId; })) {
        blocked.unshift({
            id: blockId,
            name: state.strangerName || 'Stranger',
            country: state.strangerCountry || 'Global',
            blockedAt: new Date().toISOString()
        });
        saveBlockedVideoUsers(blocked);
    }

    saveVideoChatHistory('blocked');
    addSystemMessage((state.strangerName || 'Stranger') + ' was blocked. You will not be matched again.');
    disconnectChat(
        'User blocked',
        'This stranger has been blocked and will not be matched with you again.'
    );
}

function getCurrentStrangerFriendId() {
    return (state.strangerName || 'Stranger').toLowerCase().replace(/\s+/g, '-') + '-' +
        (state.strangerCountry || 'Global').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function isCurrentStrangerFriend() {
    const friendId = getCurrentStrangerFriendId();
    return readSavedVideoFriends().some(function(friend) {
        return friend && friend.id === friendId;
    });
}

function isCurrentStrangerRequestSent() {
    const friendId = getCurrentStrangerFriendId();
    return readSentFriendRequests().some(function(request) {
        return request && request.id === friendId;
    });
}

function updateAddFriendButton() {
    if (!addFriendBtn) return;
    const active = state.isConnected && Boolean(state.strangerName);
    const added = active && isCurrentStrangerFriend();
    const requested = active && isCurrentStrangerRequestSent();
    addFriendBtn.disabled = !active || requested;
    addFriendBtn.classList.toggle('friend-added', added);
    addFriendBtn.classList.toggle('friend-request-sent', requested);
    addFriendBtn.innerHTML = requested
        ? '<i class="fas fa-paper-plane"></i><span>Request Sent</span>'
        : added
        ? '<i class="fas fa-user-check"></i><span>Friend Added</span>'
        : '<i class="fas fa-user-plus"></i><span>Add Friend</span>';
    addFriendBtn.title = requested ? 'Friend request sent' : (added ? 'Already Friends' : 'Send friend request');
}

let matchingTimeout = null;
let demoDisconnectTimeout = null;
let prePermissionApproved = false;

function setConnectionNotice(type, title, message, actionText) {
    if (!waitingOverlay || !waitingText) return;

    waitingOverlay.style.display = 'flex';
    waitingOverlay.classList.remove('connection-waiting', 'connection-error', 'connection-warning', 'connection-ended');
    waitingOverlay.classList.add('connection-' + type);
    waitingText.innerHTML = `
        <span class="connection-state-card">
            <span class="connection-state-icon"><i class="fas fa-wifi"></i></span>
            <strong>${title}</strong>
            <small>${message}</small>
            <button class="inline-start-btn connection-retry-btn" id="overlayStartBtn" type="button">${actionText || 'Retry'}</button>
        </span>
    `;
    bindOverlayStartButton();
}

function clearConnectionNotice() {
    if (!waitingOverlay) return;
    waitingOverlay.classList.remove('connection-waiting', 'connection-error', 'connection-warning', 'connection-ended');
}

function clearConnectionTimers() {
    if (matchingTimeout) {
        clearTimeout(matchingTimeout);
        matchingTimeout = null;
    }

    if (demoDisconnectTimeout) {
        clearTimeout(demoDisconnectTimeout);
        demoDisconnectTimeout = null;
    }

}

function clearSkipCooldownPopup() {
    const popup = document.querySelector('.skip-cooldown-popup');
    if (popup) popup.remove();
    if (skipBtn) {
        skipBtn.classList.remove('skip-cooling');
        skipBtn.innerHTML = '<i class="fas fa-forward"></i> Next';
    }
}

function showPrePermissionModal() {
    return new Promise(function(resolve) {
        const existing = document.querySelector('.pre-permission-overlay');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'pre-permission-overlay';
        modal.innerHTML = `
            <div class="pre-permission-card">
                <span class="pre-permission-tag">Before you start</span>
                <h2>Allow access for video chat</h2>
                <p>VibeMatch needs these permissions to connect you smoothly and safely.</p>

                <div class="permission-list">
                    <div class="permission-item">
                        <i class="fas fa-video"></i>
                        <div>
                            <strong>Camera</strong>
                            <span>Show your video during live chat.</span>
                        </div>
                    </div>
                    <div class="permission-item">
                        <i class="fas fa-microphone"></i>
                        <div>
                            <strong>Microphone</strong>
                            <span>Let the stranger hear your voice.</span>
                        </div>
                    </div>
                    <div class="permission-item">
                        <i class="fas fa-wifi"></i>
                        <div>
                            <strong>Connection check</strong>
                            <span>Detect slow or unstable calls.</span>
                        </div>
                    </div>
                    <div class="permission-item">
                        <i class="fas fa-shield-halved"></i>
                        <div>
                            <strong>Safety tools</strong>
                            <span>Enable report, skip, and stop controls. Screenshots and screen recording are not allowed by VibeMatch safety policy.</span>
                        </div>
                    </div>
                </div>

                <div class="pre-permission-actions">
                    <button class="pre-deny-btn" type="button">Not now</button>
                    <button class="pre-allow-btn" type="button">Allow & continue</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.pre-allow-btn').addEventListener('click', function(event) {
            event.currentTarget.classList.add('permission-accepted');
            prePermissionApproved = true;
            setTimeout(function() {
                modal.remove();
                resolve(true);
            }, 180);
        });

        modal.querySelector('.pre-deny-btn').addEventListener('click', function() {
            modal.remove();
            resolve(false);
        });
    });
}

function showPrivacyShield() {
    let shield = document.querySelector('.privacy-shield');

    if (!shield) {
        shield = document.createElement('div');
        shield.className = 'privacy-shield';
        shield.innerHTML = `
            <i class="fas fa-shield-halved"></i>
            <strong>Privacy protected</strong>
            <span>Screenshots and screen recording are not allowed on VibeMatch.</span>
        `;
        document.body.appendChild(shield);
    }

    shield.classList.add('visible');
    setTimeout(function() {
        shield.classList.remove('visible');
    }, 1400);
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'PrintScreen') {
        showPrivacyShield();
    }
});

document.addEventListener('contextmenu', function(event) {
    if (state.isConnected) {
        event.preventDefault();
    }
});

function saveVideoChatHistory(eventType) {
    const history = readSavedVideoHistory();
    history.unshift({
        name: state.strangerName || 'Stranger',
        country: state.strangerCountry || 'Global',
        event: eventType,
        interests: state.preferences.interests.slice(),
        language: state.preferences.language.slice(),
        at: new Date().toISOString(),
        durationSeconds: state.timerSeconds || 0
    });
    localStorage.setItem(videoChatHistoryKey, JSON.stringify(history.slice(0, 80)));
}

function addCurrentStrangerAsFriend() {
    if (!state.isConnected || !addFriendBtn) return;
    const friendId = getCurrentStrangerFriendId();
    const requests = readSentFriendRequests();
    const incomingRequests = readFriendRequests();
    const requestedAt = new Date().toISOString();
    const requestData = {
        id: friendId,
        name: state.strangerName || 'Stranger',
        country: state.strangerCountry || 'Global',
        icon: (state.strangerName || 'S').charAt(0).toUpperCase(),
        status: 'Pending friend request',
        interests: state.preferences.interests.slice(),
        requestedAt: requestedAt
    };

    if (!requests.some(function(request) { return request && request.id === friendId; })) {
        requests.unshift(requestData);
        saveSentFriendRequests(requests);
        saveVideoChatHistory('friend_request_sent');
        addSystemMessage('Friend request sent to ' + state.strangerName + '. You can DM after they accept.');
    }

    if (!incomingRequests.some(function(request) { return request && request.id === friendId; })) {
        incomingRequests.unshift(requestData);
        saveFriendRequests(incomingRequests);
    }

    updateAddFriendButton();
}

function saveVideoChatMessage(text, type) {
    if (!state.strangerName || !text) return;

    const now = new Date().toISOString();
    const friendId = getCurrentStrangerFriendId();
    const name = state.strangerName || 'Stranger';
    const icon = name.charAt(0).toUpperCase();
    const savedChats = readSavedVideoChats();
    const existingChatIndex = savedChats.findIndex(function(chat) {
        if (!chat) return false;
        return chat.id === friendId || (chat.name || '').toLowerCase() === name.toLowerCase();
    });

    if (existingChatIndex >= 0 && savedChats[existingChatIndex].status !== 'From video chat') {
        const chat = savedChats[existingChatIndex];
        chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
        chat.messages.push({
            type: type === 'received' ? 'received' : 'sent',
            text: text,
            time: getChatTime(),
            at: now
        });
        chat.preview = text;
        chat.time = 'now';
        chat.updatedAt = now;
        chat.unread = type === 'received' ? Number(chat.unread || 0) + 1 : Number(chat.unread || 0);
        localStorage.setItem(videoChatStorageKey, JSON.stringify(savedChats));
        return;
    }

    const requests = readMessageRequests();
    let request = requests.find(function(item) {
        if (!item) return false;
        return item.id === friendId || (item.name || '').toLowerCase() === name.toLowerCase();
    });

    if (!request) {
        request = {
            id: friendId,
            name: name,
            icon: icon,
            country: state.strangerCountry || 'Global',
            status: 'Message request',
            time: 'now',
            preview: text,
            unread: 0,
            requestedAt: now,
            updatedAt: now,
            messages: []
        };
        requests.unshift(request);
    }

    request.messages = Array.isArray(request.messages) ? request.messages : [];
    request.messages.push({
        type: 'received',
        text: text,
        time: getChatTime(),
        at: now
    });
    request.preview = text;
    request.time = 'now';
    request.updatedAt = now;
    request.unread = Number(request.unread || 0) + 1;
    saveMessageRequests(requests);
}

function isChatInputActive() {
    return document.activeElement === quickChatInput;
}

function markCurrentStrangerUnread() {
    const sender = state.strangerName || 'Stranger';
    if (!state.unreadChatSenders.includes(sender)) {
        state.unreadChatSenders.push(sender);
    }
    state.unreadChatCount = state.unreadChatSenders.length;
}

function isUnsafeChatMessage(text) {
    const value = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const compact = value.replace(/[\s._-]+/g, '');

    const unsafePatterns = [
        /\b(nude|nudity|naked|sex|sexual|porn|xxx|boobs?|dick|pussy)\b/i,
        /\b(suicide|kill myself|kill yourself|self harm|self-harm|cut myself|hang myself)\b/i,
        /\b(threat|threaten|blackmail|dhamki|maar dunga|kill you|kidnap|extort)\b/i,
        /\b(drugs?|weed|cocaine|heroin|mdma|lsd|illegal supply|weapon|gun|pistol|fake id)\b/i,
        /\b(upi|paytm|phonepe|gpay|google pay|scanner|qr code|bank account|ifsc|account number|card number|cvv|otp)\b/i,
        /\b(instagram|insta|facebook|fb|snapchat|snap|telegram|whatsapp|twitter|x\.com|discord|tiktok|youtube)\b/i,
        /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
        /\b\d{10,16}\b/,
        /\b[a-z0-9.\-_]{2,256}@[a-z]{2,64}\b/i
    ];

    const compactUnsafe = /(instagram|facebook|snapchat|telegram|whatsapp|phonepe|paytm|googlepay|bankaccount|accountnumber|illegal|suicide|nudity|porn|upi|ifsc)/i;

    return unsafePatterns.some(function(pattern) {
        return pattern.test(value);
    }) || compactUnsafe.test(compact);
}

function moderateChatMessage(text) {
    return isUnsafeChatMessage(text) ? '****' : text;
}

// ============ DOM ELEMENTS ============
const localVideo    = document.getElementById('localVideo');
const localBoxEl    = document.getElementById('localBox');
const cartoonFilterCanvas = document.getElementById('cartoonFilterCanvas');
const remoteVideo   = document.getElementById('remoteVideo');
const remoteBoxEl   = document.getElementById('remoteBox');
const faceFilterOverlay = document.getElementById('faceFilterOverlay');
const startBtn      = document.getElementById('startBtn');
const overlayStartBtn = document.getElementById('overlayStartBtn');
const skipBtn       = document.getElementById('skipBtn');
const stopBtn       = document.getElementById('stopBtn');
const micBtn        = document.getElementById('micBtn');
const flipCamBtn    = document.getElementById('flipCamBtn');
const camBtn        = document.getElementById('camBtn');
const effectsBtn    = document.getElementById('effectsBtn');
const reportBtn     = document.getElementById('reportBtn');
const addFriendBtn  = document.getElementById('addFriendBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const quickChatInput = document.getElementById('quickChatInput');
const quickChatSendBtn = document.getElementById('quickChatSendBtn');
const quickMessageFeedback = document.getElementById('quickMessageFeedback');
const quickChatHeader = document.getElementById('quickChatHeader');
const quickChatMessages = document.getElementById('quickChatMessages');
const waitingOverlay = document.getElementById('waitingOverlay');
const waitingParticlesCanvas = document.getElementById('waitingParticlesCanvas');
const waitingText   = document.getElementById('waitingText');
const strangerInfo  = document.getElementById('strangerInfo');
const strangerName  = document.getElementById('strangerName');
const chatTimer     = document.getElementById('chatTimer');
const timerDisplay  = document.getElementById('timerDisplay');
const camOffOverlay = document.getElementById('camOffOverlay');
const onlineCount   = document.getElementById('onlineCount');
const setupModal    = document.getElementById('setupModal');
const setupNextBtn  = document.getElementById('setupNextBtn');
const countrySearch = document.getElementById('countrySearch');
const countryChoices = document.getElementById('countryChoices');
const languageSearch = document.getElementById('languageSearch');
const languageChoices = document.getElementById('languageChoices');
const setupTitle = document.getElementById('setupTitle');
const setupSubtitle = document.getElementById('setupSubtitle');
const setupSections = document.querySelectorAll('.setup-section');
const setupStepDots = document.querySelectorAll('#setupStepDots span');
const setupBackBtn = document.getElementById('setupBackBtn');
const setupError = document.getElementById('setupError');
const matchSummary = document.getElementById('matchSummary');
const videoChatParams = new URLSearchParams(window.location.search);
const directCallUser = videoChatParams.get('mode') === 'direct'
    ? (videoChatParams.get('user') || 'Friend')
    : '';

document.querySelectorAll('.modal-overlay, .modal-box, .setup-modal, .setup-heading, .video-box').forEach(function(element) {
    element.setAttribute('draggable', 'false');
    element.addEventListener('dragstart', function(event) {
        event.preventDefault();
    });
});

function showDirectCallOverlay() {
    if (!directCallUser) return;

    const overlay = document.createElement('div');
    overlay.className = 'direct-call-overlay';
    overlay.innerHTML = `
        <div class="direct-call-card">
            <span class="direct-call-tag">Direct video call</span>
            <div class="direct-call-avatar">${directCallUser.charAt(0).toUpperCase()}</div>
            <h2>${directCallUser}</h2>
            <p>Start a private video call with your friend.</p>
            <div class="direct-call-actions">
                <a href="message.html" class="direct-cancel-call">Cancel</a>
                <button class="direct-start-call" type="button">
                    <i class="fas fa-video"></i> Start call
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.direct-start-call').addEventListener('click', async function() {
        overlay.remove();
        if (setupModal) setupModal.style.display = 'none';
        document.body.classList.remove('setup-locked');
        state.strangerName = directCallUser;
        state.strangerCountry = 'Friend';
        if (!state.localStream) {
            const ok = await getLocalStream();
            if (!ok) {
                setConnectionNotice('error', 'Camera access needed', 'Please allow camera and microphone access, then try again.', 'Retry');
                return;
            }
        }
        onMatchFound();
        state.strangerName = directCallUser;
        state.strangerCountry = 'Friend';
        if (strangerName) strangerName.textContent = directCallUser;
        const strangerCountry = document.getElementById('strangerCountry');
        if (strangerCountry) strangerCountry.textContent = 'Friend';
        if (quickChatHeader) quickChatHeader.textContent = 'Chat with ' + directCallUser;
        addSystemMessage('Direct call started with ' + directCallUser + '.');
    });
}

const countries = [
    'India', 'Global', 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
    'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
    'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
    'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon',
    'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo',
    'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica',
    'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia',
    'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana',
    'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary',
    'Iceland', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica',
    'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia',
    'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar',
    'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
    'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
    'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
    'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
    'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
    'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
    'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
    'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa',
    'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
    'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
    'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
    'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
    'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

const cartoonCanvasFilterValue = 'cartoon-canvas';
const videoFilterMap = {
    none: 'none',
    cartoon: cartoonCanvasFilterValue,
    anime: 'saturate(1.45) contrast(1.12) brightness(1.08)',
    kawaii: 'saturate(1.35) contrast(1.04) brightness(1.12) hue-rotate(-8deg)',
    comic: 'saturate(1.75) contrast(1.42) brightness(1.04)',
    'manga-blue': 'saturate(1.32) contrast(1.2) brightness(1.06) hue-rotate(18deg)',
    'toon-warm': 'saturate(1.62) contrast(1.18) brightness(1.08) sepia(0.16)',
    'dream-anime': 'saturate(1.42) contrast(1.08) brightness(1.12) hue-rotate(-16deg)',
    'manga-bw': 'grayscale(1) contrast(1.78) brightness(1.08)',
    'soft-face': 'saturate(1.12) contrast(0.92) brightness(1.12) blur(0.45px)',
    neon: 'saturate(1.8) contrast(1.22) brightness(1.04) hue-rotate(28deg)',
    ghost: 'grayscale(0.55) contrast(1.18) brightness(1.16) opacity(0.86)',
    hacker: 'saturate(1.8) contrast(1.36) hue-rotate(72deg)',
    horror: 'grayscale(0.42) contrast(1.55) brightness(0.82)',
    matrix: 'saturate(1.8) contrast(1.45) brightness(0.92) hue-rotate(74deg)'
};

let cartoonFilterFrame = null;
let cartoonResizeBound = false;
let cartoonOutputStream = null;
const cartoonProcessCanvas = document.createElement('canvas');
const cartoonProcessCtx = cartoonProcessCanvas.getContext('2d', { willReadFrequently: true });

function resizeCartoonCanvas() {
    if (!cartoonFilterCanvas) return;
    const bounds = cartoonFilterCanvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));

    if (cartoonFilterCanvas.width !== width) cartoonFilterCanvas.width = width;
    if (cartoonFilterCanvas.height !== height) cartoonFilterCanvas.height = height;
}

function drawImageCover(ctx, source, targetWidth, targetHeight) {
    const sourceRatio = source.width / source.height;
    const targetRatio = targetWidth / targetHeight;
    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let drawX = 0;
    let drawY = 0;

    if (sourceRatio > targetRatio) {
        drawHeight = targetHeight;
        drawWidth = targetHeight * sourceRatio;
        drawX = (targetWidth - drawWidth) / 2;
    } else {
        drawWidth = targetWidth;
        drawHeight = targetWidth / sourceRatio;
        drawY = (targetHeight - drawHeight) / 2;
    }

    ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
}

function renderCartoonFrame() {
    if (!cartoonFilterCanvas || !cartoonProcessCtx || state.currentFilter !== cartoonCanvasFilterValue) {
        cartoonFilterFrame = null;
        return;
    }

    if (localVideo && localVideo.readyState >= 2 && localVideo.videoWidth && localVideo.videoHeight) {
        resizeCartoonCanvas();

        const sourceRatio = localVideo.videoWidth / localVideo.videoHeight;
        const processWidth = 320;
        const processHeight = Math.max(1, Math.round(processWidth / sourceRatio));

        if (cartoonProcessCanvas.width !== processWidth) cartoonProcessCanvas.width = processWidth;
        if (cartoonProcessCanvas.height !== processHeight) cartoonProcessCanvas.height = processHeight;

        cartoonProcessCtx.imageSmoothingEnabled = true;
        cartoonProcessCtx.drawImage(localVideo, 0, 0, processWidth, processHeight);

        const frame = cartoonProcessCtx.getImageData(0, 0, processWidth, processHeight);
        const pixels = frame.data;
        const gray = new Uint8ClampedArray(processWidth * processHeight);

        for (let pixel = 0, index = 0; pixel < pixels.length; pixel += 4, index += 1) {
            const originalR = pixels[pixel];
            const originalG = pixels[pixel + 1];
            const originalB = pixels[pixel + 2];
            const luminance = (originalR * 0.299) + (originalG * 0.587) + (originalB * 0.114);
            gray[index] = luminance;

            const saturation = 1.55;
            const level = 42;
            const boost = 1.08;
            let r = luminance + (originalR - luminance) * saturation;
            let g = luminance + (originalG - luminance) * saturation;
            let b = luminance + (originalB - luminance) * saturation;

            r = Math.min(255, Math.max(0, Math.round((r * boost) / level) * level + 8));
            g = Math.min(255, Math.max(0, Math.round((g * boost) / level) * level + 8));
            b = Math.min(255, Math.max(0, Math.round((b * boost) / level) * level + 8));

            pixels[pixel] = r;
            pixels[pixel + 1] = g;
            pixels[pixel + 2] = b;
            pixels[pixel + 3] = 255;
        }

        for (let y = 1; y < processHeight - 1; y += 1) {
            for (let x = 1; x < processWidth - 1; x += 1) {
                const index = y * processWidth + x;
                const edge =
                    Math.abs(gray[index] - gray[index - 1]) +
                    Math.abs(gray[index] - gray[index + 1]) +
                    Math.abs(gray[index] - gray[index - processWidth]) +
                    Math.abs(gray[index] - gray[index + processWidth]);

                if (edge > 92) {
                    const pixel = index * 4;
                    pixels[pixel] = Math.round(pixels[pixel] * 0.14);
                    pixels[pixel + 1] = Math.round(pixels[pixel + 1] * 0.14);
                    pixels[pixel + 2] = Math.round(pixels[pixel + 2] * 0.14);
                } else if (edge > 58) {
                    const pixel = index * 4;
                    pixels[pixel] = Math.round(pixels[pixel] * 0.48);
                    pixels[pixel + 1] = Math.round(pixels[pixel + 1] * 0.48);
                    pixels[pixel + 2] = Math.round(pixels[pixel + 2] * 0.48);
                }
            }
        }

        cartoonProcessCtx.putImageData(frame, 0, 0);

        const displayCtx = cartoonFilterCanvas.getContext('2d');
        if (!displayCtx) {
            cartoonFilterFrame = null;
            return;
        }
        displayCtx.clearRect(0, 0, cartoonFilterCanvas.width, cartoonFilterCanvas.height);
        displayCtx.imageSmoothingEnabled = false;
        drawImageCover(displayCtx, cartoonProcessCanvas, cartoonFilterCanvas.width, cartoonFilterCanvas.height);
    }

    cartoonFilterFrame = requestAnimationFrame(renderCartoonFrame);
}

function startCartoonRenderer() {
    if (!cartoonFilterCanvas || cartoonFilterFrame) return;
    resizeCartoonCanvas();
    if (!cartoonResizeBound) {
        window.addEventListener('resize', resizeCartoonCanvas);
        cartoonResizeBound = true;
    }
    cartoonFilterFrame = requestAnimationFrame(renderCartoonFrame);
}

function stopCartoonRenderer() {
    if (cartoonFilterFrame) {
        cancelAnimationFrame(cartoonFilterFrame);
        cartoonFilterFrame = null;
    }
    if (cartoonResizeBound) {
        window.removeEventListener('resize', resizeCartoonCanvas);
        cartoonResizeBound = false;
    }
    if (cartoonOutputStream) {
        cartoonOutputStream.getTracks().forEach(function(track) {
            track.stop();
        });
        cartoonOutputStream = null;
    }
    if (cartoonFilterCanvas) {
        const displayCtx = cartoonFilterCanvas.getContext('2d');
        if (displayCtx) displayCtx.clearRect(0, 0, cartoonFilterCanvas.width, cartoonFilterCanvas.height);
    }
}

function getCartoonPresentationStream() {
    if (!state.localStream || !cartoonFilterCanvas || typeof cartoonFilterCanvas.captureStream !== 'function') {
        return state.localStream;
    }

    if (!cartoonOutputStream || !cartoonOutputStream.getVideoTracks().length || cartoonOutputStream.getVideoTracks()[0].readyState === 'ended') {
        cartoonOutputStream = cartoonFilterCanvas.captureStream(24);
    }

    const stream = new MediaStream();
    cartoonOutputStream.getVideoTracks().forEach(function(track) {
        stream.addTrack(track);
    });
    state.localStream.getAudioTracks().forEach(function(track) {
        stream.addTrack(track);
    });

    return stream;
}

function syncDemoRemoteVideoFilter() {
    if (!remoteVideo || !state.isConnected || state.remoteStream) return;

    const isCartoonCanvas = state.currentFilter === cartoonCanvasFilterValue;
    if (isCartoonCanvas) {
        remoteVideo.style.filter = '';
        remoteVideo.srcObject = getCartoonPresentationStream();
        return;
    }

    remoteVideo.style.filter = !state.currentFilter || state.currentFilter === 'none' ? '' : state.currentFilter;
    if (state.localStream) remoteVideo.srcObject = state.localStream;
}

function applyCurrentFilter() {
    if (!localVideo) return;
    const isCartoonCanvas = state.currentFilter === cartoonCanvasFilterValue;
    localVideo.style.filter = !state.currentFilter || state.currentFilter === 'none' || isCartoonCanvas ? '' : state.currentFilter;

    if (localBoxEl) {
        localBoxEl.classList.toggle('cartoon-filter-active', isCartoonCanvas);
    }

    if (isCartoonCanvas) {
        startCartoonRenderer();
    } else {
        stopCartoonRenderer();
    }

    syncDemoRemoteVideoFilter();
}

function applyFaceMask(maskName) {
    if (!faceFilterOverlay) return;
    faceFilterOverlay.className = 'face-filter-overlay';
    if (!maskName || maskName === 'none' || maskName === 'cartoon') return;
    faceFilterOverlay.classList.add('visible', 'mask-' + maskName);
}

const languages = [
    'Hindi', 'English', 'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese', 'Aymara', 'Azerbaijani',
    'Bambara', 'Basque', 'Belarusian', 'Bengali', 'Bhojpuri', 'Bosnian', 'Bulgarian', 'Burmese',
    'Catalan', 'Cebuano', 'Chinese', 'Corsican', 'Croatian', 'Czech', 'Danish', 'Dhivehi', 'Dogri',
    'Dutch', 'Esperanto', 'Estonian', 'Ewe', 'Filipino', 'Finnish', 'French', 'Frisian',
    'Galician', 'Georgian', 'German', 'Greek', 'Guarani', 'Gujarati', 'Haitian Creole', 'Hausa',
    'Hawaiian', 'Hebrew', 'Hmong', 'Hungarian', 'Icelandic', 'Igbo', 'Ilocano', 'Indonesian',
    'Irish', 'Italian', 'Japanese', 'Javanese', 'Kannada', 'Kazakh', 'Khmer', 'Kinyarwanda', 'Konkani',
    'Korean', 'Krio', 'Kurdish', 'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lingala', 'Lithuanian',
    'Luganda', 'Luxembourgish', 'Macedonian', 'Maithili', 'Malagasy', 'Malay', 'Malayalam', 'Maltese',
    'Manipuri', 'Maori', 'Marathi', 'Mizo', 'Mongolian', 'Nepali', 'Norwegian', 'Odia', 'Oromo',
    'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi', 'Quechua', 'Romanian', 'Russian', 'Samoan',
    'Sanskrit', 'Scots Gaelic', 'Sepedi', 'Serbian', 'Sesotho', 'Shona', 'Sindhi', 'Sinhala', 'Slovak',
    'Slovenian', 'Somali', 'Spanish', 'Sundanese', 'Swahili', 'Swedish', 'Tajik', 'Tamil', 'Tatar',
    'Telugu', 'Thai', 'Tigrinya', 'Tsonga', 'Turkish', 'Turkmen', 'Twi', 'Ukrainian', 'Urdu', 'Uyghur',
    'Uzbek', 'Vietnamese', 'Welsh', 'Xhosa', 'Yiddish', 'Yoruba', 'Zulu'
];

// ============ FAKE ONLINE COUNT ============
let fakeCount = 18000 + Math.floor(Math.random() * 8000);
if (onlineCount) onlineCount.textContent = fakeCount.toLocaleString();

setInterval(function() {
    fakeCount += Math.floor(Math.random() * 10) - 4;
    fakeCount = Math.max(15000, Math.min(40000, fakeCount));
    if (onlineCount) onlineCount.textContent = fakeCount.toLocaleString();
}, 4000);

// ============ WAITING PARTICLE BACKGROUND ============
if (waitingParticlesCanvas && waitingOverlay) {
    const particleCtx = waitingParticlesCanvas.getContext('2d');
    let particleWidth = 0;
    let particleHeight = 0;
    let particleDpr = 1;
    let waitingParticles = [];
    let particleTime = 0;
    let waitingLastFrame = 0;

    function resizeWaitingParticles() {
        const rect = waitingOverlay.getBoundingClientRect();
        particleDpr = window.devicePixelRatio || 1;
        particleWidth = rect.width;
        particleHeight = rect.height;
        waitingParticlesCanvas.width = particleWidth * particleDpr;
        waitingParticlesCanvas.height = particleHeight * particleDpr;
        waitingParticlesCanvas.style.width = particleWidth + 'px';
        waitingParticlesCanvas.style.height = particleHeight + 'px';
        particleCtx.setTransform(particleDpr, 0, 0, particleDpr, 0, 0);
        buildWaitingParticles();
    }

    function buildWaitingParticles() {
        const count = Math.min(220, Math.floor((particleWidth * particleHeight) / 1400));
        waitingParticles = Array.from({ length: count }, function() {
            const warmParticle = Math.random() > 0.38;
            return {
                x: Math.random() * particleWidth,
                y: Math.random() * particleHeight,
                vx: (Math.random() - 0.5) * 0.55,
                vy: (Math.random() - 0.5) * 0.25 - 0.04,
                size: 0.45 + Math.random() * 1.55,
                alpha: 0.16 + Math.random() * 0.58,
                hue: warmParticle ? 338 + Math.random() * 24 : 0,
                sat: warmParticle ? 46 + Math.random() * 34 : 0,
                light: warmParticle ? 48 + Math.random() * 28 : 74 + Math.random() * 18,
                life: Math.random(),
                trail: []
            };
        });
    }

    function animateWaitingParticles(timestamp) {
        if (isChatInputActive() && timestamp - waitingLastFrame < 100) {
            requestAnimationFrame(animateWaitingParticles);
            return;
        }
        waitingLastFrame = timestamp;
        particleTime = timestamp / 1000;
        particleCtx.clearRect(0, 0, particleWidth, particleHeight);

        const glow = particleCtx.createRadialGradient(
            particleWidth / 2,
            particleHeight / 2,
            0,
            particleWidth / 2,
            particleHeight / 2,
            Math.max(particleWidth, particleHeight) * 0.58
        );
        glow.addColorStop(0, 'rgba(116,14,6,0.18)');
        glow.addColorStop(0.38, 'rgba(70,6,4,0.1)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        particleCtx.fillStyle = glow;
        particleCtx.fillRect(0, 0, particleWidth, particleHeight);

        waitingParticles.forEach(function(particle) {
            particle.trail.push({ x: particle.x, y: particle.y });
            if (particle.trail.length > 7) particle.trail.shift();

            particle.vx += Math.sin(particleTime * 0.8 + particle.y * 0.012) * 0.006;
            particle.vy += Math.cos(particleTime * 0.6 + particle.x * 0.01) * 0.005;
            particle.vx *= 0.985;
            particle.vy *= 0.985;
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life += 0.01;

            if (particle.x < -10) particle.x = particleWidth + 10;
            if (particle.x > particleWidth + 10) particle.x = -10;
            if (particle.y < -10) particle.y = particleHeight + 10;
            if (particle.y > particleHeight + 10) particle.y = -10;

            const alpha = particle.alpha * (0.45 + Math.sin(particle.life) * 0.35);
            if (particle.trail.length > 1) {
                particleCtx.beginPath();
                particleCtx.moveTo(particle.trail[0].x, particle.trail[0].y);
                for (let i = 1; i < particle.trail.length; i++) {
                    particleCtx.lineTo(particle.trail[i].x, particle.trail[i].y);
                }
                particleCtx.strokeStyle = 'hsla(' + particle.hue + ',' + particle.sat + '%,' + particle.light + '%,' + Math.max(0.02, alpha * 0.18) + ')';
                particleCtx.lineWidth = Math.max(0.35, particle.size * 0.45);
                particleCtx.stroke();
            }

            const particleGlow = particleCtx.createRadialGradient(
                particle.x,
                particle.y,
                0,
                particle.x,
                particle.y,
                particle.size * 5
            );
            particleGlow.addColorStop(0, 'hsla(' + particle.hue + ',' + particle.sat + '%,' + (particle.light + 12) + '%,' + Math.max(0.06, alpha) + ')');
            particleGlow.addColorStop(1, 'hsla(' + particle.hue + ',' + particle.sat + '%,' + particle.light + '%,0)');
            particleCtx.fillStyle = particleGlow;
            particleCtx.beginPath();
            particleCtx.arc(particle.x, particle.y, particle.size * 5, 0, Math.PI * 2);
            particleCtx.fill();

            particleCtx.fillStyle = 'hsla(' + particle.hue + ',' + particle.sat + '%,' + (particle.light + 18) + '%,' + Math.max(0.08, alpha) + ')';
            particleCtx.beginPath();
            particleCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            particleCtx.fill();
        });

        requestAnimationFrame(animateWaitingParticles);
    }

    resizeWaitingParticles();
    window.addEventListener('resize', resizeWaitingParticles);
    requestAnimationFrame(animateWaitingParticles);
}

// ============ GET CAMERA + MIC ============
async function getLocalStream() {
    try {
        if (state.localStream) {
            state.localStream.getTracks().forEach(function(track) {
                track.stop();
            });
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 1.7777778 }, facingMode: state.facingMode },
            audio: true
        });
        state.localStream = stream;
        localVideo.srcObject = stream;
        applyCurrentFilter();
        if (state.isConnected) {
            syncDemoRemoteVideoFilter();
        }
        return true;
    } catch (err) {
        console.error('Camera/Mic error:', err);
        document.getElementById('permissionModal').style.display = 'flex';
        return false;
    }
}

// ============ SIMULATE MATCHING (Demo Mode) ============
// Real implementation needs a Socket.io signaling server
// This simulates the connection experience for frontend demo

function simulateMatching() {
    state.isSearching = true;
    waitingOverlay.style.display = 'flex';
    waitingText.innerHTML = '<strong>Searching</strong> for someone...';
    strangerInfo.style.display = 'none';
    reportBtn.classList.remove('visible');
    if (chatTimer) chatTimer.style.display = 'none';

    // Simulate finding a match after 2-4 seconds
    const delay = 2000 + Math.random() * 2000;

    setTimeout(function() {
        if (!state.isSearching) return;
        onMatchFound();
    }, delay);
}

function onMatchFound() {
    clearConnectionTimers();
    clearConnectionNotice();
    state.isSearching = false;
    state.isConnected = true;
    if (directCallUser) {
        state.strangerName = directCallUser;
        state.strangerCountry = 'Friend';
    }

    // Hide waiting overlay
    waitingOverlay.style.display = 'none';

    // Show stranger info
    const names = ['Aarav', 'Maya', 'Kabir', 'Anaya', 'Rohan', 'Sara', 'Vivaan', 'Isha', 'Arjun', 'Naina'];
    const countries = ['🇺🇸 United States', '🇬🇧 United Kingdom', '🇩🇪 Germany',
                       '🇫🇷 France', '🇯🇵 Japan', '🇧🇷 Brazil', '🇰🇷 South Korea',
                       '🇨🇦 Canada', '🇦🇺 Australia', '🇮🇳 India'];
    state.strangerName = directCallUser || names[Math.floor(Math.random() * names.length)];
    if (strangerName) strangerName.textContent = state.strangerName;
    const preferredCountry = state.preferences.country;
    state.strangerCountry = directCallUser
        ? 'Friend'
        : (preferredCountry && preferredCountry !== 'Global'
            ? preferredCountry
            : countries[Math.floor(Math.random() * countries.length)]);
    document.getElementById('strangerCountry').textContent = state.strangerCountry;
    strangerInfo.style.display = 'flex';
    reportBtn.classList.add('visible');
    updateAddFriendButton();
    saveVideoChatHistory('connected');

    // Next is available immediately. There is no forced countdown between matches.
    startBtn.disabled = true;
    skipBtn.disabled = false;
    stopBtn.disabled = false;

    // Add system message to chat
    const matchReasons = [];
    if (state.preferences.interests.length) matchReasons.push(state.preferences.interests[0]);
    if (state.preferences.language.length) matchReasons.push(state.preferences.language[0]);
    if (state.preferences.intent) matchReasons.push(state.preferences.intent);
    addSystemMessage('Connected with ' + state.strangerName + '! Smart match' + (matchReasons.length ? ' · ' + matchReasons.join(' · ') : '') + '.');
    updateChatInputState();

    // In demo mode: mirror local video to remote as placeholder
    // (Real: remoteVideo.srcObject = remoteStream from WebRTC)
    if (state.localStream) {
        syncDemoRemoteVideoFilter();
        if (remoteBoxEl) remoteBoxEl.classList.add('has-remote-video');
    }
}

function disconnectChat(reasonTitle, reasonMessage) {
    clearConnectionTimers();
    clearSkipCooldownPopup();
    const shouldNotifyDisconnect = Boolean(reasonTitle || reasonMessage);
    if (state.isConnected && shouldNotifyDisconnect) {
        saveVideoChatHistory('disconnected');
    }
    state.isConnected = false;
    state.isSearching = false;

    remoteVideo.srcObject = null;
    remoteVideo.style.filter = '';
    if (remoteBoxEl) remoteBoxEl.classList.remove('has-remote-video');
    resetQuickChatMessages();
    setConnectionNotice(
        'ended',
        reasonTitle || 'Chat ended',
        reasonMessage || 'The stranger disconnected or the session was stopped.',
        'Find someone new'
    );
    strangerInfo.style.display = 'none';
    reportBtn.classList.remove('visible');
    updateAddFriendButton();
    if (chatTimer) chatTimer.style.display = 'none';

    stopTimer();

    startBtn.disabled = false;
    skipBtn.disabled = true;
    stopBtn.disabled = true;

    if (shouldNotifyDisconnect) {
        addSystemMessage('Disconnected. Press Start or Next to find someone new.');
    }
    updateChatInputState();
}

// ============ TIMER ============
function startTimer() {
    state.timerSeconds = 0;
    stopTimer();
    state.timerInterval = setInterval(function() {
        state.timerSeconds++;
        const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
        const s = (state.timerSeconds % 60).toString().padStart(2, '0');
        if (timerDisplay) timerDisplay.textContent = m + ':' + s;
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// ============ CHAT ============
function addSystemMessage(text) {
    showQuickMessageFeedback(text);
}

function addMessage(text, type) {
    return;
}

function clearQuickChatEmptyState() {
    if (!quickChatMessages) return;
    const empty = quickChatMessages.querySelector('.quick-chat-empty');
    if (empty) empty.remove();
}

function addQuickChatMessage(text, type) {
    if (!quickChatMessages) return;
    clearQuickChatEmptyState();

    const bubble = document.createElement('div');
    bubble.className = 'quick-chat-bubble ' + type;

    const label = document.createElement('span');
    label.className = 'quick-chat-label';
    label.textContent = type === 'sent' ? 'To ' + state.strangerName : state.strangerName;

    const content = document.createElement('span');
    content.textContent = text;

    bubble.appendChild(label);
    bubble.appendChild(content);
    quickChatMessages.appendChild(bubble);
    quickChatMessages.scrollTop = quickChatMessages.scrollHeight;
}

function resetQuickChatMessages() {
    if (!quickChatMessages) return;
    quickChatMessages.innerHTML = '';
}

function showQuickMessageFeedback(text) {
    if (!quickMessageFeedback) return;
    quickMessageFeedback.textContent = text;
    quickMessageFeedback.classList.add('visible');
    setTimeout(function() {
        quickMessageFeedback.classList.remove('visible');
    }, 1200);
}

function sendChatText(text) {
    if (!text) return;
    const safeText = moderateChatMessage(text);

    addMessage(safeText, 'sent');
    addQuickChatMessage(safeText, 'sent');
    saveVideoChatMessage(safeText, 'sent');
    showQuickMessageFeedback(safeText === '****' ? 'Filtered' : 'Sent');

    // In demo mode: auto-reply after short delay
    if (state.isConnected) {
        const replies = [
            'Hello! 👋', 'How are you?', 'Nice to meet you!',
            'Where are you from?', 'Cool!', 'Haha 😄',
            'That\'s interesting!', 'Tell me more', 'ASL?',
            '😊', 'What do you do?'
        ];
        setTimeout(function() {
            if (state.isConnected) {
                const replyText = replies[Math.floor(Math.random() * replies.length)];
                addMessage(replyText, 'received');
                addQuickChatMessage(replyText, 'received');
                saveVideoChatMessage(replyText, 'received');
                if (state.chatCollapsed) {
                    markCurrentStrangerUnread();
                }
            }
        }, 800 + Math.random() * 1200);
    }
}

function sendQuickMessage() {
    if (!quickChatInput || quickChatInput.disabled) return;
    const text = quickChatInput.value.trim();
    if (!text) return;
    sendChatText(text);
    quickChatInput.value = '';
}

// ============ BUTTON EVENTS ============

async function startVideoChat() {
    if (state.isSearching || state.isConnected) return;
    if (!prePermissionApproved) {
        const approved = await showPrePermissionModal();
        if (!approved) {
            setConnectionNotice(
                'error',
                'Permissions are required',
                'Camera and microphone access are needed before starting a video chat.',
                'Try again'
            );
            addSystemMessage('Video chat was not started because permissions were not approved.');
            return;
        }
    }

    if (!state.localStream) {
        const ok = await getLocalStream();
        if (!ok) {
            prePermissionApproved = false;
            setConnectionNotice(
                'error',
                'Camera access needed',
                'Please allow camera and microphone access, then try again.',
                'Retry'
            );
            addSystemMessage('Camera or microphone permission was not available.');
            return;
        }
    }
    clearConnectionTimers();
    setConnectionNotice(
        'waiting',
        'Finding a stable connection',
        'If your internet is slow, this can take a few seconds.',
        'Retry'
    );
    simulateMatching();
    matchingTimeout = setTimeout(function() {
        if (!state.isConnected && state.isSearching) {
            state.isSearching = false;
            startBtn.disabled = false;
            skipBtn.disabled = true;
            stopBtn.disabled = true;
            setConnectionNotice(
                'warning',
                'Connection is taking too long',
                'Your internet may be slow or no stranger is available right now.',
                'Try again'
            );
            addSystemMessage('Connection timed out. Please try again.');
        }
    }, 12000);
    startBtn.disabled = true;
    skipBtn.disabled = false;
    stopBtn.disabled = false;
}

function bindOverlayStartButton() {
    const currentOverlayStartBtn = document.getElementById('overlayStartBtn');
    if (currentOverlayStartBtn) {
        currentOverlayStartBtn.addEventListener('click', startVideoChat);
    }
}

async function switchCamera() {
    if (!flipCamBtn) return;
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    flipCamBtn.classList.toggle('active', state.facingMode === 'environment');
    flipCamBtn.title = state.facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera';

    if (state.localStream) {
        const ok = await getLocalStream();
        if (!ok) {
            state.facingMode = 'user';
            flipCamBtn.classList.remove('active');
        }
    }
}

// START
startBtn.addEventListener('click', startVideoChat);
if (overlayStartBtn) overlayStartBtn.addEventListener('click', startVideoChat);
if (flipCamBtn) flipCamBtn.addEventListener('click', switchCamera);

if (remoteVideo) {
    remoteVideo.addEventListener('stalled', function() {
        if (!state.isConnected) return;
        addSystemMessage('Video connection looks slow. You can wait or find someone new.');
        disconnectChat(
            'Video connection is unstable',
            'Your internet or the stranger connection may be slow. Try again when ready.'
        );
    });

    remoteVideo.addEventListener('error', function() {
        if (!state.isConnected) return;
        addSystemMessage('The stranger connection was lost.');
        disconnectChat(
            'Stranger disconnected',
            'The video connection was lost. Try again to meet someone new.'
        );
    });
}

// SETUP PREFERENCES
const setupCopy = [
    { title: 'Please select your gender', subtitle: 'Tell us who you want to meet first.' },
    { title: 'Please select your country', subtitle: 'Pick the place where you want to search.' },
    { title: 'Please select your interest', subtitle: 'Select one or more topics for better matches.' },
    { title: 'Please select your language', subtitle: 'Search and select the language you prefer.' },
    { title: 'What are you looking for?', subtitle: 'This helps us understand the kind of match you want.' },
    { title: 'We will match around your choices', subtitle: 'Review your preferences before opening video chat.' }
];

function isSetupStepComplete() {
    if (state.setupStep === 0) return Boolean(state.preferences.gender);
    if (state.setupStep === 1) return Boolean(state.preferences.country);
    if (state.setupStep === 2) return state.preferences.interests.length > 0;
    if (state.setupStep === 3) return state.preferences.language.length > 0;
    if (state.setupStep === 4) return Boolean(state.preferences.intent);
    return true;
}

function getSetupFieldName() {
    if (state.setupStep === 0) return 'gender';
    if (state.setupStep === 1) return 'country';
    if (state.setupStep === 2) return 'interest';
    if (state.setupStep === 3) return 'language';
    return 'match goal';
}

function showSetupError() {
    if (setupError) setupError.textContent = 'Please select your ' + getSetupFieldName() + '.';
}

function clearSetupError() {
    if (setupError) setupError.textContent = '';
}

function renderSetupStep() {
    setupSections.forEach(function(section) {
        section.classList.toggle('active', Number(section.dataset.step) === state.setupStep);
    });

    setupStepDots.forEach(function(dot, index) {
        dot.classList.toggle('active', index === state.setupStep);
        dot.classList.toggle('done', index < state.setupStep);
    });

    if (setupTitle) setupTitle.textContent = setupCopy[state.setupStep].title;
    if (setupSubtitle) setupSubtitle.textContent = setupCopy[state.setupStep].subtitle;
    if (state.setupStep === 5 && matchSummary) {
        const summaryItems = [
            ['fa-venus-mars', state.preferences.gender],
            ['fa-earth-asia', state.preferences.country],
            ['fa-heart', state.preferences.interests.slice(0, 3).join(', ')],
            ['fa-language', state.preferences.language.slice(0, 2).join(', ')],
            ['fa-wand-magic-sparkles', state.preferences.intent]
        ];
        matchSummary.innerHTML = summaryItems.map(function(item) {
            return '<span><i class="fas ' + item[0] + '"></i>' + item[1] + '</span>';
        }).join('');
    }
    if (setupNextBtn) {
        setupNextBtn.disabled = false;
        setupNextBtn.innerHTML = state.setupStep === 5
            ? 'Start Smart Matching <i class="fas fa-sparkles"></i>'
            : 'Next <i class="fas fa-arrow-right"></i>';
    }
}

function createChoiceButton(value, isActive) {
    const button = document.createElement('button');
    button.className = 'choice-chip' + (isActive ? ' active' : '');
    button.type = 'button';
    button.dataset.value = value;
    button.textContent = value;
    return button;
}

function renderSearchChoices(container, items, query, selectedValues, limit) {
    if (!container) return;
    const normalizedQuery = query.trim().toLowerCase();
    const selectedSet = new Set(Array.isArray(selectedValues) ? selectedValues : [selectedValues].filter(Boolean));
    const filtered = items.filter(function(item) {
        return item.toLowerCase().includes(normalizedQuery);
    }).slice(0, limit);

    container.innerHTML = '';
    filtered.forEach(function(item) {
        container.appendChild(createChoiceButton(item, selectedSet.has(item)));
    });
}

function renderCountryChoices() {
    renderSearchChoices(countryChoices, countries, countrySearch ? countrySearch.value : '', state.preferences.country, 80);
}

function renderLanguageChoices() {
    renderSearchChoices(languageChoices, languages, languageSearch ? languageSearch.value : '', state.preferences.language, 80);
}

document.querySelectorAll('.choice-row').forEach(function(group) {
    group.addEventListener('click', function(e) {
        const chip = e.target.closest('.choice-chip');
        if (!chip) return;

        const groupName = group.dataset.choiceGroup;
        const isMulti = group.classList.contains('multi-choice');

        if (isMulti) {
            chip.classList.toggle('active');
            const selected = Array.from(group.querySelectorAll('.choice-chip.active')).map(function(item) {
                return item.dataset.value;
            });
            state.preferences[groupName] = selected.length ? selected : [chip.dataset.value];
            if (!selected.length) chip.classList.add('active');
            clearSetupError();
            renderSetupStep();
            return;
        }

        group.querySelectorAll('.choice-chip').forEach(function(item) {
            item.classList.remove('active');
        });
        chip.classList.add('active');
        state.preferences[groupName] = chip.dataset.value;
        clearSetupError();
        renderSetupStep();
    });
});

if (countrySearch) {
    countrySearch.addEventListener('input', renderCountryChoices);
}

if (languageSearch && languageChoices) {
    languageSearch.addEventListener('input', function() {
        renderLanguageChoices();
    });
}

if (setupNextBtn && setupModal) {
    setupNextBtn.addEventListener('click', function() {
        if (!isSetupStepComplete()) {
            showSetupError();
            return;
        }
        clearSetupError();

        if (state.setupStep < 5) {
            state.setupStep += 1;
            clearSetupError();
            renderSetupStep();
            return;
        }

        setupModal.style.display = 'none';
        let existingProfile = {};
        try {
            existingProfile = JSON.parse(localStorage.getItem('vibematch_profile_data') || '{}') || {};
        } catch (error) {
            existingProfile = {};
        }
        const profileName = existingProfile.name || 'VibeMatch User';
        localStorage.setItem('vibematch_profile_data', JSON.stringify(Object.assign({}, existingProfile, {
            name: profileName,
            handle: existingProfile.handle || '@' + profileName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
            email: 'user@vibematch.com',
            phone: '+91 98765 43210',
            loginMethod: 'Email or phone',
            gender: state.preferences.gender,
            country: state.preferences.country,
            languages: state.preferences.language,
            interests: state.preferences.interests,
            matchIntent: state.preferences.intent,
            following: existingProfile.following || 248,
            profilePhoto: existingProfile.profilePhoto || '',
            updatedAt: new Date().toISOString()
        })));
        document.body.classList.remove('setup-locked');
        bindOverlayStartButton();
    });
}

renderSetupStep();
renderCountryChoices();
renderLanguageChoices();

if (directCallUser) {
    if (setupModal) setupModal.style.display = 'none';
    document.body.classList.remove('setup-locked');
    setTimeout(showDirectCallOverlay, 120);
}

if (setupBackBtn) {
    setupBackBtn.addEventListener('click', function(e) {
        if (state.setupStep === 0) return;
        e.preventDefault();
        state.setupStep -= 1;
        renderSetupStep();
    });
}

// SKIP / NEXT
skipBtn.addEventListener('click', function() {
    if (state.isConnected) {
        addSystemMessage('You skipped. Finding next person...');
        disconnectChat();
        setTimeout(simulateMatching, 400);
    } else if (state.isSearching) {
        disconnectChat();
        setTimeout(simulateMatching, 400);
    }
});

// STOP
stopBtn.addEventListener('click', function() {
    disconnectChat();
});

// MIC TOGGLE
micBtn.addEventListener('click', function() {
    if (!state.localStream) return;
    state.isMicOn = !state.isMicOn;
    state.localStream.getAudioTracks().forEach(function(track) {
        track.enabled = state.isMicOn;
    });
    micBtn.classList.toggle('muted', !state.isMicOn);
    micBtn.innerHTML = state.isMicOn
        ? '<i class="fas fa-microphone"></i>'
        : '<i class="fas fa-microphone-slash"></i>';
    micBtn.title = state.isMicOn ? 'Mute' : 'Unmute';
});

// CAMERA TOGGLE
camBtn.addEventListener('click', function() {
    if (!state.localStream) return;
    state.isCamOn = !state.isCamOn;
    state.localStream.getVideoTracks().forEach(function(track) {
        track.enabled = state.isCamOn;
    });
    camBtn.classList.toggle('cam-off', !state.isCamOn);
    camBtn.innerHTML = state.isCamOn
        ? '<i class="fas fa-video"></i>'
        : '<i class="fas fa-video-slash"></i>';
    camBtn.title = state.isCamOn ? 'Turn off camera' : 'Turn on camera';
    camOffOverlay.style.display = state.isCamOn ? 'none' : 'flex';
});

// CHAT SEND
if (quickChatSendBtn) quickChatSendBtn.addEventListener('click', sendQuickMessage);
if (quickChatInput) {
    quickChatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendQuickMessage();
    });
}
if (addFriendBtn) addFriendBtn.addEventListener('click', addCurrentStrangerAsFriend);

// CHAT DISABLE when not connected
function updateChatInputState() {
    const active = state.isConnected;
    if (quickChatHeader) {
        quickChatHeader.textContent = active ? 'Chat with ' + state.strangerName : 'Chat with Stranger';
    }
    if (quickChatInput) {
        quickChatInput.disabled = !active;
        quickChatInput.placeholder = active ? 'Message ' + state.strangerName + '...' : 'Connect to message...';
    }
    if (quickChatSendBtn) {
        quickChatSendBtn.disabled = !active;
    }
}
updateChatInputState();

// FULLSCREEN
fullscreenBtn.addEventListener('click', function() {
    const remoteBox = document.getElementById('remoteBox');
    if (!document.fullscreenElement) {
        remoteBox.requestFullscreen().catch(function() {});
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        document.exitFullscreen();
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    }
});

// EFFECTS MODAL
effectsBtn.addEventListener('click', function() {
    document.getElementById('effectsModal').style.display = 'flex';
});
document.getElementById('closeEffects').addEventListener('click', function() {
    document.getElementById('effectsModal').style.display = 'none';
});

document.querySelectorAll('.effect-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.effect-btn').forEach(function(b) {
            b.classList.remove('active');
            const mark = b.querySelector('.selected-mark');
            if (mark) mark.remove();
        });
        btn.classList.add('active');
        const selectedMark = document.createElement('span');
        selectedMark.className = 'selected-mark';
        selectedMark.textContent = 'Selected';
        btn.appendChild(selectedMark);
        state.currentMask = btn.dataset.mask || 'none';
        state.currentFilter = videoFilterMap[state.currentMask] || 'none';
        applyCurrentFilter();
        applyFaceMask(state.currentMask);
    });
});

// REPORT MODAL
reportBtn.addEventListener('click', function() {
    if (!state.isConnected) return;
    document.getElementById('reportModal').style.display = 'flex';
});
document.getElementById('closeReport').addEventListener('click', function() {
    document.getElementById('reportModal').style.display = 'none';
});
document.getElementById('reportSubmitBtn').addEventListener('click', function() {
    const selected = document.querySelector('input[name="report"]:checked');
    if (!selected) {
        alert('Please select a reason');
        return;
    }
    document.getElementById('reportModal').style.display = 'none';
    saveVideoChatHistory('reported');
    addSystemMessage('Report submitted. Thank you. Finding next person...');
    disconnectChat();
    setTimeout(simulateMatching, 1200);
});

const reportBlockBtn = document.getElementById('reportBlockBtn');
if (reportBlockBtn) {
    reportBlockBtn.addEventListener('click', function() {
        if (!state.isConnected) return;
        document.getElementById('reportModal').style.display = 'none';
        blockCurrentStranger();
    });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
        if (overlay.id === 'setupModal') return;
        if (e.target === overlay) overlay.style.display = 'none';
    });
});

// ============ CONNECT isConnected to chat ============
const origOnMatchFound = onMatchFound;
// Patch to also update chat input state
const _onMatchFound = onMatchFound;
window.onMatchFound = function() {
    _onMatchFound();
    updateChatInputState();
};

const _disconnectChat = disconnectChat;
window.disconnectChat = function() {
    _disconnectChat();
    updateChatInputState();
};
