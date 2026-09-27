const sendBtn = document.getElementById("sendBtn");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const typing = document.getElementById("typing");
const chatList = document.querySelector(".chat-list");
const inboxTab = document.getElementById("inboxTab");
const requestsTab = document.getElementById("requestsTab");
let chatItems = document.querySelectorAll(".chat");
const profile = document.querySelector(".profile");
const voiceCallBtn = document.getElementById("voiceCallBtn");
const videoCallBtn = document.getElementById("videoCallBtn");
const chatOptionsBtn = document.getElementById("chatOptionsBtn");
const profileIcon = document.querySelector(".profile .user-icon");
const profileName = document.querySelector(".profile h2");
const onlineStatus = document.querySelector(".online-status");
const conversationSearch = document.querySelector(".search-box input");
const mobileComposeBtn = document.getElementById("mobileComposeBtn");
const mobileChatBackBtn = document.getElementById("mobileChatBackBtn");
const replyPreview = document.getElementById("replyPreview");
const replyPreviewName = document.getElementById("replyPreviewName");
const replyPreviewText = document.getElementById("replyPreviewText");
const cancelReplyBtn = document.getElementById("cancelReplyBtn");

if (!sendBtn || !messageInput || !messages || !typing || !chatList || !inboxTab || !requestsTab || !profileIcon || !profileName || !onlineStatus || !voiceCallBtn || !videoCallBtn || !chatOptionsBtn) {
    throw new Error("Message page elements are missing.");
}

const videoChatStorageKey = "vibematch_video_chats";
const blockedUsersStorageKey = "vibematch_blocked_message_users";
const messageRequestsStorageKey = "vibematch_message_requests";

const defaultConversations = [
    {
        name: "Olivia",
        icon: "O",
        status: "Online",
        time: "2m",
        preview: "Typing...",
        unread: 2,
        messages: [
            { type: "received", text: "Hey, how's your day going?", time: "8:31 PM" },
            { type: "sent", text: "Pretty good. Working on VibeMatch.", time: "8:32 PM" }
        ]
    },
    {
        name: "Daniel",
        icon: "D",
        status: "Last seen 5m ago",
        time: "5m",
        preview: "See you later.",
        unread: 0,
        messages: [
            { type: "received", text: "Are you joining the video chat today?", time: "7:10 PM" },
            { type: "sent", text: "Yes, after dinner.", time: "7:12 PM" },
            { type: "received", text: "See you later.", time: "7:14 PM" }
        ]
    },
    {
        name: "Sophia",
        icon: "S",
        status: "Online",
        time: "1h",
        preview: "That looks amazing.",
        unread: 0,
        messages: [
            { type: "sent", text: "I updated the VibeMatch page.", time: "6:20 PM" },
            { type: "received", text: "That looks amazing.", time: "6:23 PM" }
        ]
    }
];

let conversations = applyBlockedUsers(mergeVideoChatConversations(defaultConversations));
let messageRequests = readMessageRequests();

let activeChatIndex = null;
let activeSection = "inbox";
let replyTimer;
let selectedMessageIndex = null;
let profileMenuContext = null;
let searchTerm = "";
let selectedReactionMessage = null;
let replyContext = null;
let activeCallState = null;

function requestMessageTokenForName(name) {
    if (!window.VibeMatchTokens) return true;
    return window.VibeMatchTokens.requestChatAccess(name || "User");
}

function requestMessageTokenForConversation(conversation) {
    if (!conversation || activeSection === "requests") return true;
    return requestMessageTokenForName(conversation.name);
}

function clearAllMessageUnread() {
    conversations.forEach(function(conversation) {
        conversation.unread = 0;
    });
    writeVideoChatConversations();
}

const messageMenu = document.createElement("div");
messageMenu.className = "message-action-menu";
document.body.appendChild(messageMenu);

const reactionMenu = document.createElement("div");
reactionMenu.className = "reaction-menu";
reactionMenu.innerHTML = `
    <button type="button" data-emoji="❤">❤</button>
    <button type="button" data-emoji="😂">😂</button>
    <button type="button" data-emoji="😮">😮</button>
    <button type="button" data-emoji="😔">😔</button>
    <button type="button" data-emoji="😢">😢</button>
    <button type="button" data-emoji="😡">😡</button>
    <button type="button" data-emoji="👍">👍</button>
    <button type="button" data-emoji-custom="true">+</button>
`;
document.body.appendChild(reactionMenu);

const profileMenu = document.createElement("div");
profileMenu.className = "profile-action-menu";
profileMenu.innerHTML = `
    <button type="button" data-profile-action="pin"><i class="fa-solid fa-thumbtack"></i><span>Pin chat</span></button>
    <button type="button" data-profile-action="read"><i class="fa-solid fa-envelope-open"></i><span>Mark unread</span></button>
    <button type="button" data-profile-action="clear"><i class="fa-solid fa-broom"></i><span>Clear messages</span></button>
    <button type="button" data-profile-action="block" class="danger"><i class="fa-solid fa-ban"></i><span>Block user</span></button>
    <button type="button" data-profile-action="delete" class="danger"><i class="fa-solid fa-trash"></i><span>Delete chat</span></button>
`;
document.body.appendChild(profileMenu);

