const tabs = document.querySelectorAll('.tab');
const list = document.getElementById('notificationList');
const refreshNotificationsBtn = document.getElementById('refreshNotifications');
const notificationStatusFilter = document.getElementById('notificationStatusFilter');
const notificationTypeFilter = document.getElementById('notificationTypeFilter');
const notificationSortFilter = document.getElementById('notificationSortFilter');
const notificationListLabel = document.getElementById('notificationListLabel');
const deletedKey = 'vibematch_deleted_notifications';
const seenKey = 'vibematch_seen_notifications_click_v1';
const friendRequestsKey = 'vibematch_friend_requests';
const sentFriendRequestsKey = 'vibematch_sent_friend_requests';
const messageRequestsKey = 'vibematch_message_requests';
const videoFriendsKey = 'vibematch_video_friends';
let currentFilter = 'all';
let refreshPullTimer = null;

const notificationLabels = {
    all: 'All',
    friends: 'Friends',
    messages: 'Messages',
    video: 'Video Chat',
    account: 'Account'
};

function readJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value || fallback;
    } catch (error) {
        return fallback;
    }
}

function timeAgo(value) {
    if (!value) return 'now';
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return 'now';
    const diff = Date.now() - time;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;

    if (diff < minute) return 'now';
    if (diff < hour) return Math.floor(diff / minute) + 'm';
    if (diff < day) return Math.floor(diff / hour) + 'h';
    if (diff < week) return Math.floor(diff / day) + 'd';
    return Math.floor(diff / week) + 'w';
}

function notificationDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function buildNotifications() {
    const friends = readJson('vibematch_video_friends', []);
    const friendRequests = readFriendRequests();
    const sentFriendRequests = readSentFriendRequests();
    const messageRequests = readMessageRequests();
    const history = readJson('vibematch_video_history', []);
    const chats = readJson('vibematch_video_chats', []);
    const profile = readJson('vibematch_profile_data', null);
    const items = [];

    friendRequests.forEach(function(request) {
        items.push({
            id: 'friend-request:' + [request.id, request.name, request.requestedAt].filter(Boolean).join(':'),
            type: 'friends',
            actionType: 'friend_request',
            request: request,
            personName: request.name || 'Someone',
            icon: request.icon || (request.name || 'F').charAt(0).toUpperCase(),
            title: (request.name || 'Someone') + ' sent you a friend request',
            message: request.country || request.status || 'Accept to add this user as a friend.',
            at: request.requestedAt
        });
    });

    const incomingFriendIds = new Set(friendRequests.map(function(request) {
        return request && request.id;
    }).filter(Boolean));

    sentFriendRequests.forEach(function(request) {
        if (!request || incomingFriendIds.has(request.id)) return;
        items.push({
            id: 'sent-friend-request:' + [request.id, request.name, request.requestedAt].filter(Boolean).join(':'),
            type: 'friends',
            personName: request.name || 'Someone',
            icon: request.icon || (request.name || 'F').charAt(0).toUpperCase(),
            title: 'Friend request sent to ' + (request.name || 'Someone'),
            message: request.country || request.status || 'Waiting for response.',
            at: request.requestedAt
        });
    });

    messageRequests.forEach(function(request) {
        items.push({
            id: 'message-request:' + [request.id, request.name, request.updatedAt || request.requestedAt, request.preview].filter(Boolean).join(':'),
            type: 'messages',
            actionType: 'message_request',
            request: request,
            personName: request.name || 'Someone',
            icon: request.icon || (request.name || 'M').charAt(0).toUpperCase(),
            title: (request.name || 'Someone') + ' sent you a message request',
            message: request.preview || 'Open Messages to accept or delete this request.',
            at: request.updatedAt || request.requestedAt
        });
    });

    friends.slice(0, 8).forEach(function(friend) {
        items.push({
            id: 'friends:' + [friend.id, friend.name, friend.addedAt].filter(Boolean).join(':'),
            type: 'friends',
            personName: friend.name || 'Friend',
            icon: friend.icon || 'F',
            title: (friend.name || 'A stranger') + ' added as friend',
            message: friend.country || friend.status || 'Friend from video chat',
            at: friend.addedAt
        });
    });

    const seenChatNames = new Set();
    chats.filter(function(chat) {
        return chat && chat.status !== 'From video chat';
    }).slice(0, 20).forEach(function(chat) {
        if (!chat.preview) return;
        const chatName = (chat.name || 'Someone').toLowerCase();
        if (seenChatNames.has(chatName)) return;
        seenChatNames.add(chatName);

        items.push({
            id: 'messages:' + [chat.name, chat.updatedAt || chat.lastMessageAt, chat.preview].filter(Boolean).join(':'),
            type: 'messages',
            personName: chat.name || 'Someone',
            icon: chat.icon || 'M',
            title: chat.unread ? 'New message from ' + (chat.name || 'Someone') : 'Message with ' + (chat.name || 'Someone'),
            message: chat.preview,
            at: chat.updatedAt || chat.lastMessageAt
        });
    });

    history.slice(0, 12).forEach(function(event) {
        const name = event.name || 'Stranger';
        const eventType = event.event || 'connected';
        const label = eventType.replace(/_/g, ' ');
        items.push({
            id: 'video:' + [eventType, event.name, event.country, event.at].filter(Boolean).join(':'),
            type: 'video',
            personName: name,
            icon: name.charAt(0).toUpperCase(),
            title: label.charAt(0).toUpperCase() + label.slice(1) + ' with ' + name,
            message: event.country || 'Video chat activity',
            at: event.at
        });
    });

    if (profile) {
        items.push({
            id: 'account:' + [profile.name, profile.updatedAt || profile.createdAt, profile.country].filter(Boolean).join(':'),
            type: 'account',
            personName: profile.name || 'User',
            icon: (profile.name || 'V').charAt(0).toUpperCase(),
            title: 'Profile updated',
            message: [profile.gender, profile.country].filter(Boolean).join(' - ') || 'Your VibeMatch profile is ready.',
            at: profile.updatedAt || profile.createdAt || new Date().toISOString()
        });
    }

    const deleted = new Set(readJson(deletedKey, []));

    return items.filter(function(item) {
        return !deleted.has(item.id);
    }).sort(function(a, b) {
        return new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime();
    });
}

