const friendKey = 'vibematch_video_friends';
const historyKey = 'vibematch_video_history';
const chatsKey = 'vibematch_video_chats';
const profileKey = 'vibematch_profile_data';
const followersKey = 'vibematch_profile_followers';
const followingKey = 'vibematch_profile_following';
const shareConfigKey = 'vibematch_profile_share_config';
const shareRecordsKey = 'vibematch_profile_share_records';
const sessionKey = 'vibematch_current_user';

const fallbackProfile = {
    name: 'User',
    handle: '@user_name',
    email: 'user@example.com',
    phone: '+91 98765 43210',
    loginMethod: 'Email or phone',
    gender: 'Selected in video setup',
    country: 'India',
    languages: ['Hindi', 'English'],
    interests: ['Music', 'Movies', 'Travel', 'Gaming'],
    following: 248,
    profilePhoto: ''
};

const defaultFollowers = [
    { id: 'follower-daniel', name: 'Daniel', country: 'Friend', icon: 'D' },
    { id: 'follower-olivia', name: 'Olivia', country: 'Friend', icon: 'O' },
    { id: 'follower-sophia', name: 'Sophia', country: 'Friend', icon: 'S' }
];

const defaultFollowing = [
    { id: 'following-daniel', name: 'Daniel', country: 'Following', icon: 'D' },
    { id: 'following-olivia', name: 'Olivia', country: 'Following', icon: 'O' },
    { id: 'following-sophia', name: 'Sophia', country: 'Following', icon: 'S' }
];

let pendingProfilePhoto = '';
let selectedHistoryIds = new Set();
let activePicker = null;
let activePickerValues = [];
let activePickerSource = '';
let pendingProfileSave = null;
let pendingPhoneOtp = '';
let selectedDeleteReason = '';
let refreshPullTimer = null;

const pickerConfig = {
    gender: {
        title: 'Select Gender',
        multiple: false,
        inputId: 'editGender',
        options: ['Male', 'Female', 'Transgender']
    },
    country: {
        title: 'Select Country',
        multiple: false,
        inputId: 'editCountry',
        options: ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'South Korea', 'Brazil', 'Spain', 'Italy', 'United Arab Emirates', 'Singapore', 'Nepal', 'Bangladesh', 'Pakistan', 'Sri Lanka']
    },
    languages: {
        title: 'Select Languages',
        multiple: true,
        inputId: 'editLanguages',
        options: ['Hindi', 'English', 'Urdu', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Punjabi', 'Kannada', 'Malayalam', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Arabic']
    },
    interests: {
        title: 'Select Interests',
        multiple: true,
        inputId: 'editInterests',
        options: ['Music', 'Movies', 'Travel', 'Gaming', 'Anime', 'Fitness', 'Study', 'Dating', 'Sports', 'Food', 'Photography', 'Technology', 'Art', 'Books']
    }
};

function readJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value || fallback;
    } catch (error) {
        return fallback;
    }
}

function clearAuthSession() {
    localStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionKey);
}

function writeText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatDate(value) {
    if (!value) return 'Unknown';
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

function formatDuration(seconds) {
    const total = Number(seconds) || 0;
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return mins + 'm ' + secs + 's';
}

function getProfile() {
    const saved = readJson(profileKey, {});
    const profile = Object.assign({}, fallbackProfile, saved);
    if (profile.name === 'VibeMatch User') profile.name = fallbackProfile.name;
    if (profile.handle === '@vibematch_user') profile.handle = fallbackProfile.handle;
    if (profile.email === 'user@vibematch.com') profile.email = fallbackProfile.email;
    return profile;
}

function getSearchTerm() {
    const input = document.getElementById('profileSearch');
    return input ? input.value.trim().toLowerCase() : '';
}

function renderProfile(profile) {
    const languages = Array.isArray(profile.languages) ? profile.languages : [profile.languages].filter(Boolean);
    const interests = Array.isArray(profile.interests) ? profile.interests : [profile.interests].filter(Boolean);

    writeText('profileName', profile.name);
    writeText('profileHandle', profile.handle);
    writeText('profileEmail', profile.email);
    writeText('profilePhone', profile.phone);
    writeText('loginMethod', profile.loginMethod);
    writeText('profileGender', profile.gender);
    writeText('profileCountry', profile.country);
    writeText('profileLanguages', languages.join(', ') || 'Not selected');
    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
        if (profile.profilePhoto) {
            avatar.style.backgroundImage = 'url("' + profile.profilePhoto + '")';
            avatar.classList.add('has-photo');
            avatar.textContent = '';
        } else {
            avatar.style.backgroundImage = '';
            avatar.classList.remove('has-photo');
            avatar.textContent = profile.name.charAt(0).toUpperCase();
        }
    }

    const chips = document.getElementById('interestChips');
    if (!chips) return;
    chips.textContent = interests.length ? interests.join(', ') : 'Not selected';
}

function renderFriends(friends, chats) {
    const followers = readSocialList('followers', friends, chats);
    const following = readSocialList('following', friends, chats);
    writeText('friendsCount', String(followers.length));
    writeText('followingCount', String(following.length));
}

function getSocialPeople(friends, chats) {
    return (friends.length ? friends : chats.slice(0, 8).map(function(chat) {
        return {
            name: chat.name,
            country: chat.status || 'From video chat',
            icon: chat.icon || chat.name.charAt(0).toUpperCase(),
            addedAt: new Date().toISOString()
        };
    })).filter(function(person) {
        return person && person.name;
    });
}

function getSocialType(type) {
    return type === 'following' ? 'following' : 'followers';
}

function getSocialKey(type) {
    return getSocialType(type) === 'following' ? followingKey : followersKey;
}

function getSocialDefaults(type) {
    return (getSocialType(type) === 'following' ? defaultFollowing : defaultFollowers).map(function(person) {
        return Object.assign({}, person);
    });
}

function createSocialId(type, name, index) {
    return getSocialType(type) + '-' + String(name || 'person')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + index;
}

function normalizeSocialPerson(person, index, type) {
    const name = (person && person.name) || 'Friend';
    return {
        id: (person && person.id) || createSocialId(type, name, index),
        name: name,
        country: (person && (person.country || person.status)) || (getSocialType(type) === 'following' ? 'Following' : 'Follower'),
        icon: (person && person.icon) || name.charAt(0).toUpperCase(),
        addedAt: (person && (person.addedAt || person.requestedAt)) || new Date().toISOString()
    };
}

function uniqueSocialPeople(people, type) {
    const seen = new Set();
    return people.map(function(person, index) {
        return normalizeSocialPerson(person, index, type);
    }).filter(function(person) {
        const key = (person.name || person.id).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return Boolean(person.name);
    });
}

function writeSocialList(type, people) {
    localStorage.setItem(getSocialKey(type), JSON.stringify(uniqueSocialPeople(people, type)));
}

function readSocialList(type, friends, chats) {
    const saved = readJson(getSocialKey(type), null);
    if (Array.isArray(saved)) return uniqueSocialPeople(saved, type);

    const seedPeople = getSocialPeople(friends || [], chats || []);
    const seededList = uniqueSocialPeople(seedPeople.concat(getSocialDefaults(type)), type);
    writeSocialList(type, seededList);
    return seededList;
}