function renderChatList() {
    chatList.innerHTML = "";
    inboxTab.classList.toggle("active", activeSection === "inbox");
    requestsTab.classList.toggle("active", activeSection === "requests");

    const sourceList = activeSection === "requests" ? messageRequests : conversations;
    const list = sourceList
        .map(function(conversation, index) {
            return { conversation: conversation, index: index };
        })
        .filter(function(item) {
            return !searchTerm || JSON.stringify(item.conversation).toLowerCase().includes(searchTerm);
        });

    if (!list.length) {
        chatList.innerHTML = activeSection === "requests"
            ? '<div class="empty-chat-state compact">No message requests.</div>'
            : '<div class="empty-chat-state compact">No conversations found.</div>';
        return;
    }

    list.forEach(function(item) {
        const conversation = item.conversation;
        const index = item.index;
        const chat = document.createElement("div");
        chat.className = "chat";
        chat.dataset.index = index;
        chat.innerHTML = `
            <div class="user-icon"></div>
            <div class="chat-details">
                <div class="chat-top">
                    <h2></h2>
                    <span></span>
                </div>
                <div class="chat-bottom">
                    <p></p>
                </div>
            </div>
        `;
        chat.addEventListener("click", function() {
            selectChat(index);
        });
        chat.querySelector(".user-icon").addEventListener("click", function(event) {
            event.stopPropagation();
            const contextKey = `chat-${index}`;

            if (profileMenu.classList.contains("show") && profileMenuContext === contextKey) {
                hideProfileMenu();
                return;
            }

            if (activeChatIndex !== index && !selectChat(index, false)) {
                return;
            }

            const currentChat = chatList.querySelector(`[data-index="${activeChatIndex}"]`);
            showProfileMenu(currentChat || chat, contextKey);
        });
        chatList.appendChild(chat);

        chat.dataset.index = index;
        chat.classList.toggle("active", index === activeChatIndex);
        chat.classList.toggle("pinned", Boolean(conversation.pinned));
        chat.classList.toggle("blocked-chat", Boolean(conversation.blocked));
        chat.querySelector(".user-icon").textContent = conversation.icon;
        chat.querySelector("h2").textContent = conversation.name;
        chat.querySelector(".chat-top span").textContent = conversation.pinned ? "Pinned" : conversation.time;
        chat.querySelector(".chat-bottom p").textContent = activeSection === "requests"
            ? "Message request"
            : (conversation.blocked ? "Blocked user" : conversation.preview);

        let badge = chat.querySelector(".badge");

        if (conversation.unread > 0) {
            if (!badge) {
                badge = document.createElement("div");
                badge.className = "badge";
                chat.querySelector(".chat-bottom").appendChild(badge);
            }

            badge.textContent = conversation.unread;
        } else if (badge) {
            badge.remove();
        }
    });

    chatItems = document.querySelectorAll(".chat");
}

function readMessageRequests() {
    try {
        const saved = JSON.parse(localStorage.getItem(messageRequestsStorageKey) || "null");
        if (Array.isArray(saved)) return saved;
    } catch (error) {}

    return [];
}

function writeMessageRequests() {
    localStorage.setItem(messageRequestsStorageKey, JSON.stringify(messageRequests));
}

function readVideoChatConversations() {
    try {
        const saved = JSON.parse(localStorage.getItem(videoChatStorageKey) || "[]");
        return Array.isArray(saved)
            ? saved.filter(function(item) {
                return item && item.status !== "From video chat";
            })
            : [];
    } catch (error) {
        return [];
    }
}