function readFriendRequests() {
    const saved = readJson(friendRequestsKey, null);
    if (Array.isArray(saved)) return saved;

    return [];
}

function readMessageRequests() {
    const saved = readJson(messageRequestsKey, null);
    if (Array.isArray(saved)) return saved;

    return [];
}

function readSentFriendRequests() {
    const saved = readJson(sentFriendRequestsKey, null);
    if (Array.isArray(saved)) return saved;

    return [];
}

function writeFriendRequests(requests) {
    localStorage.setItem(friendRequestsKey, JSON.stringify(requests));
}

function acceptFriendRequest(request) {
    if (!request) return;

    const friends = readJson(videoFriendsKey, []);
    if (!friends.some(function(friend) { return friend && friend.id === request.id; })) {
        friends.unshift({
            id: request.id,
            name: request.name,
            country: request.country || 'Global',
            icon: request.icon || (request.name || 'F').charAt(0).toUpperCase(),
            status: 'Friend from request',
            addedAt: new Date().toISOString()
        });
        localStorage.setItem(videoFriendsKey, JSON.stringify(friends));
    }

    const requests = readFriendRequests().filter(function(item) {
        return item.id !== request.id;
    });
    writeFriendRequests(requests);
}

function declineFriendRequest(request) {
    if (!request) return;
    const requests = readFriendRequests().filter(function(item) {
        return item.id !== request.id;
    });
    writeFriendRequests(requests);
}

function hideNotification(id) {
    const deleted = new Set(readJson(deletedKey, []));
    deleted.add(id);
    localStorage.setItem(deletedKey, JSON.stringify(Array.from(deleted)));
}

