// ============ TYPEWRITER EFFECT ============
const words = ["the horizon.", "a stranger.", "new friends."];
const typewriterEl = document.getElementById("typewriter");
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeSpeed = 120;

function typeWriter() {
    if (!typewriterEl) {
        return;
    }

    const currentWord = words[wordIndex];

    if (!isDeleting) {
        typewriterEl.textContent = currentWord.substring(0, charIndex + 1);
        charIndex++;

        if (charIndex === currentWord.length) {
            isDeleting = true;
            typeSpeed = 1800; // pause before deleting
        } else {
            typeSpeed = 120;
        }
    } else {
        typewriterEl.textContent = currentWord.substring(0, charIndex - 1);
        charIndex--;

        if (charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typeSpeed = 400; // small pause before next word
        } else {
            typeSpeed = 60;
        }
    }

    setTimeout(typeWriter, typeSpeed);
}

typeWriter();


// ============ USERS ONLINE COUNTER ============
const usersOnlineEl = document.getElementById("usersOnline");
const featureUsersEl = document.getElementById("featureUsersCount");

// Count from 1 to 80000 slowly (dull/slow visible effect)
let displayCount = 1;
const targetCount = 30000;
const intervalMs = 30;         // every 30ms
const incrementPerStep = 36;   // ~25 seconds total

if (featureUsersEl) {
    featureUsersEl.textContent = targetCount.toLocaleString() + "+ users";
}

document.querySelectorAll(".feature-item").forEach(function (item) {
    item.addEventListener("click", function () {
        const target = item.dataset.target;
        if (target === "videochat.html" && window.VibeMatchTokens && !window.VibeMatchTokens.requireAuth({
            title: "Sign in to start video chat",
            copy: "Create or sign in first. You get 3 daily chat passes; each pass opens one new person and that conversation then stays unlimited.",
            redirect: "videochat.html"
        })) {
            return;
        }

        item.classList.remove("feature-bounce");
        void item.offsetWidth;
        item.classList.add("feature-bounce");

        if (target) {
            setTimeout(function () {
                window.location.href = target;
            }, 260);
        }
    });

    item.addEventListener("animationend", function () {
        item.classList.remove("feature-bounce");
    });
});

if (usersOnlineEl) {
    const slowCounter = setInterval(function () {
        displayCount += incrementPerStep;
        if (displayCount >= targetCount) {
            displayCount = targetCount;
            clearInterval(slowCounter);
        }
        usersOnlineEl.textContent = displayCount.toLocaleString();
    }, intervalMs);

    // Initial display
    usersOnlineEl.textContent = "1";
}



// ============ HAMBURGER MENU (mobile) ============
const hamburger = document.getElementById("hamburger");
const navCenter = document.querySelector(".nav-center");
const startChatButton = document.getElementById("startChat");
const signInButton = document.getElementById("signIn");
const navProfilePhoto = document.getElementById("navProfilePhoto");
const navMessageCount = document.getElementById("navMessageCount");
const navNotificationCount = document.getElementById("navNotificationCount");
const homeMessageTokenSlot = document.getElementById("homeMessageTokenSlot");

if (window.VibeMatchTokens && homeMessageTokenSlot) {
    window.VibeMatchTokens.mountWidget(homeMessageTokenSlot);
}

function readNavJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        return value || fallback;
    } catch (error) {
        return fallback;
    }
}

function escapeHtmlText(value) {
    return String(value || "").replace(/[&<>"']/g, function(char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char];
    });
}

function decodeInvitePayload(value) {
    if (!value) return null;
    try {
        let base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        const binary = atob(base64);
        const bytes = binary.split("").map(function(char) {
            return char.charCodeAt(0);
        });
        const json = window.TextDecoder
            ? new TextDecoder().decode(new Uint8Array(bytes))
            : decodeURIComponent(escape(binary));
        return JSON.parse(json);
    } catch (error) {
        return null;
    }
}

function renderInviteBanner(invite) {
    if (!invite || !invite.token || document.querySelector(".invite-share-banner")) return;
    const banner = document.createElement("div");
    const sender = escapeHtmlText(invite.name || "A VibeMatch friend");
    banner.className = "invite-share-banner";
    banner.innerHTML =
        '<div class="invite-share-copy">' +
            '<span class="invite-share-kicker">Private invite</span>' +
            '<strong>' + sender + ' invited you to VibeMatch</strong>' +
            '<p>Start a video chat or create your profile to connect faster.</p>' +
        '</div>' +
        '<div class="invite-share-actions">' +
            '<button class="invite-start-btn" type="button"><i class="fas fa-video"></i><span>Start</span></button>' +
            '<button class="invite-close-btn" type="button" aria-label="Dismiss invite"><i class="fas fa-xmark"></i></button>' +
        '</div>';
    document.body.appendChild(banner);

    const startButton = banner.querySelector(".invite-start-btn");
    const closeButton = banner.querySelector(".invite-close-btn");
    if (startButton) {
        startButton.addEventListener("click", function () {
            window.location.href = "videochat.html?invite=" + encodeURIComponent(invite.token);
        });
    }
    if (closeButton) {
        closeButton.addEventListener("click", function () {
            banner.remove();
        });
    }
}

function captureInviteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    const payload = decodeInvitePayload(params.get("by"));
    if (!token) {
        renderInviteBanner(readNavJson("vibematch_pending_invite", null));
        return;
    }
    const records = readNavJson("vibematch_profile_share_records", {});
    const sender = records[token] || {};
    const invite = {
        token: token,
        name: sender.name || (payload && payload.n) || "A VibeMatch friend",
        handle: sender.handle || (payload && payload.h) || "",
        acceptedAt: "",
        receivedAt: new Date().toISOString()
    };
    localStorage.setItem("vibematch_pending_invite", JSON.stringify(invite));
    renderInviteBanner(invite);
}

function setNavBadge(element, count) {
    if (!element) return;
    if (count > 0) {
        element.textContent = count > 99 ? "99+" : String(count);
        element.classList.add("visible");
    } else {
        element.textContent = "";
        element.classList.remove("visible");
    }
}

function updateNavbarCounts() {
    const chats = readNavJson("vibematch_video_chats", []);
    const messageRequests = readNavJson("vibematch_message_requests", []);
    const friendRequests = readNavJson("vibematch_friend_requests", []);
    const sentFriendRequests = readNavJson("vibematch_sent_friend_requests", []);
    const friends = readNavJson("vibematch_video_friends", []);
    const deletedNotifications = new Set(readNavJson("vibematch_deleted_notifications", []));
    const seenNotifications = new Set(
        readNavJson("vibematch_seen_notifications", []).concat(readNavJson("vibematch_seen_notifications_click_v1", []))
    );

    const dmChats = Array.isArray(chats)
        ? chats.filter(function(chat) {
            return chat && chat.status !== "From video chat";
        })
        : [];

    const unreadMessageUsers = dmChats.reduce(function(total, chat) {
        return total + (Number(chat && chat.unread ? chat.unread : 0) > 0 ? 1 : 0);
    }, 0);
    const unreadMessages = unreadMessageUsers + (Array.isArray(messageRequests) ? messageRequests.length : 0);

    const visibleMessageNotifications = dmChats
        .filter(function(chat) {
            if (!chat || !chat.preview || Number(chat.unread || 0) <= 0) return false;
            const id = "messages:" + [chat.name, chat.updatedAt || chat.lastMessageAt, chat.preview].filter(Boolean).join(":");
            return !deletedNotifications.has(id) && !seenNotifications.has(id);
        }).reduce(function(names, chat) {
            names.add((chat.name || "Someone").toLowerCase());
            return names;
        }, new Set()).size;

    const visibleMessageRequests = Array.isArray(messageRequests)
        ? messageRequests.filter(function(request) {
            if (!request) return false;
            const id = "message-request:" + [request.id, request.name, request.updatedAt || request.requestedAt, request.preview].filter(Boolean).join(":");
            return !deletedNotifications.has(id) && !seenNotifications.has(id);
        }).length
        : 0;

    const visibleFriendRequests = Array.isArray(friendRequests)
        ? friendRequests.filter(function(request) {
            const id = "friend-request:" + [request.id, request.name, request.requestedAt].filter(Boolean).join(":");
            return !deletedNotifications.has(id) && !seenNotifications.has(id);
        }).length
        : 0;

    const incomingFriendIds = new Set(Array.isArray(friendRequests)
        ? friendRequests.map(function(request) { return request && request.id; }).filter(Boolean)
        : []);
    const visibleSentFriendRequests = Array.isArray(sentFriendRequests)
        ? sentFriendRequests.filter(function(request) {
            if (!request || incomingFriendIds.has(request.id)) return false;
            const id = "sent-friend-request:" + [request.id, request.name, request.requestedAt].filter(Boolean).join(":");
            return !deletedNotifications.has(id) && !seenNotifications.has(id);
        }).length
        : 0;

    const visibleFriendNotifications = Array.isArray(friends)
        ? friends.filter(function(friend) {
            const id = "friends:" + [friend.id, friend.name, friend.addedAt].filter(Boolean).join(":");
            return !deletedNotifications.has(id) && !seenNotifications.has(id);
        }).length
        : 0;

    setNavBadge(navMessageCount, unreadMessages);
    setNavBadge(navNotificationCount, visibleMessageNotifications + visibleMessageRequests + visibleFriendRequests + visibleSentFriendRequests + visibleFriendNotifications);
}