function readBlockedUsers() {
    try {
        const saved = JSON.parse(localStorage.getItem(blockedUsersStorageKey) || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function writeBlockedUsers() {
    const blockedNames = conversations
        .filter(function(item) {
            return item.blocked;
        })
        .map(function(item) {
            return item.name;
        });

    localStorage.setItem(blockedUsersStorageKey, JSON.stringify(blockedNames));
}

function applyBlockedUsers(items) {
    const blockedNames = new Set(readBlockedUsers());

    return items.map(function(item) {
        item.blocked = blockedNames.has(item.name) || Boolean(item.blocked);
        return item;
    });
}

function normalizeConversationMessages(item, fallbackAt) {
    const messagesList = Array.isArray(item.messages) ? item.messages : [];
    const safeFallbackAt = fallbackAt || item.lastMessageAt || item.updatedAt || new Date().toISOString();

    return messagesList.map(function(message) {
        if (!message || typeof message !== "object") return message;
        if (message.at || message.date) return message;
        return Object.assign({}, message, { at: safeFallbackAt });
    });
}

function mergeVideoChatConversations(defaultItems) {
    const savedItems = readVideoChatConversations().map(function(item) {
        const name = item.name || "Stranger";
        const messages = normalizeConversationMessages(item, item.lastMessageAt || item.updatedAt || item.requestedAt);

        return {
            name: name,
            icon: item.icon || name.charAt(0).toUpperCase() || "S",
            status: item.status || "From video chat",
            time: item.time || "now",
            preview: item.preview || (messages[messages.length - 1] ? messages[messages.length - 1].text : "Video chat conversation"),
            unread: item.unread || 0,
            pinned: Boolean(item.pinned),
            blocked: Boolean(item.blocked),
            messages: messages
        };
    });

    const savedNames = new Set(savedItems.map(function(item) {
        return item.name;
    }));
    const remainingDefaults = defaultItems.filter(function(item) {
        return !savedNames.has(item.name);
    }).map(function(item) {
        return Object.assign({}, item, {
            messages: normalizeConversationMessages(item)
        });
    });

    return savedItems.concat(remainingDefaults);
}

function writeVideoChatConversations() {
    const savedChats = conversations.filter(function(item) {
        return item && item.name;
    }).map(function(item) {
        const messagesList = normalizeConversationMessages(item);
        const lastMessage = messagesList[messagesList.length - 1];
        const lastMessageAt = (lastMessage && (lastMessage.at || lastMessage.date)) || item.lastMessageAt || item.updatedAt || "";

        return Object.assign({}, item, {
            icon: item.icon || item.name.charAt(0).toUpperCase(),
            status: item.status || "Active now",
            time: item.time || "",
            preview: item.preview || (lastMessage ? lastMessage.text : "No messages yet."),
            unread: Number(item.unread || 0),
            pinned: Boolean(item.pinned),
            blocked: Boolean(item.blocked),
            messages: messagesList,
            lastMessageAt: lastMessageAt,
            updatedAt: item.updatedAt || lastMessageAt
        });
    });
    localStorage.setItem(videoChatStorageKey, JSON.stringify(savedChats));
}

function renderActiveChat() {
    const conversation = activeSection === "requests"
        ? messageRequests[activeChatIndex]
        : conversations[activeChatIndex];

    if (!conversation) {
        profileIcon.textContent = "";
        profileName.textContent = "Select a chat";
        onlineStatus.textContent = "";
        chatOptionsBtn.disabled = true;
        voiceCallBtn.disabled = true;
        videoCallBtn.disabled = true;
        typing.style.display = "none";
        messages.innerHTML = '<div class="empty-chat-state">Choose someone from the message list to open a conversation.</div>';
        messageInput.disabled = true;
        sendBtn.disabled = true;
        messageInput.placeholder = "Select a conversation first";
        return;
    }

    profileIcon.textContent = conversation.icon;
    profileName.textContent = conversation.name;
    chatOptionsBtn.disabled = activeSection === "requests";
    voiceCallBtn.disabled = activeSection === "requests" || Boolean(conversation.blocked);
    videoCallBtn.disabled = activeSection === "requests" || Boolean(conversation.blocked);
    onlineStatus.textContent = conversation.status;
    typing.textContent = `${conversation.name} is typing...`;
    typing.style.display = "none";
    messages.innerHTML = "";

    conversation.messages.forEach(function(message, index) {
        const previous = conversation.messages[index - 1];
        const currentDateKey = getMessageDateKey(message);
        if (!previous || getMessageDateKey(previous) !== currentDateKey) {
            addDateSeparator(message);
        }
        addMessageToScreen(message.type, message.text, message.time, index);
    });

    if (activeSection === "requests") {
        addRequestNotice(conversation.name);
    }

    if (conversation.blocked) {
        addBlockedNotice(conversation.name);
    }

    messages.scrollTop = messages.scrollHeight;
    messageInput.disabled = activeSection === "requests" || Boolean(conversation.blocked);
    sendBtn.disabled = activeSection === "requests" || Boolean(conversation.blocked);
    messageInput.placeholder = activeSection === "requests"
        ? "Accept request to reply"
        : (conversation.blocked ? "Unblock to send messages" : "Write a message...");
    onlineStatus.textContent = activeSection === "requests" ? "Request pending" : (conversation.blocked ? "Blocked" : conversation.status);
}

function addMessageToScreen(type, text, time, index) {
    const conversation = getActiveConversation();
    const messageDiv = document.createElement("div");
    const metaElement = document.createElement("div");
    const textElement = document.createElement("p");
    const timeElement = document.createElement("span");
    const message = conversation && conversation.messages ? conversation.messages[index] : null;

    messageDiv.classList.add("message", type);
    messageDiv.dataset.index = index;
    metaElement.className = "message-sender";
    metaElement.textContent = type === "sent" ? "You" : (conversation ? conversation.name : "User");
    textElement.textContent = text;
    timeElement.textContent = time;

    messageDiv.appendChild(metaElement);
    if (message && message.replyTo) {
        const replyQuote = document.createElement("div");
        replyQuote.className = "message-reply-quote";
        replyQuote.innerHTML = '<strong></strong><p></p>';
        replyQuote.querySelector("strong").textContent = message.replyTo.name;
        replyQuote.querySelector("p").textContent = message.replyTo.text;
        messageDiv.appendChild(replyQuote);
    }
    messageDiv.appendChild(textElement);
    if (type === "received") {
        const incomingAvatar = document.createElement("div");
        incomingAvatar.className = "message-avatar";
        incomingAvatar.setAttribute("aria-hidden", "true");
        messageDiv.appendChild(incomingAvatar);
    }
    if (message && message.reaction) {
        const reaction = document.createElement("button");
        reaction.className = "message-reaction";
        reaction.type = "button";
        reaction.textContent = message.reaction;
        messageDiv.appendChild(reaction);
    }
    if (message && message.pinned) {
        const pinned = document.createElement("small");
        pinned.className = "message-pin-label";
        pinned.textContent = "Pinned";
        messageDiv.appendChild(pinned);
    }
    messageDiv.appendChild(timeElement);
    attachMessageTimeReveal(messageDiv, type);
    messages.appendChild(messageDiv);
}

function addMessageWithDateSeparator(type, text, time, index) {
    const conversation = getActiveConversation();
    const message = conversation && conversation.messages ? conversation.messages[index] : null;
    const previous = conversation && conversation.messages ? conversation.messages[index - 1] : null;

    if (message && (!previous || getMessageDateKey(previous) !== getMessageDateKey(message))) {
        addDateSeparator(message);
    }

    addMessageToScreen(type, text, time, index);
}

function getMessageDateKey(message) {
    const value = message && (message.date || message.at);
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
}

function formatMessageDateLabel(message) {
    const value = message && (message.date || message.at);
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "long"
    }).format(safeDate);
}

function addDateSeparator(message) {
    const separator = document.createElement("div");
    separator.className = "date-separator";
    separator.textContent = formatMessageDateLabel(message);
    messages.appendChild(separator);
}

function attachMessageTimeReveal(messageElement, type) {
    let startX = 0;
    let isDragging = false;
    let hideTimer = null;

    messageElement.addEventListener("pointerdown", function(event) {
        startX = event.clientX;
        isDragging = true;
        clearTimeout(hideTimer);
    });

    messageElement.addEventListener("pointermove", function(event) {
        if (!isDragging) return;
        const deltaX = event.clientX - startX;
        const reveal = type === "sent" ? deltaX < -18 : deltaX > 18;
        if (!reveal) return;

        const pull = Math.max(-18, Math.min(18, deltaX / 4));
        messageElement.classList.add("show-time");
        messageElement.style.transform = "translateX(" + pull + "px)";
    });

    function releaseMessage() {
        if (!isDragging) return;
        isDragging = false;
        messageElement.style.transform = "";
        hideTimer = setTimeout(function() {
            messageElement.classList.remove("show-time");
        }, 1200);
    }

    messageElement.addEventListener("pointerup", releaseMessage);
    messageElement.addEventListener("pointercancel", releaseMessage);
    messageElement.addEventListener("pointerleave", releaseMessage);
}

function addBlockedNotice(name) {
    const notice = document.createElement("div");
    notice.className = "blocked-user-notice";
    notice.innerHTML = `
        <div class="blocked-user-icon"><i class="fa-solid fa-ban"></i></div>
        <div>
            <h3>${name} is blocked</h3>
            <p>You won't receive messages from this user. Unblock to message again.</p>
        </div>
        <button type="button" class="unblock-user-btn">Unblock</button>
    `;
    messages.appendChild(notice);
}

function addRequestNotice(name) {
    const notice = document.createElement("div");
    notice.className = "message-request-notice";
    notice.innerHTML = `
        <div class="request-notice-icon"><i class="fa-solid fa-envelope-open-text"></i></div>
        <div>
            <h3>${name} wants to message you</h3>
            <p>Accept this request before replying. They won't know you viewed it until you accept.</p>
        </div>
        <div class="request-actions">
            <button type="button" class="delete-request-btn">Delete</button>
            <button type="button" class="accept-request-btn">Accept</button>
        </div>
    `;
    messages.appendChild(notice);
}

function selectChat(index, shouldFocus = true) {
    const list = activeSection === "requests" ? messageRequests : conversations;
    const conversation = list[index];
    if (!conversation || !requestMessageTokenForConversation(conversation)) {
        return false;
    }

    activeChatIndex = index;
    document.body.classList.add("mobile-chat-open");
    if (list[activeChatIndex]) {
        list[activeChatIndex].unread = 0;
    }

    clearTimeout(replyTimer);
    clearReplyContext();
    hideProfileMenu();
    renderChatList();
    renderActiveChat();
    writeVideoChatConversations();
    writeMessageRequests();
    if (shouldFocus && activeSection !== "requests") {
        messageInput.focus();
    }
    return true;
}

function showInboxList() {
    activeChatIndex = null;
    document.body.classList.remove("mobile-chat-open");
    hideMessageMenu();
    hideProfileMenu();
    clearReplyContext();
    renderChatList();
    renderActiveChat();
}

function createConversationFromName(name) {
    const cleanName = name.trim();
    if (!cleanName) return;
    const now = new Date().toISOString();

    const existingIndex = conversations.findIndex(function(item) {
        return item.name.toLowerCase() === cleanName.toLowerCase();
    });

    if (existingIndex >= 0) {
        activeSection = "inbox";
        selectChat(existingIndex);
        return;
    }

    if (!requestMessageTokenForName(cleanName)) {
        return;
    }

    conversations.unshift({
        name: cleanName,
        icon: cleanName.charAt(0).toUpperCase(),
        status: "Active now",
        time: "now",
        preview: "New conversation",
        unread: 0,
        updatedAt: now,
        lastMessageAt: "",
        messages: []
    });
    activeSection = "inbox";
    activeChatIndex = 0;
    renderChatList();
    renderActiveChat();
    writeVideoChatConversations();
    document.body.classList.add("mobile-chat-open");
    messageInput.focus();
}

function sendMessage() {
    if (!conversations[activeChatIndex]) {
        return;
    }

    if (conversations[activeChatIndex].blocked) {
        return;
    }

    const text = messageInput.value.trim();

    if (text === "") {
        return;
    }

    if (!requestMessageTokenForConversation(conversations[activeChatIndex])) {
        return;
    }

    const currentTime = getTime();
    const sentAt = new Date().toISOString();
    const conversation = conversations[activeChatIndex];
    const nextMessage = { type: "sent", text: text, time: currentTime, at: sentAt };
    if (replyContext) {
        nextMessage.replyTo = {
            name: replyContext.name,
            text: replyContext.text
        };
    }

    conversation.messages.push(nextMessage);
    conversation.preview = text;
    conversation.time = "now";
    conversation.lastMessageAt = sentAt;
    conversation.updatedAt = sentAt;

    addMessageWithDateSeparator("sent", text, currentTime, conversation.messages.length - 1);
    messageInput.value = "";
    clearReplyContext();
    messages.scrollTop = messages.scrollHeight;
    renderChatList();
    writeVideoChatConversations();
    fakeReply();
}

function canReceiveMessage(conversation) {
    return Boolean(conversation && !conversation.blocked);
}

function receiveMessage(chatIndex, text) {
    const conversation = conversations[chatIndex];

    if (!canReceiveMessage(conversation)) {
        return;
    }

    const replyTime = getTime();
    const receivedAt = new Date().toISOString();
    conversation.messages.push({ type: "received", text: text, time: replyTime, at: receivedAt });
    conversation.preview = text;
    conversation.time = "now";
    conversation.lastMessageAt = receivedAt;
    conversation.updatedAt = receivedAt;

    if (chatIndex === activeChatIndex) {
        typing.style.display = "none";
        addMessageWithDateSeparator("received", text, replyTime, conversation.messages.length - 1);
        messages.scrollTop = messages.scrollHeight;
    } else {
        conversation.unread += 1;
    }

    renderChatList();
    writeVideoChatConversations();
}

function getTime() {
    const date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? "0" + minutes : minutes;

    return `${hours}:${minutes} ${ampm}`;
}

function fakeReply() {
    const replyChatIndex = activeChatIndex;
    const conversation = conversations[replyChatIndex];
    if (!canReceiveMessage(conversation)) return;

    typing.style.display = "block";

    replyTimer = setTimeout(function() {
        if (!canReceiveMessage(conversation)) {
            typing.style.display = "none";
            return;
        }

        receiveMessage(replyChatIndex, "That sounds great.");
    }, 1200);
}

function moveConversationToTop(index) {
    if (index <= 0 || !conversations[index]) return 0;
    const conversation = conversations.splice(index, 1)[0];
    conversations.unshift(conversation);
    return 0;
}

function showProfileMenu(anchorElement = profile, contextKey = "header") {
    if (activeSection === "requests") return;
    const conversation = conversations[activeChatIndex];
    if (!conversation) return;

    hideMessageMenu();
    profileMenuContext = contextKey;

    const pinButton = profileMenu.querySelector('[data-profile-action="pin"] span');
    const readButton = profileMenu.querySelector('[data-profile-action="read"] span');
    const blockButton = profileMenu.querySelector('[data-profile-action="block"] span');

    if (pinButton) pinButton.textContent = conversation.pinned ? "Unpin chat" : "Pin chat";
    if (readButton) readButton.textContent = conversation.unread > 0 ? "Mark read" : "Mark unread";
    if (blockButton) blockButton.textContent = conversation.blocked ? "Unblock user" : "Block user";

    const rect = anchorElement.getBoundingClientRect();
    const menuWidth = 190;
    const left = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.left + rect.width - menuWidth));
    const top = Math.min(window.innerHeight - 180, rect.bottom + 8);

    profileMenu.style.left = `${left}px`;
    profileMenu.style.top = `${top}px`;
    profileMenu.classList.add("show");
}