function markNotificationsSeen(items) {
    const seen = new Set(readJson(seenKey, []));
    items.forEach(function(item) {
        seen.add(item.id);
        if (item.request) {
            seen.add('friend-request:' + [item.request.id, item.request.name, item.request.requestedAt].filter(Boolean).join(':'));
        }
        if (item.type === 'friends' && item.id.indexOf('friends:') === 0) {
            seen.add(item.id);
        }
    });
    readJson(videoFriendsKey, []).forEach(function(friend) {
        seen.add('friends:' + [friend.id, friend.name, friend.addedAt].filter(Boolean).join(':'));
    });
    readFriendRequests().forEach(function(request) {
        seen.add('friend-request:' + [request.id, request.name, request.requestedAt].filter(Boolean).join(':'));
    });
    readSentFriendRequests().forEach(function(request) {
        seen.add('sent-friend-request:' + [request.id, request.name, request.requestedAt].filter(Boolean).join(':'));
    });
    readMessageRequests().forEach(function(request) {
        seen.add('message-request:' + [request.id, request.name, request.updatedAt || request.requestedAt, request.preview].filter(Boolean).join(':'));
    });
    readJson('vibematch_video_chats', []).forEach(function(chat) {
        if (!chat || !chat.preview) return;
        if (chat.status === 'From video chat') return;
        seen.add('messages:' + [chat.name, chat.updatedAt || chat.lastMessageAt, chat.preview].filter(Boolean).join(':'));
    });
    localStorage.setItem(seenKey, JSON.stringify(Array.from(seen)));
}

function markNotificationSeen(item) {
    if (!item || !item.id) return;
    const seen = new Set(readJson(seenKey, []));
    seen.add(item.id);
    if (item.request) {
        seen.add('friend-request:' + [item.request.id, item.request.name, item.request.requestedAt].filter(Boolean).join(':'));
    }
    localStorage.setItem(seenKey, JSON.stringify(Array.from(seen)));
}

function getNotificationOpenTarget(item) {
    if (item.actionType === 'message_request' || item.type === 'messages') return 'message.html';
    if (item.type === 'video') return 'videochat.html';
    if (item.type === 'account') return 'profile.html#profile';
    return 'profile.html#profile';
}

function getNotificationPersonName(item) {
    if (!item) return '';
    if (item.personName) return item.personName;
    if (item.request && item.request.name) return item.request.name;
    const title = item.title || '';
    const match = title.match(/(?:from|with|to)\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

function canOpenNotificationChat(item) {
    if (item && item.actionType === 'message_request') return true;
    if (!window.VibeMatchTokens) return true;
    return window.VibeMatchTokens.requestChatAccess(getNotificationPersonName(item) || 'User');
}

function ensureNotificationConversation(item) {
    const name = getNotificationPersonName(item);
    if (!name) return '';
    if (item.actionType === 'message_request') return name;

    const chats = readJson('vibematch_video_chats', []);
    const nameKey = name.toLowerCase();
    const existingIndex = chats.findIndex(function(chat) {
        return chat && String(chat.name || '').toLowerCase() === nameKey;
    });
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
        chats[existingIndex] = Object.assign({}, chats[existingIndex], {
            status: chats[existingIndex].status === 'From video chat' ? 'Active now' : (chats[existingIndex].status || 'Active now'),
            preview: chats[existingIndex].preview || 'Opened from notification.',
            updatedAt: chats[existingIndex].updatedAt || now,
            lastMessageAt: chats[existingIndex].lastMessageAt || now
        });
    } else {
        chats.unshift({
            name: name,
            icon: (item.icon || name.charAt(0).toUpperCase()),
            status: 'Active now',
            time: 'now',
            preview: 'Opened from notification.',
            unread: 0,
            messages: [
                {
                    type: 'received',
                    text: item.message || 'Notification opened.',
                    time: new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date()),
                    at: now
                }
            ],
            lastMessageAt: now,
            updatedAt: now
        });
    }

    localStorage.setItem('vibematch_video_chats', JSON.stringify(chats));
    return name;
}

function openNotificationMessage(item) {
    if (!canOpenNotificationChat(item)) return;
    const name = ensureNotificationConversation(item);
    const section = item && item.actionType === 'message_request' ? '&section=requests' : '';
    window.location.href = 'message.html?chat=' + encodeURIComponent(name || 'User') + section;
}