function applyNavbarProfilePhoto() {
    if (!navProfilePhoto) return;
    try {
        const profile = JSON.parse(localStorage.getItem("vibematch_profile_data") || "null");
        const photo = profile && profile.profilePhoto;
        const profileLink = navProfilePhoto.closest(".nav-icon");
        if (photo) {
            navProfilePhoto.src = photo;
            navProfilePhoto.style.display = "block";
            if (profileLink) profileLink.classList.add("has-profile-photo");
        } else {
            navProfilePhoto.removeAttribute("src");
            navProfilePhoto.style.display = "none";
            if (profileLink) profileLink.classList.remove("has-profile-photo");
        }
    } catch (error) {
        navProfilePhoto.style.display = "none";
    }
}

applyNavbarProfilePhoto();
updateNavbarCounts();
captureInviteFromUrl();

if (hamburger && navCenter) {
    hamburger.addEventListener("click", function () {
        navCenter.classList.toggle("active");
        hamburger.classList.toggle("active");
    });
}

// Close mobile menu when a link is clicked
document.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
        if (navCenter && hamburger) {
            navCenter.classList.remove("active");
            hamburger.classList.remove("active");
        }
    });
});

if (signInButton) {
    signInButton.addEventListener("click", function () {
        window.location.href = "login.html?mode=signin";
    });
}

if (startChatButton) {
    startChatButton.addEventListener("click", function () {
        if (window.VibeMatchTokens && !window.VibeMatchTokens.requireAuth({
            title: "Sign in to start video chat",
            copy: "Start video chat after signing in, get 3 free new-chat passes daily, and message unlocked people without limits.",
            redirect: "videochat.html"
        })) {
            return;
        }

        window.location.href = "videochat.html";
    });
}

document.querySelectorAll(".footer-apps .app-btn, .social-icons a").forEach(function (item) {
    item.addEventListener("click", function () {
        item.classList.remove("footer-pop");
        void item.offsetWidth;
        item.classList.add("footer-pop");
    });

    item.addEventListener("animationend", function () {
        item.classList.remove("footer-pop");
    });
});

document.querySelectorAll('[data-open-guidelines="true"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        window.location.href = "community-guidelines.html";
    });
});

document.querySelectorAll(".faq-question").forEach(function (button) {
    button.addEventListener("click", function () {
        const currentItem = button.closest(".faq-item");
        const wasActive = currentItem.classList.contains("active");

        document.querySelectorAll(".faq-item").forEach(function (item) {
            item.classList.remove("active");
            const question = item.querySelector(".faq-question");
            if (question) {
                question.setAttribute("aria-expanded", "false");
            }
        });

        if (!wasActive) {
            currentItem.classList.add("active");
            button.setAttribute("aria-expanded", "true");
        }
    });
});

const authForm = document.getElementById("authForm");
const formTabs = document.querySelectorAll(".tab-btn");
const nameGroup = document.getElementById("nameGroup");
const formTitle = document.getElementById("formTitle");
const formSub = document.getElementById("formSub");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
let authMode = "signup";

function setAuthMode(mode) {
    authMode = mode === "signin" ? "signin" : "signup";
    const isSignup = authMode === "signup";

    formTabs.forEach(function (item) {
        item.classList.toggle("active", item.dataset.mode === authMode);
    });

    if (nameGroup) {
        nameGroup.classList.toggle("hidden", !isSignup);
    }
    if (formTitle) {
        formTitle.textContent = isSignup ? "Create account" : "Welcome back";
    }
    if (formSub) {
        formSub.textContent = isSignup ? "Join VibeMatch and start meeting new people." : "Sign in to continue your conversations.";
    }
    if (submitBtn) {
        submitBtn.innerHTML = isSignup ? '<i class="fas fa-user-plus"></i> Create account' : '<i class="fas fa-sign-in-alt"></i> Sign in';
    }
    if (formMessage) {
        formMessage.textContent = "";
    }
}

formTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
        setAuthMode(tab.dataset.mode);
    });
});

if (formTabs.length) {
    const params = new URLSearchParams(window.location.search);
    setAuthMode(params.get("mode"));
}

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const showPassword = passwordInput.type === "password";
        passwordInput.type = showPassword ? "text" : "password";
        togglePassword.innerHTML = showPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });
}

if (authForm && formMessage) {
    authForm.addEventListener("submit", function (event) {
        event.preventDefault();
        formMessage.style.color = "#16a34a";
        formMessage.textContent = authMode === "signup" ? "Signup form is ready." : "Signin form is ready.";
    });
}


// ============ NAV LINK CLICK EFFECT ============
// (click color effect removed)