function hideProfileMenu() {
    profileMenuContext = null;
    profileMenu.classList.remove("show");
}

function setActiveChatAfterRemoval() {
    activeChatIndex = null;
    document.body.classList.remove("mobile-chat-open");
}

function clearActiveConversation() {
    const conversation = conversations[activeChatIndex];
    if (!conversation) return;

    if (!confirm(`Clear all messages with ${conversation.name}?`)) return;

    conversation.messages = [];
    conversation.preview = "No messages yet.";
    conversation.time = "";
    conversation.unread = 0;
    clearTimeout(replyTimer);
    hideProfileMenu();
    renderActiveChat();
    renderChatList();
    writeVideoChatConversations();
}

function deleteActiveConversation() {
    const conversation = conversations[activeChatIndex];
    if (!conversation) return;

    if (!confirm(`Delete chat with ${conversation.name}?`)) return;

    conversations.splice(activeChatIndex, 1);
    clearTimeout(replyTimer);
    hideProfileMenu();
    setActiveChatAfterRemoval();
    renderChatList();
    renderActiveChat();
    writeVideoChatConversations();
}

function togglePinActiveConversation() {
    const conversation = conversations[activeChatIndex];
    if (!conversation) return;

    conversation.pinned = !conversation.pinned;
    if (conversation.pinned) {
        activeChatIndex = moveConversationToTop(activeChatIndex);
    }
    hideProfileMenu();
    renderChatList();
    renderActiveChat();
    writeVideoChatConversations();
}