function updateNotificationTabState(filter) {
    tabs.forEach(function(tab) {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    if (notificationTypeFilter) notificationTypeFilter.value = filter;
    if (notificationListLabel) notificationListLabel.textContent = notificationLabels[filter] || 'All';
}

function closeNotificationMenus(exceptRow) {
    document.querySelectorAll('.notification-item.menu-open').forEach(function(row) {
        if (row !== exceptRow) row.classList.remove('menu-open');
    });
}

function createNotificationAvatar(item) {
    const wrap = document.createElement('div');
    const avatar = document.createElement('div');
    const dot = document.createElement('span');

    wrap.className = 'notification-avatar-wrap';
    avatar.className = 'avatar avatar-fallback';
    avatar.textContent = item.icon || 'V';
    dot.className = 'notification-online-dot';

    wrap.appendChild(avatar);
    wrap.appendChild(dot);
    return wrap;
}

function createNotificationActions(item, row) {
    const actions = document.createElement('div');
    const more = document.createElement('button');
    const menu = document.createElement('div');
    const deleteButton = document.createElement('button');

    actions.className = 'notification-row-actions';

    if (item.actionType === 'friend_request') {
        const declineButton = document.createElement('button');
        declineButton.className = 'friend-request-decline';
        declineButton.type = 'button';
        declineButton.textContent = 'Decline';
        declineButton.addEventListener('click', function(event) {
            event.stopPropagation();
            markNotificationSeen(item);
            declineFriendRequest(item.request);
            renderNotifications(currentFilter);
        });

        const acceptButton = document.createElement('button');
        acceptButton.className = 'friend-request-accept';
        acceptButton.type = 'button';
        acceptButton.textContent = 'Accept';
        acceptButton.addEventListener('click', function(event) {
            event.stopPropagation();
            markNotificationSeen(item);
            acceptFriendRequest(item.request);
            renderNotifications(currentFilter);
        });

        actions.append(declineButton, acceptButton);
    } else {
        const openButton = document.createElement('button');
        openButton.className = 'notification-open-btn';
        openButton.type = 'button';
        openButton.textContent = item.type === 'messages' ? 'Message' : 'Open';
        openButton.addEventListener('click', function(event) {
            event.stopPropagation();
            markNotificationSeen(item);
            row.classList.remove('unread');
            if (item.type === 'messages') {
                openNotificationMessage(item);
                return;
            }
            window.location.href = getNotificationOpenTarget(item);
        });
        actions.appendChild(openButton);
    }

    const chatButton = document.createElement('button');
    chatButton.className = 'notification-round-btn';
    chatButton.type = 'button';
    chatButton.setAttribute('aria-label', 'Open notification');
    chatButton.innerHTML = '<i class="fas fa-comment-dots"></i>';
    chatButton.addEventListener('click', function(event) {
        event.stopPropagation();
        markNotificationSeen(item);
        row.classList.remove('unread');
        openNotificationMessage(item);
    });

    more.className = 'notification-more-btn';
    more.type = 'button';
    more.setAttribute('aria-label', 'More notification actions');
    more.innerHTML = '<i class="fas fa-ellipsis-vertical"></i>';
    more.addEventListener('click', function(event) {
        event.stopPropagation();
        closeNotificationMenus(row);
        row.classList.toggle('menu-open');
    });

    menu.className = 'notification-row-menu';
    deleteButton.type = 'button';
    deleteButton.innerHTML = '<i class="fas fa-trash-can"></i><span>Delete</span>';
    deleteButton.addEventListener('click', function(event) {
        event.stopPropagation();
        markNotificationSeen(item);
        hideNotification(item.id);
        renderNotifications(currentFilter);
    });
    menu.appendChild(deleteButton);

    actions.appendChild(chatButton);
    actions.appendChild(more);
    actions.appendChild(menu);
    return actions;
}

function renderNotifications(filter) {
    currentFilter = filter || currentFilter || 'all';
    updateNotificationTabState(currentFilter);

    const seen = new Set(readJson(seenKey, []));
    const statusFilter = notificationStatusFilter ? notificationStatusFilter.value : 'all';
    const sortFilter = notificationSortFilter ? notificationSortFilter.value : 'recent';
    let items = buildNotifications().filter(function(item) {
        if (currentFilter !== 'all' && item.type !== currentFilter) return false;
        if (statusFilter === 'unread' && seen.has(item.id)) return false;
        if (statusFilter === 'read' && !seen.has(item.id)) return false;
        return true;
    });

    if (sortFilter === 'oldest') {
        items = items.sort(function(a, b) {
            return new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime();
        });
    }

    list.innerHTML = '';
    if (!items.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><strong>No notifications found</strong><span>Try another filter or check back later.</span></div>';
        return;
    }

    items.forEach(function(item) {
        const isUnread = !seen.has(item.id);
        const row = document.createElement('article');
        const copy = document.createElement('div');
        const title = document.createElement('div');
        const meta = document.createElement('div');
        const message = document.createElement('p');
        const timestamp = document.createElement('time');

        row.className = 'notification-item' + (isUnread ? ' unread' : '');
        row.dataset.type = item.type;

        copy.className = 'notification-copy';
        title.className = 'notification-title';
        title.textContent = item.title;

        meta.className = 'notification-meta';
        meta.innerHTML = '<span>' + (notificationLabels[item.type] || 'Activity') + '</span><i class="fas fa-circle"></i><span>' + notificationDate(item.at) + '</span><i class="fas fa-circle"></i><span>' + timeAgo(item.at) + '</span>';

        message.textContent = item.message;
        timestamp.textContent = timeAgo(item.at);

        row.addEventListener('click', function(event) {
            if (event.target.closest('button')) return;
            closeNotificationMenus();
            markNotificationSeen(item);
            row.classList.remove('unread');
            if (item.type === 'messages') {
                openNotificationMessage(item);
                return;
            }
            window.location.href = getNotificationOpenTarget(item);
        });

        copy.appendChild(title);
        copy.appendChild(meta);
        copy.appendChild(message);
        row.appendChild(createNotificationAvatar(item));
        row.appendChild(copy);
        row.appendChild(timestamp);
        row.appendChild(createNotificationActions(item, row));
        list.appendChild(row);
    });
}

tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
        renderNotifications(tab.dataset.filter);
    });
});