function openSocialPopup(type) {
    const popup = document.getElementById('socialPopup');
    const title = document.getElementById('socialPopupTitle');
    const list = document.getElementById('socialPopupList');
    if (!popup || !title || !list) return;

    const socialType = getSocialType(type);
    const friends = readJson(friendKey, []);
    const chats = readJson(chatsKey, []);
    const people = readSocialList(socialType, friends, chats);
    const actionLabel = socialType === 'following' ? 'Unfollow' : 'Remove';
    const actionIcon = socialType === 'following' ? 'fa-user-minus' : 'fa-user-xmark';
    title.textContent = socialType === 'following' ? 'Following' : 'Followers';
    list.innerHTML = '';

    if (!people.length) {
        list.innerHTML = '<p class="muted">No people to show yet.</p>';
        popup.classList.add('is-open');
        popup.style.display = 'flex';
        return;
    }

    people.forEach(function(person, index) {
        const row = document.createElement('div');
        row.className = 'mini-user';
        const avatar = document.createElement('div');
        const details = document.createElement('div');
        const name = document.createElement('strong');
        const subtitle = document.createElement('p');
        const action = document.createElement('button');

        avatar.className = 'avatar';
        avatar.textContent = person.icon || person.name.charAt(0).toUpperCase();
        details.className = 'mini-user-info';
        name.textContent = person.name;
        subtitle.textContent = person.country || person.status || 'Friend';
        action.className = 'social-action-btn';
        action.type = 'button';
        action.dataset.socialAction = 'remove';
        action.dataset.socialList = socialType;
        action.dataset.socialId = person.id || createSocialId(socialType, person.name, index);
        action.innerHTML = '<i class="fas ' + actionIcon + '"></i><span>' + actionLabel + '</span>';

        details.appendChild(name);
        details.appendChild(subtitle);
        row.appendChild(avatar);
        row.appendChild(details);
        row.appendChild(action);
        list.appendChild(row);
    });
    popup.classList.add('is-open');
    popup.style.display = 'flex';
}

function closeSocialPopup() {
    const popup = document.getElementById('socialPopup');
    if (popup) {
        popup.classList.remove('is-open');
        popup.style.display = 'none';
    }
}

function removeSocialPerson(type, id) {
    const socialType = getSocialType(type);
    const friends = readJson(friendKey, []);
    const chats = readJson(chatsKey, []);
    const people = readSocialList(socialType, friends, chats);
    const nextPeople = people.filter(function(person) {
        return person.id !== id;
    });

    writeSocialList(socialType, nextPeople);
    renderProfileDashboard();
    openSocialPopup(socialType);
}

function renderHistory(history) {
    const body = document.getElementById('historyTable');
    if (!body) return;
    const term = getSearchTerm();
    const filtered = history.map(function(item, index) {
        if (!item.id) {
            item.id = 'history-' + (item.at || 'unknown') + '-' + index;
        }
        return item;
    }).filter(function(item) {
        return JSON.stringify(item).toLowerCase().includes(term);
    });

    body.innerHTML = '';
    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="8">No chat history found for this search.</td></tr>';
        updateHistoryDeleteState();
        return;
    }

    filtered.slice(0, 40).forEach(function(item) {
        const interests = Array.isArray(item.interests) ? item.interests.join(', ') : '';
        const row = document.createElement('tr');
        const checked = selectedHistoryIds.has(item.id) ? ' checked' : '';
        row.innerHTML =
            '<td><input class="history-check" type="checkbox" data-history-id="' + item.id + '"' + checked + '></td>' +
            '<td><strong>' + (item.name || 'Stranger') + '</strong></td>' +
            '<td>' + (item.country || 'Global') + '</td>' +
            '<td><span class="event-pill">' + (item.event || 'connected').replace(/_/g, ' ') + '</span></td>' +
            '<td>' + (interests || 'Not selected') + '</td>' +
            '<td>' + formatDate(item.at) + '</td>' +
            '<td>' + formatDuration(item.durationSeconds) + '</td>' +
            '<td><button class="history-delete-btn" type="button" data-history-id="' + item.id + '"><i class="fas fa-trash-can"></i> Delete</button></td>';
        body.appendChild(row);
    });
    updateHistoryDeleteState();
}

function renderProfileDashboard() {
    const profile = getProfile();
    const friends = readJson(friendKey, []);
    const history = readJson(historyKey, []);
    const chats = readJson(chatsKey, []);

    renderProfile(profile);
    renderFriends(friends, chats);
    renderHistory(history);
    renderShareProfile();
}

function getCurrentSection() {
    const activeLink = document.querySelector('.profile-nav a.active[data-section]');
    return activeLink ? activeLink.dataset.section : 'profile';
}

function refreshProfileDashboard() {
    const refreshButton = document.getElementById('refreshProfile');
    const profileMain = document.querySelector('.profile-main');
    const section = getCurrentSection();
    selectedHistoryIds = new Set();
    renderProfileDashboard();
    showProfileSection(section);

    if (!refreshButton) return;
    const refreshIcon = refreshButton.querySelector('i');
    if (refreshPullTimer) clearTimeout(refreshPullTimer);
    refreshButton.setAttribute('aria-label', 'Refreshing profile');
    refreshButton.removeAttribute('title');
    if (refreshIcon) refreshIcon.className = 'fas fa-rotate';
    refreshButton.classList.add('is-spinning');

    if (profileMain) {
        profileMain.classList.remove('is-refresh-pull');
        void profileMain.offsetWidth;
        profileMain.classList.add('is-refresh-pull');
        refreshPullTimer = setTimeout(function() {
            profileMain.classList.remove('is-refresh-pull');
        }, 760);
    }

    setTimeout(function() {
        refreshButton.classList.remove('is-spinning');
        refreshButton.setAttribute('aria-label', 'Refresh profile');
        refreshButton.removeAttribute('title');
        if (refreshIcon) refreshIcon.className = 'fas fa-rotate';
    }, 800);
}

function showProfileSection(sectionName) {
    const section = sectionName || 'profile';
    document.querySelectorAll('.profile-nav a[data-section]').forEach(function(link) {
        link.classList.toggle('active', link.dataset.section === section);
    });
    document.querySelectorAll('.view-panel').forEach(function(panel) {
        panel.classList.toggle('is-hidden', panel.dataset.section !== section);
    });
    if (section === 'edit') {
        loadEditProfileForm();
    }
    if (section === 'share') {
        renderShareProfile();
    }
}

function splitList(value) {
    return value.split(',')
        .map(function(item) { return item.trim(); })
        .filter(Boolean);
}