function toggleReadActiveConversation() {
    const conversation = conversations[activeChatIndex];
    if (!conversation) return;

    conversation.unread = conversation.unread > 0 ? 0 : 1;
    hideProfileMenu();
    renderChatList();
    writeVideoChatConversations();
}

function toggleBlockActiveConversation() {
    const conversation = conversations[activeChatIndex];
    if (!conversation) return;

    conversation.blocked = !conversation.blocked;
    conversation.unread = 0;
    clearTimeout(replyTimer);
    typing.style.display = "none";
    hideProfileMenu();
    renderActiveChat();
    renderChatList();
    writeBlockedUsers();
    writeVideoChatConversations();
}

function handleProfileAction(action) {
    if (action === "pin") {
        togglePinActiveConversation();
        return;
    }
    if (action === "read") {
        toggleReadActiveConversation();
        return;
    }
    if (action === "clear") {
        clearActiveConversation();
        return;
    }
    if (action === "block") {
        toggleBlockActiveConversation();
        return;
    }
    if (action === "delete") {
        deleteActiveConversation();
    }
}

function updateConversationPreview(conversation) {
    const lastMessage = conversation.messages[conversation.messages.length - 1];

    if (lastMessage) {
        conversation.preview = lastMessage.text;
        conversation.time = lastMessage.time;
    } else {
        conversation.preview = "No messages yet.";
        conversation.time = "";
        conversation.unread = 0;
    }
}