if (notificationTypeFilter) {
    notificationTypeFilter.addEventListener('change', function() {
        renderNotifications(notificationTypeFilter.value || 'all');
    });
}

[notificationStatusFilter, notificationSortFilter].forEach(function(filter) {
    if (!filter) return;
    filter.addEventListener('change', function() {
        renderNotifications(currentFilter);
    });
});

document.addEventListener('click', function(event) {
    if (!event.target.closest('.notification-row-actions')) {
        closeNotificationMenus();
    }
});

function refreshNotifications() {
    const app = document.querySelector('.notifications-app');
    renderNotifications(currentFilter);

    if (!refreshNotificationsBtn) return;
    const refreshIcon = refreshNotificationsBtn.querySelector('i');
    if (refreshPullTimer) clearTimeout(refreshPullTimer);
    refreshNotificationsBtn.setAttribute('aria-label', 'Refreshing notifications');
    refreshNotificationsBtn.removeAttribute('title');
    if (refreshIcon) refreshIcon.className = 'fas fa-rotate';
    refreshNotificationsBtn.classList.add('is-spinning');

    if (app) {
        app.classList.remove('is-refresh-pull');
        void app.offsetWidth;
        app.classList.add('is-refresh-pull');
        refreshPullTimer = setTimeout(function() {
            app.classList.remove('is-refresh-pull');
        }, 760);
    }

    setTimeout(function() {
        refreshNotificationsBtn.classList.remove('is-spinning');
        refreshNotificationsBtn.setAttribute('aria-label', 'Refresh notifications');
        refreshNotificationsBtn.removeAttribute('title');
        if (refreshIcon) refreshIcon.className = 'fas fa-rotate';
    }, 800);
}

if (refreshNotificationsBtn) refreshNotificationsBtn.addEventListener('click', refreshNotifications);

markNotificationsSeen(buildNotifications());
renderNotifications('all');