function createHandleFromName(name) {
    const cleanName = (name || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return '@' + (cleanName || 'user_name');
}

function normalizeShareHandle(profile) {
    const raw = (profile.handle || profile.name || 'user').toLowerCase().replace(/^@/, '');
    return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
}

function generateShareToken(profile) {
    const base = normalizeShareHandle(profile);
    const random = Math.random().toString(36).slice(2, 8);
    return 'vm-' + base + '-' + random;
}

function getShareConfig(profile) {
    let config = readJson(shareConfigKey, null);
    if (!config || !config.token) {
        config = {
            token: generateShareToken(profile),
            visibility: 'public',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(shareConfigKey, JSON.stringify(config));
    }
    return config;
}

function saveShareConfig(config) {
    localStorage.setItem(shareConfigKey, JSON.stringify(Object.assign({}, config, {
        updatedAt: new Date().toISOString()
    })));
}

function getProfileSnapshot(profile, config) {
    const languages = Array.isArray(profile.languages) ? profile.languages : [profile.languages].filter(Boolean);
    const interests = Array.isArray(profile.interests) ? profile.interests : [profile.interests].filter(Boolean);
    return {
        token: config.token,
        visibility: config.visibility || 'public',
        name: profile.name || 'User',
        handle: profile.handle || createHandleFromName(profile.name),
        gender: profile.gender || 'Not selected',
        country: profile.country || 'Global',
        languages: languages,
        interests: interests,
        profilePhoto: profile.profilePhoto || '',
        followers: readSocialList('followers', readJson(friendKey, []), readJson(chatsKey, [])).length,
        following: readSocialList('following', readJson(friendKey, []), readJson(chatsKey, [])).length,
        updatedAt: new Date().toISOString()
    };
}

function encodeSharePayload(data) {
    const json = JSON.stringify(data || {});
    const bytes = getUtf8Bytes(json);
    let binary = '';
    bytes.forEach(function(byte) {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeSharePayload(value) {
    if (!value) return null;
    try {
        let base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const binary = atob(base64);
        const bytes = binary.split('').map(function(char) {
            return char.charCodeAt(0);
        });
        const json = window.TextDecoder
            ? new TextDecoder().decode(new Uint8Array(bytes))
            : decodeURIComponent(escape(binary));
        const payload = JSON.parse(json);
        return {
            token: payload.t || '',
            visibility: payload.v || 'public',
            name: payload.n || 'User',
            handle: payload.h || '@user',
            gender: payload.g || 'Not selected',
            country: payload.c || 'Global',
            languages: Array.isArray(payload.l) ? payload.l : [],
            interests: Array.isArray(payload.i) ? payload.i : [],
            profilePhoto: '',
            followers: payload.f || 0,
            following: payload.w || 0,
            updatedAt: payload.u || new Date().toISOString()
        };
    } catch (error) {
        return null;
    }
}

function compactSharePayload(snapshot) {
    return {
        t: snapshot.token,
        v: snapshot.visibility,
        n: snapshot.name,
        h: snapshot.handle,
        g: snapshot.gender,
        c: snapshot.country,
        l: snapshot.languages,
        i: snapshot.interests,
        f: snapshot.followers,
        w: snapshot.following,
        u: snapshot.updatedAt
    };
}

function syncShareRecord(profile, config) {
    const records = readJson(shareRecordsKey, {});
    records[config.token] = getProfileSnapshot(profile, config);
    localStorage.setItem(shareRecordsKey, JSON.stringify(records));
}

function buildPageUrl(fileName) {
    const url = new URL(fileName, window.location.href);
    url.hash = '';
    return url;
}

function getShareLinks(config, profile) {
    const snapshot = profile ? getProfileSnapshot(profile, config) : null;
    const publicPayload = snapshot ? encodeSharePayload(compactSharePayload(snapshot)) : '';
    const invitePayload = snapshot ? encodeSharePayload({
        n: snapshot.name,
        h: snapshot.handle
    }) : '';
    const publicUrl = buildPageUrl('profile.html');
    publicUrl.search = '?share=' + encodeURIComponent(config.token) + (publicPayload ? '&p=' + encodeURIComponent(publicPayload) : '');
    const inviteUrl = buildPageUrl('index.html');
    inviteUrl.search = '?invite=' + encodeURIComponent(config.token) + (invitePayload ? '&by=' + encodeURIComponent(invitePayload) : '');
    return {
        publicProfile: publicUrl.href,
        invite: inviteUrl.href
    };
}

function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value || '';
}

function setShareFeedback(message, isError) {
    const feedback = document.getElementById('shareFeedback');
    if (!feedback) return;
    feedback.textContent = message || '';
    feedback.classList.toggle('error', Boolean(isError));
}

function fallbackCopyText(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
        document.execCommand('copy');
        return Promise.resolve();
    } catch (error) {
        return Promise.reject(error);
    } finally {
        document.body.removeChild(area);
    }
}

function copyTextToClipboard(text, label) {
    const value = text || '';
    const copier = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(value)
        : fallbackCopyText(value);

    return copier.then(function() {
        setShareFeedback((label || 'Link') + ' copied.');
    }).catch(function() {
        setShareFeedback('Copy blocked by browser. Select the text and copy manually.', true);
    });
}

function shareNative(title, text, url, fallbackLabel) {
    if (navigator.share) {
        navigator.share({ title: title, text: text, url: url }).then(function() {
            setShareFeedback('Share sheet opened.');
        }).catch(function(error) {
            if (error && error.name === 'AbortError') return;
            copyTextToClipboard(url, fallbackLabel || 'Link');
        });
        return;
    }
    copyTextToClipboard(url, fallbackLabel || 'Link');
}

function getUtf8Bytes(text) {
    if (window.TextEncoder) return Array.from(new TextEncoder().encode(text));
    const encoded = unescape(encodeURIComponent(text));
    return encoded.split('').map(function(char) {
        return char.charCodeAt(0);
    });
}

function createQrCodeMatrix(text) {
    const version = 8;
    const size = 17 + version * 4;
    const dataCodewords = 194;
    const ecCodewords = 24;
    const dataBlockLengths = [97, 97];
    const matrix = Array.from({ length: size }, function() { return Array(size).fill(false); });
    const reserved = Array.from({ length: size }, function() { return Array(size).fill(false); });

    function setFunction(x, y, dark) {
        if (x < 0 || y < 0 || x >= size || y >= size) return;
        matrix[y][x] = Boolean(dark);
        reserved[y][x] = true;
    }

    function getBit(value, index) {
        return ((value >>> index) & 1) !== 0;
    }

    function addFinder(x, y) {
        for (let dy = -1; dy <= 7; dy += 1) {
            for (let dx = -1; dx <= 7; dx += 1) {
                const xx = x + dx;
                const yy = y + dy;
                const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
                const border = dx === 0 || dx === 6 || dy === 0 || dy === 6;
                const center = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
                setFunction(xx, yy, inFinder && (border || center));
            }
        }
    }

    function addAlignment(cx, cy) {
        for (let dy = -2; dy <= 2; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
                setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
        }
    }

    function calculateBch(value, generator, shift) {
        let bits = value << shift;
        for (let i = Math.floor(Math.log2(bits)); i >= shift; i -= 1) {
            if (((bits >>> i) & 1) !== 0) {
                bits ^= generator << (i - shift);
            }
        }
        return bits;
    }

    function drawFormatBits(mask) {
        const data = (1 << 3) | mask;
        const format = ((data << 10) | calculateBch(data, 0x537, 10)) ^ 0x5412;
        for (let i = 0; i <= 5; i += 1) setFunction(8, i, getBit(format, i));
        setFunction(8, 7, getBit(format, 6));
        setFunction(8, 8, getBit(format, 7));
        setFunction(7, 8, getBit(format, 8));
        for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, getBit(format, i));
        for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, getBit(format, i));
        for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, getBit(format, i));
        setFunction(8, size - 8, true);
    }

    function drawVersionInfo() {
        const versionBits = (version << 12) | calculateBch(version, 0x1F25, 12);
        for (let i = 0; i < 18; i += 1) {
            const bit = getBit(versionBits, i);
            const a = size - 11 + (i % 3);
            const b = Math.floor(i / 3);
            setFunction(a, b, bit);
            setFunction(b, a, bit);
        }
    }

    addFinder(0, 0);
    addFinder(size - 7, 0);
    addFinder(0, size - 7);
    for (let i = 8; i < size - 8; i += 1) {
        setFunction(i, 6, i % 2 === 0);
        setFunction(6, i, i % 2 === 0);
    }
    [6, 24, 42].forEach(function(y) {
        [6, 24, 42].forEach(function(x) {
            const overlapsFinder = (x === 6 && y === 6) || (x === 42 && y === 6) || (x === 6 && y === 42);
            if (!overlapsFinder) addAlignment(x, y);
        });
    });
    drawFormatBits(0);
    drawVersionInfo();

    const bytes = getUtf8Bytes(text);
    if (bytes.length > dataCodewords - 2) throw new Error('QR payload is too long');
    const dataBits = [];
    function appendBits(value, length) {
        for (let i = length - 1; i >= 0; i -= 1) {
            dataBits.push((value >>> i) & 1);
        }
    }
    appendBits(0x4, 4);
    appendBits(bytes.length, 8);
    bytes.forEach(function(byte) {
        appendBits(byte, 8);
    });
    const maxBits = dataCodewords * 8;
    appendBits(0, Math.min(4, maxBits - dataBits.length));
    while (dataBits.length % 8 !== 0) dataBits.push(0);
    const dataCodewordValues = [];
    for (let i = 0; i < dataBits.length; i += 8) {
        let value = 0;
        for (let j = 0; j < 8; j += 1) value = (value << 1) | dataBits[i + j];
        dataCodewordValues.push(value);
    }
    let pad = 0xec;
    while (dataCodewordValues.length < dataCodewords) {
        dataCodewordValues.push(pad);
        pad = pad === 0xec ? 0x11 : 0xec;
    }

    const gfExp = Array(512).fill(0);
    const gfLog = Array(256).fill(0);
    let value = 1;
    for (let i = 0; i < 255; i += 1) {
        gfExp[i] = value;
        gfLog[value] = i;
        value <<= 1;
        if (value & 0x100) value ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) gfExp[i] = gfExp[i - 255];

    function gfMul(a, b) {
        if (!a || !b) return 0;
        return gfExp[gfLog[a] + gfLog[b]];
    }

    function polyMultiply(a, b) {
        const result = Array(a.length + b.length - 1).fill(0);
        a.forEach(function(aCoef, i) {
            b.forEach(function(bCoef, j) {
                result[i + j] ^= gfMul(aCoef, bCoef);
            });
        });
        return result;
    }

    function rsGenerator(degree) {
        let poly = [1];
        for (let i = 0; i < degree; i += 1) {
            poly = polyMultiply(poly, [1, gfExp[i]]);
        }
        return poly;
    }

    function rsRemainder(data, degree) {
        const generator = rsGenerator(degree);
        const message = data.concat(Array(degree).fill(0));
        for (let i = 0; i < data.length; i += 1) {
            const factor = message[i];
            if (!factor) continue;
            for (let j = 0; j < generator.length; j += 1) {
                message[i + j] ^= gfMul(generator[j], factor);
            }
        }
        return message.slice(message.length - degree);
    }

    const dataBlocks = [];
    let offset = 0;
    dataBlockLengths.forEach(function(length) {
        dataBlocks.push(dataCodewordValues.slice(offset, offset + length));
        offset += length;
    });
    const ecBlocks = dataBlocks.map(function(block) {
        return rsRemainder(block, ecCodewords);
    });
    const allCodewords = [];
    for (let i = 0; i < Math.max.apply(Math, dataBlockLengths); i += 1) {
        dataBlocks.forEach(function(block) {
            if (i < block.length) allCodewords.push(block[i]);
        });
    }
    for (let i = 0; i < ecCodewords; i += 1) {
        ecBlocks.forEach(function(block) {
            allCodewords.push(block[i]);
        });
    }

    const finalBits = [];
    allCodewords.forEach(function(codeword) {
        for (let i = 7; i >= 0; i -= 1) finalBits.push((codeword >>> i) & 1);
    });

    let bitIndex = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right -= 1;
        for (let vertical = 0; vertical < size; vertical += 1) {
            const y = upward ? size - 1 - vertical : vertical;
            for (let j = 0; j < 2; j += 1) {
                const x = right - j;
                if (reserved[y][x]) continue;
                matrix[y][x] = bitIndex < finalBits.length ? finalBits[bitIndex] === 1 : false;
                bitIndex += 1;
            }
        }
        upward = !upward;
    }

    function maskBit(mask, x, y) {
        if (mask === 0) return (x + y) % 2 === 0;
        if (mask === 1) return y % 2 === 0;
        if (mask === 2) return x % 3 === 0;
        if (mask === 3) return (x + y) % 3 === 0;
        if (mask === 4) return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
        if (mask === 5) return ((x * y) % 2 + (x * y) % 3) === 0;
        if (mask === 6) return (((x * y) % 2 + (x * y) % 3) % 2) === 0;
        return (((x + y) % 2 + (x * y) % 3) % 2) === 0;
    }

    function penalty(modules) {
        let score = 0;
        function scoreLine(values) {
            let runColor = values[0];
            let runLength = 1;
            for (let i = 1; i < values.length; i += 1) {
                if (values[i] === runColor) {
                    runLength += 1;
                } else {
                    if (runLength >= 5) score += 3 + (runLength - 5);
                    runColor = values[i];
                    runLength = 1;
                }
            }
            if (runLength >= 5) score += 3 + (runLength - 5);
        }
        for (let y = 0; y < size; y += 1) scoreLine(modules[y]);
        for (let x = 0; x < size; x += 1) scoreLine(modules.map(function(row) { return row[x]; }));
        for (let y = 0; y < size - 1; y += 1) {
            for (let x = 0; x < size - 1; x += 1) {
                const color = modules[y][x];
                if (modules[y][x + 1] === color && modules[y + 1][x] === color && modules[y + 1][x + 1] === color) score += 3;
            }
        }
        const pattern = [true, false, true, true, true, false, true, false, false, false, false];
        function hasPattern(values, index) {
            for (let i = 0; i < pattern.length; i += 1) {
                if (values[index + i] !== pattern[i]) return false;
            }
            return true;
        }
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x <= size - 11; x += 1) if (hasPattern(modules[y], x)) score += 40;
        }
        for (let x = 0; x < size; x += 1) {
            const column = modules.map(function(row) { return row[x]; });
            for (let y = 0; y <= size - 11; y += 1) if (hasPattern(column, y)) score += 40;
        }
        const dark = modules.reduce(function(total, row) {
            return total + row.filter(Boolean).length;
        }, 0);
        score += Math.floor(Math.abs((dark * 20 / (size * size)) - 10)) * 10;
        return score;
    }

    let bestMatrix = null;
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask += 1) {
        matrix.forEach(function(row, y) {
            row.forEach(function(module, x) {
                if (!reserved[y][x] && maskBit(mask, x, y)) matrix[y][x] = !module;
            });
        });
        drawFormatBits(mask);
        const currentPenalty = penalty(matrix);
        if (currentPenalty < bestPenalty) {
            bestPenalty = currentPenalty;
            bestMatrix = matrix.map(function(row) { return row.slice(); });
        }
        matrix.forEach(function(row, y) {
            row.forEach(function(module, x) {
                if (!reserved[y][x] && maskBit(mask, x, y)) matrix[y][x] = !module;
            });
        });
    }
    return bestMatrix;
}