function showMessageMenu(messageElement) {
    selectedMessageIndex = Number(messageElement.dataset.index);
    const isSent = messageElement.classList.contains("sent");
    messageMenu.innerHTML = isSent
        ? `
            <button type="button" data-action="delete">Delete for me</button>
            <button type="button" data-action="unsend">Unsend</button>
            <button type="button" data-action="pin">Pin</button>
            <button type="button" data-action="forward">Forward</button>
            <button type="button" data-action="reply">Reply</button>
        `
        : `
            <button type="button" data-action="reply">Reply</button>
            <button type="button" data-action="forward">Forward</button>
            <button type="button" data-action="pin">Pin</button>
            <button type="button" data-action="deleteForYou">Delete for you</button>
        `;

    const rect = messageElement.getBoundingClientRect();
    const menuWidth = 178;
    const gap = 8;
    const left = Math.min(
        window.innerWidth - menuWidth - 12,
        Math.max(12, rect.left + rect.width - menuWidth)
    );
    const top = Math.min(
        window.innerHeight - 92,
        rect.bottom + gap
    );

    document.querySelectorAll(".message.menu-open").forEach(function(item) {
        item.classList.remove("menu-open");
    });

    messageElement.classList.add("menu-open");
    messageMenu.style.left = `${left}px`;
    messageMenu.style.top = `${top}px`;
    messageMenu.classList.add("show");
}

function showReactionMenu(messageElement) {
    selectedReactionMessage = Number(messageElement.dataset.index);
    hideMessageMenu();
    const rect = messageElement.getBoundingClientRect();
    const menuWidth = 320;
    const left = Math.min(
        window.innerWidth - menuWidth - 12,
        Math.max(12, rect.left + (rect.width / 2) - (menuWidth / 2))
    );
    const top = Math.max(12, rect.top - 54);

    reactionMenu.style.left = `${left}px`;
    reactionMenu.style.top = `${top}px`;
    reactionMenu.classList.add("show");
}

function hideMessageMenu() {
    selectedMessageIndex = null;
    messageMenu.classList.remove("show");

    document.querySelectorAll(".message.menu-open").forEach(function(item) {
        item.classList.remove("menu-open");
    });
}

function hideReactionMenu() {
    selectedReactionMessage = null;
    reactionMenu.classList.remove("show");
}

function deleteSelectedMessage(action) {
    const conversation = conversations[activeChatIndex];

    if (selectedMessageIndex === null || !conversation.messages[selectedMessageIndex]) {
        hideMessageMenu();
        return;
    }

    conversation.messages.splice(selectedMessageIndex, 1);
    updateConversationPreview(conversation);
    hideMessageMenu();
    renderActiveChat();
    renderChatList();
    writeVideoChatConversations();

    if (action === "unsend") {
        typing.textContent = "Message unsent";
        typing.style.display = "block";

        setTimeout(function() {
            typing.style.display = "none";
            typing.textContent = `${conversations[activeChatIndex].name} is typing...`;
        }, 1200);
    }
}

function handleMessageAction(action) {
    const conversation = conversations[activeChatIndex];
    const message = conversation && conversation.messages[selectedMessageIndex];
    if (!message) {
        hideMessageMenu();
        return;
    }

    if (action === "delete" || action === "deleteForYou" || action === "unsend") {
        deleteSelectedMessage(action);
        return;
    }

    if (action === "pin") {
        message.pinned = !message.pinned;
        hideMessageMenu();
        renderActiveChat();
        writeVideoChatConversations();
        return;
    }

    if (action === "forward") {
        const targetName = prompt("Forward to");
        if (targetName && targetName.trim()) {
            forwardMessageTo(targetName.trim(), message.text);
        }
        hideMessageMenu();
        return;
    }

    if (action === "reply") {
        setReplyContext({
            name: message.type === "sent" ? "You" : conversation.name,
            text: message.text
        });
        messageInput.focus();
        hideMessageMenu();
    }
}

function setReplyContext(context) {
    replyContext = context;
    if (!replyPreview || !replyPreviewName || !replyPreviewText) return;
    replyPreviewName.textContent = "Replying to " + context.name;
    replyPreviewText.textContent = context.text;
    replyPreview.hidden = false;
}

function clearReplyContext() {
    replyContext = null;
    if (replyPreview) replyPreview.hidden = true;
    if (replyPreviewText) replyPreviewText.textContent = "";
}

function forwardMessageTo(targetName, text) {
    const forwardedAt = new Date().toISOString();
    if (!requestMessageTokenForName(targetName)) {
        return;
    }

    let targetIndex = conversations.findIndex(function(item) {
        return item.name.toLowerCase() === targetName.toLowerCase();
    });

    if (targetIndex < 0) {
        conversations.unshift({
            name: targetName,
            icon: targetName.charAt(0).toUpperCase(),
            status: "Active now",
            time: "now",
            preview: "Forwarded: " + text,
            unread: 0,
            updatedAt: forwardedAt,
            lastMessageAt: "",
            messages: []
        });
        targetIndex = 0;
    }

    const target = conversations[targetIndex];
    target.messages.push({
        type: "sent",
        text: "Forwarded: " + text,
        time: getTime(),
        at: forwardedAt
    });
    target.preview = "Forwarded: " + text;
    target.time = "now";
    target.lastMessageAt = forwardedAt;
    target.updatedAt = forwardedAt;
    activeSection = "inbox";
    activeChatIndex = targetIndex;
    document.body.classList.add("mobile-chat-open");
    renderChatList();
    renderActiveChat();
    writeVideoChatConversations();
}

function applyReaction(emoji) {
    const conversation = conversations[activeChatIndex];
    const message = conversation && conversation.messages[selectedReactionMessage];
    if (!message || !emoji) {
        hideReactionMenu();
        return;
    }

    message.reaction = emoji;
    hideReactionMenu();
    renderActiveChat();
    writeVideoChatConversations();
}