function drawShareQr(text) {
    const canvas = document.getElementById('shareQrCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const modules = createQrCodeMatrix(text);
    const quietZone = 4;
    const cells = modules.length + quietZone * 2;
    const scale = Math.floor(canvas.width / cells);
    const qrSize = scale * cells;
    const offset = Math.floor((canvas.width - qrSize) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050505';
    modules.forEach(function(row, y) {
        row.forEach(function(isDark, x) {
            if (!isDark) return;
            ctx.fillRect(offset + (x + quietZone) * scale, offset + (y + quietZone) * scale, scale, scale);
        });
    });
}

function renderShareProfile() {
    const sharePanel = document.getElementById('shareProfile');
    if (!sharePanel) return;
    const profile = getProfile();
    const config = getShareConfig(profile);
    const isPublic = (config.visibility || 'public') === 'public';
    const links = getShareLinks(config, profile);
    const inviteText = 'Join me on VibeMatch. Open my invite link and start meeting new people: ' + links.invite;

    syncShareRecord(profile, config);
    writeText('shareProfileName', profile.name || 'User');
    writeText('shareProfileHandle', profile.handle || createHandleFromName(profile.name));
    writeText('shareTokenLabel', config.token);
    setInputValue('publicProfileLink', isPublic ? links.publicProfile : 'Turn on public sharing to activate your profile link');
    setInputValue('inviteProfileLink', links.invite);
    setInputValue('inviteShareText', inviteText);

    const badge = document.getElementById('shareVisibilityBadge');
    if (badge) {
        badge.textContent = isPublic ? 'Public link active' : 'Public profile off';
        badge.classList.toggle('is-private', !isPublic);
    }
    const toggle = document.getElementById('shareVisibilityToggle');
    if (toggle) toggle.checked = isPublic;
    const publicPreview = document.getElementById('openPublicProfile');
    if (publicPreview) {
        publicPreview.href = links.publicProfile;
        publicPreview.classList.toggle('is-disabled', !isPublic);
    }
    document.querySelectorAll('.share-public-action').forEach(function(button) {
        button.disabled = !isPublic;
    });
    setPreviewPhoto(document.getElementById('shareProfileAvatar'), profile);
    try {
        drawShareQr(links.invite);
    } catch (error) {
        setShareFeedback('QR link is too long. Regenerate the link and try again.', true);
    }
}

function regenerateShareLink() {
    const profile = getProfile();
    const oldConfig = getShareConfig(profile);
    const records = readJson(shareRecordsKey, {});
    delete records[oldConfig.token];
    localStorage.setItem(shareRecordsKey, JSON.stringify(records));
    const nextConfig = Object.assign({}, oldConfig, {
        token: generateShareToken(profile),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    saveShareConfig(nextConfig);
    renderShareProfile();
    setShareFeedback('New profile and invite links generated.');
}

function updateShareVisibility(isPublic) {
    const profile = getProfile();
    const config = Object.assign({}, getShareConfig(profile), {
        visibility: isPublic ? 'public' : 'private'
    });
    saveShareConfig(config);
    syncShareRecord(profile, config);
    renderShareProfile();
    setShareFeedback(isPublic ? 'Public sharing is on.' : 'Public profile link is off. Invite link still works.');
}

function renderSharedProfileUnavailable() {
    document.body.classList.add('shared-profile-view');
    const title = document.querySelector('.profile-header h1');
    if (title) title.textContent = 'Profile unavailable';
    const profilePanel = document.getElementById('profile');
    if (profilePanel) {
        profilePanel.innerHTML = '<div class="panel-head"><div><p class="eyebrow">Shared Profile</p><h2>This profile link is private or expired.</h2></div></div><div class="public-profile-actions"><a href="index.html"><i class="fas fa-house"></i><span>Go to VibeMatch</span></a></div>';
    }
    showProfileSection('profile');
}

function renderSharedProfilePage(token) {
    const records = readJson(shareRecordsKey, {});
    const params = new URLSearchParams(window.location.search);
    const payloadSnapshot = decodeSharePayload(params.get('p'));
    const snapshot = records[token] || payloadSnapshot;
    if (!snapshot || snapshot.visibility !== 'public') {
        renderSharedProfileUnavailable();
        return;
    }

    document.body.classList.add('shared-profile-view');
    const title = document.querySelector('.profile-header h1');
    if (title) title.textContent = 'Shared VibeMatch Profile';
    renderProfile(Object.assign({}, fallbackProfile, snapshot, {
        loginMethod: 'Public profile'
    }));
    writeText('friendsCount', String(snapshot.followers || 0));
    writeText('followingCount', String(snapshot.following || 0));
    const status = document.querySelector('.status-pill');
    if (status) status.textContent = 'Public';
    const publicActions = document.getElementById('publicProfileActions');
    const messageLink = document.getElementById('publicMessageUser');
    if (publicActions) publicActions.hidden = false;
    if (messageLink) messageLink.href = 'message.html?chat=' + encodeURIComponent(snapshot.name || 'User');
    showProfileSection('profile');
}

function setPreviewPhoto(element, profile) {
    if (!element) return;
    if (profile.profilePhoto) {
        element.style.backgroundImage = 'url("' + profile.profilePhoto + '")';
        element.classList.add('has-photo');
        element.textContent = '';
    } else {
        element.style.backgroundImage = '';
        element.classList.remove('has-photo');
        element.textContent = (profile.name || 'User').charAt(0).toUpperCase();
    }
}

function loadEditProfileForm() {
    const profile = getProfile();
    if (!document.getElementById('editProfileForm')) return;

    pendingProfilePhoto = profile.profilePhoto || '';
    document.getElementById('editName').value = profile.name || '';
    document.getElementById('editEmail').value = profile.email || '';
    document.getElementById('editPhone').value = profile.phone || '';
    document.getElementById('editGender').value = profile.gender || '';
    document.getElementById('editCountry').value = profile.country || '';
    document.getElementById('editLanguages').value = (Array.isArray(profile.languages) ? profile.languages : []).join(', ');
    document.getElementById('editInterests').value = (Array.isArray(profile.interests) ? profile.interests : []).join(', ');
    writeText('profileSaveMessage', '');
    const doneButton = document.querySelector('.done-profile-btn');
    if (doneButton) doneButton.classList.remove('saved');
    setPreviewPhoto(document.getElementById('editPhotoPreview'), profile);
}

function commitEditedProfile(updatedProfile) {
    const saveMessage = document.getElementById('profileSaveMessage');
    const doneButton = document.querySelector('.done-profile-btn');

    localStorage.setItem(profileKey, JSON.stringify(updatedProfile));
    renderProfileDashboard();
    if (saveMessage) {
        saveMessage.classList.remove('error');
        saveMessage.textContent = 'Your profile is set and ready.';
    }
    if (doneButton) doneButton.classList.add('saved');
}

function openPhoneOtpPopup(updatedProfile) {
    const popup = document.getElementById('phoneOtpPopup');
    const input = document.getElementById('phoneOtpInput');
    const message = document.getElementById('phoneOtpMessage');
    const copy = document.getElementById('phoneOtpCopy');
    if (!popup || !input || !message) return;

    pendingProfileSave = updatedProfile;
    pendingPhoneOtp = String(Math.floor(100000 + Math.random() * 900000));
    input.value = '';
    input.classList.remove('input-error');
    message.classList.remove('error');
    message.textContent = '';
    if (copy) {
        copy.textContent = 'Enter the OTP sent to ' + updatedProfile.phone + '. Demo OTP: ' + pendingPhoneOtp;
    }
    popup.style.display = 'flex';
    setTimeout(function() {
        input.focus();
    }, 50);
}

function closePhoneOtpPopup() {
    const popup = document.getElementById('phoneOtpPopup');
    const input = document.getElementById('phoneOtpInput');
    const message = document.getElementById('phoneOtpMessage');
    if (popup) popup.style.display = 'none';
    if (input) {
        input.value = '';
        input.classList.remove('input-error');
    }
    if (message) {
        message.textContent = '';
        message.classList.remove('error');
    }
    pendingProfileSave = null;
    pendingPhoneOtp = '';
}

function verifyPhoneOtp() {
    const input = document.getElementById('phoneOtpInput');
    const message = document.getElementById('phoneOtpMessage');
    const value = input ? input.value.trim() : '';
    if (!pendingProfileSave || !input || !message) return;

    if (value !== pendingPhoneOtp) {
        input.classList.add('input-error');
        message.classList.add('error');
        message.textContent = 'Incorrect OTP. Please enter the 6 digit code to change your phone number.';
        return;
    }

    input.classList.remove('input-error');
    message.classList.remove('error');
    message.textContent = 'Phone number verified.';
    const verifiedProfile = Object.assign({}, pendingProfileSave, {
        phoneVerifiedAt: new Date().toISOString()
    });
    pendingProfileSave = null;
    pendingPhoneOtp = '';
    const popup = document.getElementById('phoneOtpPopup');
    if (popup) popup.style.display = 'none';
    commitEditedProfile(verifiedProfile);
}

function openDeleteAccountPopup() {
    const popup = document.getElementById('deleteAccountPopup');
    const message = document.getElementById('deleteAccountMessage');
    const feedback = document.getElementById('deleteFeedback');
    const confirmButton = document.getElementById('confirmDeleteAccount');
    selectedDeleteReason = '';
    document.querySelectorAll('.delete-reason-card').forEach(function(card) {
        card.classList.remove('active');
    });
    if (message) message.textContent = 'Select a reason to continue.';
    if (feedback) feedback.value = '';
    if (confirmButton) confirmButton.disabled = true;
    if (popup) popup.style.display = 'flex';
}

function closeDeleteAccountPopup() {
    const popup = document.getElementById('deleteAccountPopup');
    if (popup) popup.style.display = 'none';
}

function selectDeleteReason(card) {
    selectedDeleteReason = card.dataset.reason || '';
    document.querySelectorAll('.delete-reason-card').forEach(function(item) {
        item.classList.toggle('active', item === card);
    });
    const confirmButton = document.getElementById('confirmDeleteAccount');
    const message = document.getElementById('deleteAccountMessage');
    if (confirmButton) confirmButton.disabled = !selectedDeleteReason;
    if (message) message.textContent = selectedDeleteReason ? 'Reason selected. You can delete your account now.' : 'Select a reason to continue.';
}

function confirmDeleteAccountWithReason() {
    const message = document.getElementById('deleteAccountMessage');
    const feedback = document.getElementById('deleteFeedback');
    if (!selectedDeleteReason) {
        if (message) message.textContent = 'Please choose a reason before deleting your account.';
        return;
    }

    localStorage.setItem('vibematch_delete_account_reason', JSON.stringify({
        reason: selectedDeleteReason,
        feedback: feedback ? feedback.value.trim() : '',
        at: new Date().toISOString()
    }));

    [profileKey, friendKey, historyKey, chatsKey, followersKey, followingKey, shareConfigKey, shareRecordsKey].forEach(function(key) {
        localStorage.removeItem(key);
    });
    clearAuthSession();
    window.location.href = 'index.html';
}

function saveEditedProfile(event) {
    event.preventDefault();
    const requiredFields = [
        { id: 'editName', label: 'name' },
        { id: 'editEmail', label: 'email' },
        { id: 'editPhone', label: 'phone number' },
        { id: 'editGender', label: 'gender' },
        { id: 'editCountry', label: 'country' },
        { id: 'editLanguages', label: 'language' },
        { id: 'editInterests', label: 'interest' }
    ];
    const missingFields = requiredFields.filter(function(field) {
        const input = document.getElementById(field.id);
        const isMissing = !input || !input.value.trim();
        if (input) input.classList.toggle('input-error', isMissing);
        return isMissing;
    });
    const saveMessage = document.getElementById('profileSaveMessage');
    const doneButton = document.querySelector('.done-profile-btn');

    if (missingFields.length) {
        if (doneButton) doneButton.classList.remove('saved');
        if (saveMessage) {
            saveMessage.classList.add('error');
            saveMessage.textContent = 'Please fill your ' + missingFields.map(function(field) {
                return field.label;
            }).join(', ') + ' before saving.';
        }
        const firstMissing = document.getElementById(missingFields[0].id);
        if (firstMissing) firstMissing.focus();
        return;
    }

    if (saveMessage) saveMessage.classList.remove('error');
    if (doneButton) doneButton.classList.remove('saved');
    const profile = getProfile();
    const profileName = document.getElementById('editName').value.trim() || 'User';
    const nextPhone = document.getElementById('editPhone').value.trim();
    const updatedProfile = Object.assign({}, profile, {
        name: profileName,
        handle: createHandleFromName(profileName),
        email: document.getElementById('editEmail').value.trim(),
        phone: nextPhone,
        gender: document.getElementById('editGender').value.trim(),
        country: document.getElementById('editCountry').value.trim(),
        languages: splitList(document.getElementById('editLanguages').value),
        interests: splitList(document.getElementById('editInterests').value),
        profilePhoto: pendingProfilePhoto,
        updatedAt: new Date().toISOString()
    });

    if (nextPhone !== (profile.phone || '').trim()) {
        openPhoneOtpPopup(updatedProfile);
        return;
    }

    commitEditedProfile(updatedProfile);
}

function getSavedHistoryWithIds() {
    const history = readJson(historyKey, []);
    let changed = false;
    history.forEach(function(item, index) {
        if (!item.id) {
            item.id = 'history-' + (item.at || 'unknown') + '-' + index;
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem(historyKey, JSON.stringify(history));
    }
    return history;
}

function updateHistoryDeleteState() {
    const deleteSelected = document.getElementById('deleteSelectedHistory');
    const selectAll = document.getElementById('selectAllHistory');
    const visibleChecks = Array.from(document.querySelectorAll('.history-check'));
    if (deleteSelected) {
        deleteSelected.disabled = selectedHistoryIds.size === 0;
    }
    if (selectAll) {
        const allVisibleSelected = visibleChecks.length > 0 && visibleChecks.every(function(check) {
            return selectedHistoryIds.has(check.dataset.historyId);
        });
        selectAll.innerHTML = allVisibleSelected
            ? '<i class="fas fa-xmark"></i> Clear All'
            : '<i class="fas fa-check-double"></i> Select All';
    }
}

function deleteHistoryByIds(ids) {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const nextHistory = getSavedHistoryWithIds().filter(function(item) {
        return !idSet.has(item.id);
    });
    ids.forEach(function(id) {
        selectedHistoryIds.delete(id);
    });
    localStorage.setItem(historyKey, JSON.stringify(nextHistory));
    renderProfileDashboard();
}

function openChoicePopup(type, source) {
    const config = pickerConfig[type];
    const popup = document.getElementById('choicePopup');
    const optionsWrap = document.getElementById('choicePopupOptions');
    const popupDone = document.getElementById('choicePopupDone');
    if (!config || !popup || !optionsWrap) return;

    const input = document.getElementById(config.inputId);
    const profileInterests = getProfile().interests;
    activePicker = type;
    activePickerSource = source || 'edit';
    activePickerValues = activePickerSource === 'profile'
        ? (Array.isArray(profileInterests) ? profileInterests : [profileInterests].filter(Boolean))
        : splitList(input ? input.value : '');
    clearDoneSavedState();
    if (popupDone) popupDone.classList.remove('saved');

    writeText('choicePopupEyebrow', config.multiple ? 'Choose one or more' : 'Choose one');
    writeText('choicePopupTitle', config.title);
    optionsWrap.innerHTML = '';

    config.options.forEach(function(option) {
        const button = document.createElement('button');
        button.className = 'choice-option' + (activePickerValues.includes(option) ? ' active' : '');
        button.type = 'button';
        button.textContent = option;
        button.dataset.value = option;
        optionsWrap.appendChild(button);
    });

    popup.style.display = 'flex';
}

function closeChoicePopup() {
    const popup = document.getElementById('choicePopup');
    if (popup) popup.style.display = 'none';
    activePicker = null;
    activePickerValues = [];
    activePickerSource = '';
}

function applyChoicePopup() {
    const config = pickerConfig[activePicker];
    if (!config) return;
    if (activePicker === 'interests' && activePickerSource === 'profile') {
        const profile = getProfile();
        localStorage.setItem(profileKey, JSON.stringify(Object.assign({}, profile, {
            interests: activePickerValues,
            updatedAt: new Date().toISOString()
        })));
        renderProfileDashboard();
        closeChoicePopup();
        return;
    }
    const input = document.getElementById(config.inputId);
    if (input) input.value = activePickerValues.join(', ');
    clearDoneSavedState();
    const popupDone = document.getElementById('choicePopupDone');
    if (popupDone) popupDone.classList.add('saved');
    closeChoicePopup();
}

const refreshProfile = document.getElementById('refreshProfile');
const profileSearch = document.getElementById('profileSearch');
const profileInterestBox = document.getElementById('profileInterestBox');
const socialPopup = document.getElementById('socialPopup');
const socialPopupClose = document.getElementById('socialPopupClose');
const socialPopupList = document.getElementById('socialPopupList');
const shareShortcut = document.getElementById('shareShortcut');
const regenerateShareLinkButton = document.getElementById('regenerateShareLink');
const shareVisibilityToggle = document.getElementById('shareVisibilityToggle');
const nativeShareProfile = document.getElementById('nativeShareProfile');
const nativeShareInvite = document.getElementById('nativeShareInvite');
const downloadShareQr = document.getElementById('downloadShareQr');

if (refreshProfile) refreshProfile.addEventListener('click', refreshProfileDashboard);
if (profileSearch) profileSearch.addEventListener('input', renderProfileDashboard);
if (shareShortcut) {
    shareShortcut.addEventListener('click', function() {
        showProfileSection('share');
        history.replaceState(null, '', '#share');
    });
}
if (profileInterestBox) {
    profileInterestBox.addEventListener('click', function() {
        openChoicePopup('interests', 'profile');
    });
}
document.querySelectorAll('[data-copy-target]').forEach(function(button) {
    button.addEventListener('click', function() {
        if (button.disabled) return;
        const target = document.getElementById(button.dataset.copyTarget);
        const label = button.dataset.copyTarget === 'inviteShareText' ? 'Invite message' : 'Link';
        copyTextToClipboard(target ? target.value : '', label);
    });
});
if (regenerateShareLinkButton) regenerateShareLinkButton.addEventListener('click', regenerateShareLink);
if (shareVisibilityToggle) {
    shareVisibilityToggle.addEventListener('change', function() {
        updateShareVisibility(shareVisibilityToggle.checked);
    });
}
if (nativeShareProfile) {
    nativeShareProfile.addEventListener('click', function() {
        if (nativeShareProfile.disabled) return;
        const profile = getProfile();
        const config = getShareConfig(profile);
        const links = getShareLinks(config, profile);
        shareNative('VibeMatch profile', 'View ' + (profile.name || 'my') + ' on VibeMatch.', links.publicProfile, 'Profile link');
    });
}
if (nativeShareInvite) {
    nativeShareInvite.addEventListener('click', function() {
        const profile = getProfile();
        const config = getShareConfig(profile);
        const links = getShareLinks(config, profile);
        shareNative('Join me on VibeMatch', 'Join me on VibeMatch and start meeting new people.', links.invite, 'Invite link');
    });
}
if (downloadShareQr) {
    downloadShareQr.addEventListener('click', function() {
        const canvas = document.getElementById('shareQrCanvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'vibematch-invite-qr.png';
        link.click();
        setShareFeedback('QR downloaded.');
    });
}
document.addEventListener('click', function(event) {
    const socialButton = event.target.closest('.social-count-btn');
    if (!socialButton) return;
    event.preventDefault();
    openSocialPopup(socialButton.dataset.socialList || 'followers');
});

document.querySelectorAll('.social-count-btn').forEach(function(button) {
    button.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openSocialPopup(button.dataset.socialList || 'followers');
    });
});
if (socialPopupClose) socialPopupClose.addEventListener('click', closeSocialPopup);
if (socialPopupList) {
    socialPopupList.addEventListener('click', function(event) {
        const action = event.target.closest('.social-action-btn');
        if (!action) return;
        removeSocialPerson(action.dataset.socialList, action.dataset.socialId);
    });
}
if (socialPopup) {
    socialPopup.addEventListener('click', function(event) {
        if (event.target === socialPopup) closeSocialPopup();
    });
}

const historyTable = document.getElementById('historyTable');
const selectAllHistory = document.getElementById('selectAllHistory');
const deleteSelectedHistory = document.getElementById('deleteSelectedHistory');

if (historyTable) {
    historyTable.addEventListener('change', function(event) {
        if (!event.target.classList.contains('history-check')) return;
        const id = event.target.dataset.historyId;
        if (event.target.checked) {
            selectedHistoryIds.add(id);
        } else {
            selectedHistoryIds.delete(id);
        }
        updateHistoryDeleteState();
    });

    historyTable.addEventListener('click', function(event) {
        const button = event.target.closest('.history-delete-btn');
        if (!button) return;
        deleteHistoryByIds([button.dataset.historyId]);
    });
}

if (selectAllHistory) {
    selectAllHistory.addEventListener('click', function() {
        const visibleChecks = Array.from(document.querySelectorAll('.history-check'));
        const allVisibleSelected = visibleChecks.length > 0 && visibleChecks.every(function(check) {
            return selectedHistoryIds.has(check.dataset.historyId);
        });
        visibleChecks.forEach(function(check) {
            if (allVisibleSelected) {
                selectedHistoryIds.delete(check.dataset.historyId);
                check.checked = false;
            } else {
                selectedHistoryIds.add(check.dataset.historyId);
                check.checked = true;
            }
        });
        updateHistoryDeleteState();
    });
}

if (deleteSelectedHistory) {
    deleteSelectedHistory.addEventListener('click', function() {
        deleteHistoryByIds(Array.from(selectedHistoryIds));
    });
}

document.querySelectorAll('.picker-input').forEach(function(input) {
    input.addEventListener('click', function() {
        input.classList.remove('input-error');
        openChoicePopup(input.dataset.picker);
    });
});

document.querySelectorAll('#editProfileForm input').forEach(function(input) {
    input.addEventListener('input', function() {
        clearDoneSavedState();
        input.classList.remove('input-error');
        const saveMessage = document.getElementById('profileSaveMessage');
        if (saveMessage && saveMessage.classList.contains('error')) {
            saveMessage.textContent = '';
            saveMessage.classList.remove('error');
        }
    });
});

const choicePopupOptions = document.getElementById('choicePopupOptions');
const choicePopupClose = document.getElementById('choicePopupClose');
const choicePopupDone = document.getElementById('choicePopupDone');
const choicePopup = document.getElementById('choicePopup');
const phoneOtpPopup = document.getElementById('phoneOtpPopup');
const phoneOtpClose = document.getElementById('phoneOtpClose');
const phoneOtpVerify = document.getElementById('phoneOtpVerify');
const phoneOtpInput = document.getElementById('phoneOtpInput');
const deleteAccountPopup = document.getElementById('deleteAccountPopup');
const deleteReasonGrid = document.getElementById('deleteReasonGrid');
const deleteAccountClose = document.getElementById('deleteAccountClose');
const cancelDeleteAccount = document.getElementById('cancelDeleteAccount');
const confirmDeleteAccount = document.getElementById('confirmDeleteAccount');

if (choicePopupOptions) {
    choicePopupOptions.addEventListener('click', function(event) {
        const option = event.target.closest('.choice-option');
        const config = pickerConfig[activePicker];
        if (!option || !config) return;
        const value = option.dataset.value;

        if (config.multiple) {
            if (activePickerValues.includes(value)) {
                activePickerValues = activePickerValues.filter(function(item) { return item !== value; });
                option.classList.remove('active');
            } else {
                activePickerValues.push(value);
                option.classList.add('active');
            }
            return;
        }

        activePickerValues = [value];
        choicePopupOptions.querySelectorAll('.choice-option').forEach(function(button) {
            button.classList.toggle('active', button === option);
        });
    });
}

if (choicePopupClose) choicePopupClose.addEventListener('click', closeChoicePopup);
if (choicePopupDone) choicePopupDone.addEventListener('click', applyChoicePopup);
if (choicePopup) {
    choicePopup.addEventListener('click', function(event) {
        if (event.target === choicePopup) closeChoicePopup();
    });
}

if (phoneOtpClose) phoneOtpClose.addEventListener('click', closePhoneOtpPopup);
if (phoneOtpVerify) phoneOtpVerify.addEventListener('click', verifyPhoneOtp);
if (phoneOtpInput) {
    phoneOtpInput.addEventListener('input', function() {
        phoneOtpInput.value = phoneOtpInput.value.replace(/\D/g, '').slice(0, 6);
        phoneOtpInput.classList.remove('input-error');
        const message = document.getElementById('phoneOtpMessage');
        if (message && message.classList.contains('error')) {
            message.textContent = '';
            message.classList.remove('error');
        }
    });
    phoneOtpInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') verifyPhoneOtp();
    });
}
if (phoneOtpPopup) {
    phoneOtpPopup.addEventListener('click', function(event) {
        if (event.target === phoneOtpPopup) closePhoneOtpPopup();
    });
}

if (deleteReasonGrid) {
    deleteReasonGrid.addEventListener('click', function(event) {
        const card = event.target.closest('.delete-reason-card');
        if (!card) return;
        selectDeleteReason(card);
    });
}
if (deleteAccountClose) deleteAccountClose.addEventListener('click', closeDeleteAccountPopup);
if (cancelDeleteAccount) cancelDeleteAccount.addEventListener('click', closeDeleteAccountPopup);
if (confirmDeleteAccount) confirmDeleteAccount.addEventListener('click', confirmDeleteAccountWithReason);
if (deleteAccountPopup) {
    deleteAccountPopup.addEventListener('click', function(event) {
        if (event.target === deleteAccountPopup) closeDeleteAccountPopup();
    });
}

function clearDoneSavedState() {
    const doneButton = document.querySelector('.done-profile-btn');
    if (doneButton) doneButton.classList.remove('saved');
}

document.querySelectorAll('.profile-nav a[data-section]').forEach(function(link) {
    link.addEventListener('click', function(event) {
        event.preventDefault();
        const section = link.dataset.section || 'profile';
        showProfileSection(section);
        history.replaceState(null, '', '#' + section);
    });
});

const logoutAccount = document.getElementById('logoutAccount');
const deleteAccount = document.getElementById('deleteAccount');
const editProfileForm = document.getElementById('editProfileForm');
const editProfilePhoto = document.getElementById('editProfilePhoto');

if (editProfileForm) editProfileForm.addEventListener('submit', saveEditedProfile);

if (editProfilePhoto) {
    editProfilePhoto.addEventListener('change', function() {
        const file = editProfilePhoto.files && editProfilePhoto.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function() {
            pendingProfilePhoto = String(reader.result || '');
            setPreviewPhoto(document.getElementById('editPhotoPreview'), {
                name: document.getElementById('editName').value || 'User',
                profilePhoto: pendingProfilePhoto
            });
            clearDoneSavedState();
        };
        reader.readAsDataURL(file);
    });
}

if (logoutAccount) {
    logoutAccount.addEventListener('click', function() {
        clearAuthSession();
        window.location.href = 'login.html';
    });
}

if (deleteAccount) {
    deleteAccount.addEventListener('click', openDeleteAccountPopup);
}

const sharedProfileToken = new URLSearchParams(window.location.search).get('share');
if (sharedProfileToken) {
    renderSharedProfilePage(sharedProfileToken);
} else {
    renderProfileDashboard();
    showProfileSection((window.location.hash || '#profile').replace('#', '') || 'profile');
}