chatItems.forEach(function(chat, index) {
    chat.addEventListener("click", function() {
        selectChat(index);
    });
});

chatOptionsBtn.addEventListener("click", function(event) {
    event.stopPropagation();
    if (profileMenu.classList.contains("show") && profileMenuContext === "header") {
        hideProfileMenu();
        return;
    }
    showProfileMenu(chatOptionsBtn, "header");
});

sendBtn.addEventListener("click", sendMessage);

if (conversationSearch) {
    conversationSearch.addEventListener("input", function() {
        searchTerm = conversationSearch.value.trim().toLowerCase();
        renderChatList();
    });
}

if (mobileChatBackBtn) {
    mobileChatBackBtn.addEventListener("click", showInboxList);
}

if (mobileComposeBtn) {
    mobileComposeBtn.addEventListener("click", function() {
        const name = prompt("Start a chat with");
        if (name) createConversationFromName(name);
    });
}

if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", clearReplyContext);
}

messageInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});

messages.addEventListener("click", function(event) {
    const reactionButton = event.target.closest(".message-reaction");
    if (reactionButton) {
        event.stopPropagation();
        return;
    }

    if (event.target.closest(".accept-request-btn")) {
        event.stopPropagation();
        acceptActiveRequest();
        return;
    }

    if (event.target.closest(".delete-request-btn")) {
        event.stopPropagation();
        deleteActiveRequest();
        return;
    }

    if (event.target.closest(".unblock-user-btn")) {
        event.stopPropagation();
        const conversation = conversations[activeChatIndex];
        if (conversation && conversation.blocked) {
            toggleBlockActiveConversation();
        }
        return;
    }

    const messageElement = event.target.closest(".message");

    if (!messageElement || !messages.contains(messageElement)) {
        return;
    }

    event.stopPropagation();
    showMessageMenu(messageElement);
});

messages.addEventListener("dblclick", function(event) {
    const reactionButton = event.target.closest(".message-reaction");
    if (!reactionButton) return;

    const messageElement = reactionButton.closest(".message");
    const conversation = conversations[activeChatIndex];
    const messageIndex = messageElement ? Number(messageElement.dataset.index) : -1;
    if (!conversation || !conversation.messages[messageIndex]) return;

    event.stopPropagation();
    delete conversation.messages[messageIndex].reaction;
    renderActiveChat();
    writeVideoChatConversations();
});

let longPressTimer = null;
let longPressTarget = null;

messages.addEventListener("pointerdown", function(event) {
    const messageElement = event.target.closest(".message");
    if (!messageElement || !messages.contains(messageElement)) return;
    longPressTarget = messageElement;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(function() {
        if (longPressTarget) showReactionMenu(longPressTarget);
    }, 520);
});

["pointerup", "pointercancel", "pointerleave"].forEach(function(eventName) {
    messages.addEventListener(eventName, function() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        longPressTarget = null;
    });
});

function switchMessageSection(section) {
    activeSection = section;
    activeChatIndex = null;
    document.body.classList.remove("mobile-chat-open");
    hideMessageMenu();
    hideProfileMenu();
    clearReplyContext();
    clearTimeout(replyTimer);
    renderChatList();
    renderActiveChat();
}

function acceptActiveRequest() {
    const request = messageRequests[activeChatIndex];
    if (!request) return;
    if (!requestMessageTokenForName(request.name)) return;

    const lastMessage = request.messages && request.messages[request.messages.length - 1];
    const acceptedAt = (lastMessage && (lastMessage.at || lastMessage.date)) || new Date().toISOString();

    request.status = "From request";
    request.preview = request.messages[request.messages.length - 1]
        ? request.messages[request.messages.length - 1].text
        : "Request accepted.";
    request.unread = 0;
    request.lastMessageAt = acceptedAt;
    request.updatedAt = acceptedAt;
    conversations.unshift(request);
    messageRequests.splice(activeChatIndex, 1);
    writeMessageRequests();
    writeVideoChatConversations();
    activeSection = "inbox";
    activeChatIndex = 0;
    renderChatList();
    renderActiveChat();
    messageInput.focus();
}

function deleteActiveRequest() {
    if (!messageRequests[activeChatIndex]) return;
    messageRequests.splice(activeChatIndex, 1);
    writeMessageRequests();
    activeChatIndex = null;
    document.body.classList.remove("mobile-chat-open");
    renderChatList();
    renderActiveChat();
}

function getActiveConversation() {
    return activeSection === "requests"
        ? messageRequests[activeChatIndex]
        : conversations[activeChatIndex];
}

function showCallBox(callType) {
    const conversation = getActiveConversation();
    if (!conversation || activeSection === "requests" || conversation.blocked) return;

    hideMessageMenu();
    hideReactionMenu();
    hideProfileMenu();

    const existing = document.querySelector(".call-box-overlay");
    if (existing) existing.remove();

    if (!activeCallState || activeCallState.name !== conversation.name || activeCallState.type !== callType) {
        activeCallState = {
            type: callType,
            name: conversation.name,
            icon: conversation.icon || conversation.name.charAt(0).toUpperCase(),
            hold: false,
            speaker: false,
            mute: false
        };
    }

    const isVideoCall = activeCallState.type === "video";
    const callLabel = isVideoCall ? "Video call" : "Audio call";
    const callIcon = isVideoCall ? "fa-video" : "fa-phone";
    const userInitial = activeCallState.icon;
    const overlay = document.createElement("div");
    overlay.className = "call-box-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", callLabel + " with " + activeCallState.name);
    overlay.innerHTML = `
        <div class="call-box">
            <div class="call-box-user">
                <div class="call-box-avatar"></div>
                <h2 class="call-box-name"></h2>
            </div>
            <div class="call-box-meta">
                <span class="call-box-type"><i class="fa-solid ${callIcon}"></i> ${callLabel}</span>
                <span class="call-box-status"></span>
            </div>
            <div class="call-box-controls" aria-label="Call controls">
                <button type="button" class="call-box-control" data-action="hold" aria-pressed="false">
                    <i class="fa-solid fa-pause"></i>
                    <span>Hold</span>
                </button>
                <button type="button" class="call-box-control" data-action="speaker" aria-pressed="false">
                    <i class="fa-solid fa-volume-high"></i>
                    <span>Speaker</span>
                </button>
                <button type="button" class="call-box-control" data-action="mute" aria-pressed="false">
                    <i class="fa-solid fa-microphone-slash"></i>
                    <span>Mute</span>
                </button>
                <button type="button" class="call-box-control end-call" data-action="end" aria-label="End call">
                    <i class="fa-solid fa-phone-slash"></i>
                    <span>End</span>
                </button>
            </div>
        </div>
    `;
    overlay.querySelector(".call-box-avatar").textContent = userInitial;
    overlay.querySelector(".call-box-name").textContent = activeCallState.name;
    document.body.appendChild(overlay);

    const status = overlay.querySelector(".call-box-status");
    function setCallStatus(text, animated) {
        if (!status) return;
        status.innerHTML = animated
            ? text + '<span class="ringing-dots" aria-hidden="true"><span></span><span></span><span></span></span>'
            : text;
    }
    overlay.querySelectorAll(".call-box-control[data-action]").forEach(function(button) {
        const action = button.dataset.action;
        if (!["hold", "speaker", "mute"].includes(action)) return;
        const isActive = Boolean(activeCallState[action]);
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });

    setCallStatus(activeCallState.hold ? "On hold" : "Ringing", !activeCallState.hold);

    overlay.addEventListener("pointerdown", function(event) {
        if (event.target === overlay) {
            overlay.remove();
        }
    });

    overlay.querySelector(".call-box-controls").addEventListener("click", function(event) {
        const button = event.target.closest(".call-box-control");
        if (!button) return;

        if (button.dataset.action === "end") {
            activeCallState = null;
            overlay.remove();
            return;
        }

        const isActive = !button.classList.contains("is-active");
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
        activeCallState[button.dataset.action] = isActive;

        if (button.dataset.action === "hold" && status) {
            setCallStatus(activeCallState.hold ? "On hold" : "Ringing", !activeCallState.hold);
        }
    });
}

voiceCallBtn.addEventListener("click", function() {
    showCallBox("audio");
});

videoCallBtn.addEventListener("click", function() {
    showCallBox("video");
});

inboxTab.addEventListener("click", function() {
    switchMessageSection("inbox");
});

requestsTab.addEventListener("click", function() {
    switchMessageSection("requests");
});

messageMenu.addEventListener("click", function(event) {
    const actionButton = event.target.closest("button");

    if (!actionButton) {
        return;
    }

    handleMessageAction(actionButton.dataset.action);
});

reactionMenu.addEventListener("click", function(event) {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.emojiCustom) {
        const customEmoji = prompt("Type any emoji");
        if (customEmoji) applyReaction(customEmoji.trim());
        return;
    }

    applyReaction(button.dataset.emoji);
});

profileMenu.addEventListener("click", function(event) {
    const actionButton = event.target.closest("button");

    if (!actionButton) {
        return;
    }

    event.stopPropagation();
    handleProfileAction(actionButton.dataset.profileAction);
});

document.addEventListener("click", function(event) {
    if (!messageMenu.contains(event.target)) {
        hideMessageMenu();
    }

    if (!reactionMenu.contains(event.target)) {
        hideReactionMenu();
    }

    if (!profileMenu.contains(event.target) && !chatOptionsBtn.contains(event.target)) {
        hideProfileMenu();
    }
});

messages.addEventListener("scroll", hideMessageMenu);
messages.addEventListener("scroll", hideReactionMenu);
messages.addEventListener("scroll", hideProfileMenu);
window.addEventListener("resize", function() {
    hideMessageMenu();
    hideReactionMenu();
    hideProfileMenu();
});

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        hideMessageMenu();
        hideReactionMenu();
        hideProfileMenu();
    }
});

if (window.location.hash === "#requests") {
    activeSection = "requests";
}

function openConversationFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const targetName = (params.get("chat") || "").trim();
    const targetSection = params.get("section") === "requests" ? "requests" : activeSection;
    if (!targetName) return false;

    activeSection = targetSection;
    let source = activeSection === "requests" ? messageRequests : conversations;
    let targetIndex = source.findIndex(function(item) {
        return item && String(item.name || "").toLowerCase() === targetName.toLowerCase();
    });

    if (targetIndex >= 0) {
        selectChat(targetIndex, false);
        return true;
    }

    if (activeSection === "requests") {
        activeSection = "inbox";
        source = conversations;
        targetIndex = source.findIndex(function(item) {
            return item && String(item.name || "").toLowerCase() === targetName.toLowerCase();
        });
        if (targetIndex >= 0) {
            selectChat(targetIndex, false);
            return true;
        }
    }

    createConversationFromName(targetName);
    return true;
}

clearAllMessageUnread();
renderChatList();
if (!openConversationFromUrl()) {
    renderActiveChat();
}
