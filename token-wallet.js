(function() {
    const storageKey = "vibematch_daily_message_tokens_v1";
    const sessionKey = "vibematch_current_user";
    const maxTokens = 3;
    const resetMs = 24 * 60 * 60 * 1000;

    function now() {
        return Date.now();
    }

    function readStateRaw() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
            return saved && typeof saved === "object" ? saved : null;
        } catch (error) {
            return null;
        }
    }

    function readJsonStorage(storage, key) {
        try {
            const saved = JSON.parse(storage.getItem(key) || "null");
            return saved && typeof saved === "object" ? saved : null;
        } catch (error) {
            return null;
        }
    }

    function getCurrentUser() {
        const localUser = readJsonStorage(localStorage, sessionKey);
        if (localUser) return localUser;

        const sessionUser = readJsonStorage(sessionStorage, sessionKey);
        if (sessionUser) {
            localStorage.setItem(sessionKey, JSON.stringify(sessionUser));
            sessionStorage.removeItem(sessionKey);
        }
        return sessionUser;
    }

    function getCurrentUserId(user) {
        const identity = user && (user.email || user.name);
        return identity ? String(identity).trim().toLowerCase() : "";
    }

    function isAuthenticated() {
        return Boolean(getCurrentUserId(getCurrentUser()));
    }

    function getCurrentPageRedirect(fallback) {
        const fileName = (window.location.pathname.split("/").pop() || fallback || "index.html");
        return fileName + window.location.search + window.location.hash;
    }

    function getLoginUrl(redirectTarget) {
        const redirect = redirectTarget || getCurrentPageRedirect("index.html");
        return "login.html?mode=signin&redirect=" + encodeURIComponent(redirect);
    }

    function normalizeState(state) {
        const currentTime = now();
        const user = getCurrentUser();
        const ownerId = getCurrentUserId(user);

        if (!ownerId) {
            return {
                ownerId: "guest",
                tokens: 0,
                startedAt: currentTime,
                unlockedPeople: [],
                guest: true
            };
        }

        const startedAt = Number(state && state.startedAt) || currentTime;
        const expired = currentTime - startedAt >= resetMs;
        const savedTokens = Number(state && state.tokens);
        const ownerChanged = !state || state.ownerId !== ownerId;

        if (!state || ownerChanged) {
            return {
                ownerId: ownerId,
                tokens: maxTokens,
                startedAt: currentTime,
                unlockedPeople: [],
                guest: false
            };
        }

        if (expired) {
            return {
                ownerId: ownerId,
                tokens: maxTokens,
                startedAt: currentTime,
                unlockedPeople: Array.isArray(state.unlockedPeople) ? state.unlockedPeople : [],
                guest: false
            };
        }

        return {
            ownerId: ownerId,
            tokens: Math.max(0, Math.min(maxTokens, Number.isFinite(savedTokens) ? savedTokens : maxTokens)),
            startedAt: startedAt,
            unlockedPeople: Array.isArray(state.unlockedPeople) ? state.unlockedPeople : [],
            guest: false
        };
    }

    function statesMatch(raw, state) {
        if (!raw) return false;
        return raw.ownerId === state.ownerId &&
            Number(raw.tokens) === state.tokens &&
            Number(raw.startedAt) === state.startedAt &&
            Boolean(raw.guest) === Boolean(state.guest) &&
            JSON.stringify(Array.isArray(raw.unlockedPeople) ? raw.unlockedPeople : []) === JSON.stringify(state.unlockedPeople);
    }

    function getState() {
        const raw = readStateRaw();
        const state = normalizeState(raw);
        if (!statesMatch(raw, state)) {
            localStorage.setItem(storageKey, JSON.stringify(state));
        }
        return state;
    }

    function saveState(state) {
        localStorage.setItem(storageKey, JSON.stringify(state));
        window.dispatchEvent(new CustomEvent("vibematch:tokens-updated", {
            detail: state
        }));
    }

    function getPersonKey(personName) {
        return String(personName || "User").trim().toLowerCase().replace(/\s+/g, " ");
    }

    function getResetMs(state) {
        return Math.max(0, resetMs - (now() - state.startedAt));
    }

    function formatResetLabel(ms) {
        if (ms <= 0) return "now";
        const hours = Math.floor(ms / (60 * 60 * 1000));
        const minutes = Math.ceil((ms % (60 * 60 * 1000)) / (60 * 1000));
        if (hours <= 0) return minutes + "m";
        if (minutes <= 0) return hours + "h";
        return hours + "h " + minutes + "m";
    }

    function useTokenForPerson(personName) {
        const state = getState();
        const key = getPersonKey(personName);

        if (state.guest) {
            return {
                allowed: false,
                needsAuth: true,
                alreadyUnlocked: false,
                tokens: 0,
                resetLabel: "Sign in"
            };
        }

        if (state.unlockedPeople.includes(key)) {
            return {
                allowed: true,
                alreadyUnlocked: true,
                tokens: state.tokens,
                resetLabel: formatResetLabel(getResetMs(state))
            };
        }

        if (state.tokens <= 0) {
            return {
                allowed: false,
                alreadyUnlocked: false,
                tokens: 0,
                resetLabel: formatResetLabel(getResetMs(state))
            };
        }

        state.tokens -= 1;
        state.unlockedPeople.push(key);
        saveState(state);

        return {
            allowed: true,
            alreadyUnlocked: false,
            tokens: state.tokens,
            resetLabel: formatResetLabel(getResetMs(state))
        };
    }

    function injectStyles() {
        if (document.getElementById("vibematch-token-wallet-styles")) return;

        const style = document.createElement("style");
        style.id = "vibematch-token-wallet-styles";
        style.textContent = `
            .message-token-widget {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-height: 36px;
                padding: 0;
                border: 0;
                border-radius: 0;
                background: transparent;
                color: #171717;
                box-shadow: none;
                white-space: nowrap;
                cursor: pointer;
                user-select: none;
            }

            .message-token-widget:focus-visible {
                outline: 2px solid rgba(125,211,252,0.9);
                outline-offset: 4px;
                border-radius: 8px;
            }

            .message-token-icon {
                width: 26px;
                height: 26px;
                border-radius: 50%;
                display: grid;
                place-items: center;
                color: #ffffff;
                background: linear-gradient(135deg, #ff4d8d, #ff7a00);
                font-size: 12px;
                box-shadow: 0 6px 16px rgba(255,122,0,0.28);
            }

            .message-token-copy {
                display: flex;
                flex-direction: column;
                gap: 0;
                line-height: 1.05;
            }

            .message-token-copy strong {
                font-size: 12px;
                font-weight: 900;
                color: #171717;
            }

            .message-token-copy small,
            .message-token-reset {
                font-size: 10px;
                font-weight: 800;
                color: rgba(23,23,23,0.62);
            }

            .message-token-reset {
                padding-left: 2px;
            }

            .token-subscription-overlay {
                position: fixed;
                inset: 0;
                z-index: 7000;
                display: grid;
                place-items: center;
                padding: 22px;
                background: rgba(0,0,0,0.74);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
            }

            .token-subscription-sheet {
                position: relative;
                width: min(500px, 100%);
                border-radius: 8px;
                padding: 30px 32px;
                background: #141414;
                color: #ffffff;
                border: 1px solid rgba(255,255,255,0.14);
                box-shadow: 0 24px 70px rgba(0,0,0,0.42);
            }

            .token-subscription-close {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 36px;
                height: 36px;
                border: 0;
                border-radius: 50%;
                background: rgba(255,255,255,0.08);
                color: #ffffff;
                cursor: pointer;
            }

            .token-subscription-kicker {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                min-height: 30px;
                padding: 0 11px;
                border-radius: 999px;
                background: rgba(255,122,0,0.16);
                color: #ffd49c;
                font-size: 12px;
                font-weight: 900;
            }

            .token-subscription-sheet h2 {
                margin: 16px 42px 8px 0;
                font-size: 30px;
                font-weight: 700;
                line-height: 1.08;
                letter-spacing: 0;
                color: rgba(255,255,255,0.92);
            }

            .token-subscription-sheet p {
                margin: 0 0 18px;
                color: rgba(255,255,255,0.62);
                font-size: 14px;
                line-height: 1.55;
                font-weight: 500;
            }

            .token-plan-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 8px;
                margin: 18px 0;
            }

            .token-plan-card {
                min-height: 86px;
                border-radius: 16px;
                padding: 12px 9px;
                background: rgba(255,255,255,0.07);
                border: 1px solid rgba(255,255,255,0.12);
                text-align: center;
            }

            .token-plan-card.is-featured {
                background: linear-gradient(135deg, rgba(255,77,141,0.22), rgba(255,122,0,0.18));
                border-color: rgba(255,122,0,0.5);
            }

            .token-plan-card span {
                display: block;
                color: rgba(255,255,255,0.66);
                font-size: 10px;
                font-weight: 900;
                text-transform: uppercase;
            }

            .token-plan-card strong {
                display: block;
                margin-top: 7px;
                font-size: 18px;
                line-height: 1.1;
            }

            .token-plan-card small {
                display: block;
                margin-top: 5px;
                color: rgba(255,255,255,0.56);
                font-size: 10px;
                font-weight: 700;
            }

            .token-subscribe-primary,
            .token-subscribe-secondary {
                width: 100%;
                min-height: 48px;
                border-radius: 999px;
                border: 0;
                font-weight: 900;
                cursor: pointer;
            }

            .token-subscribe-primary {
                background: #ffffff;
                color: #1f1f1f;
                box-shadow: 0 18px 34px rgba(255,255,255,0.12);
            }

            .token-subscribe-secondary {
                margin-top: 8px;
                background: transparent;
                color: rgba(255,255,255,0.58);
            }

            .token-auth-benefits {
                display: grid;
                gap: 8px;
                margin: 18px 0;
                padding: 0;
                list-style: none;
            }

            .token-auth-benefits li {
                display: flex;
                align-items: center;
                gap: 9px;
                min-height: 34px;
                color: rgba(255,255,255,0.68);
                font-size: 13px;
                font-weight: 600;
            }

            .token-auth-benefits i {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: grid;
                place-items: center;
                color: #111111;
                background: #ffffff;
                font-size: 11px;
            }

            @media (max-width: 700px) {
                .message-token-widget {
                    min-height: 32px;
                    padding: 4px 8px;
                    gap: 6px;
                }

                .message-token-icon {
                    width: 23px;
                    height: 23px;
                    font-size: 11px;
                }

                .message-token-copy small,
                .message-token-reset {
                    display: none;
                }

                .message-token-copy strong {
                    font-size: 11px;
                }

                .token-subscription-sheet {
                    padding: 22px;
                    border-radius: 8px;
                }

                .token-subscription-sheet h2 {
                    font-size: 25px;
                }

                .token-plan-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function updateWidgets() {
        const state = getState();
        const resetLabel = state.guest ? "Sign in" : formatResetLabel(getResetMs(state));

        document.querySelectorAll("[data-message-token-count]").forEach(function(node) {
            node.textContent = state.tokens;
        });

        document.querySelectorAll("[data-message-token-reset]").forEach(function(node) {
            node.textContent = state.guest
                ? "Sign in for 3 daily"
                : state.tokens >= maxTokens
                    ? "24h refill"
                    : "Refills in " + resetLabel;
        });
    }

    function mountWidget(target, options) {
        injectStyles();
        const container = typeof target === "string" ? document.querySelector(target) : target;
        if (!container || container.querySelector(".message-token-widget")) return null;

        const widget = document.createElement("div");
        widget.className = "message-token-widget";
        widget.setAttribute("role", "button");
        widget.tabIndex = 0;
        widget.setAttribute("aria-label", "Free daily chat passes");
        widget.innerHTML = `
            <span class="message-token-icon"><i class="fas fa-coins"></i></span>
            <span class="message-token-copy">
                <strong><span data-message-token-count>3</span> free</strong>
                <small>chat passes</small>
            </span>
            <span class="message-token-reset" data-message-token-reset>24h refill</span>
        `;

        function openPlansIfEmpty() {
            const state = getState();
            if (state.guest) {
                showAuthModal({
                    title: "Sign in to get free chat passes",
                    copy: "Get 3 free chat passes every day. One pass opens a new person, then your messages with them are unlimited.",
                    redirect: options && options.redirect
                });
                return;
            }

            if (state.tokens > 0) {
                updateWidgets();
                return;
            }

            showSubscriptionModal({ personName: "more people" });
        }

        widget.addEventListener("click", openPlansIfEmpty);
        widget.addEventListener("keydown", function(event) {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            openPlansIfEmpty();
        });

        if (options && options.prepend) {
            container.prepend(widget);
        } else {
            container.appendChild(widget);
        }

        updateWidgets();
        return widget;
    }

    function showAuthModal(options) {
        injectStyles();
        const existing = document.querySelector(".token-subscription-overlay");
        if (existing) existing.remove();

        const redirectTarget = options && options.redirect ? options.redirect : getCurrentPageRedirect("index.html");
        const overlay = document.createElement("div");
        const sheet = document.createElement("div");
        const close = document.createElement("button");
        const kicker = document.createElement("div");
        const title = document.createElement("h2");
        const copy = document.createElement("p");
        const benefits = document.createElement("ul");
        const primary = document.createElement("button");
        const secondary = document.createElement("button");

        overlay.className = "token-subscription-overlay";
        sheet.className = "token-subscription-sheet";
        close.className = "token-subscription-close";
        close.type = "button";
        close.innerHTML = '<i class="fas fa-times"></i>';
        kicker.className = "token-subscription-kicker";
        kicker.innerHTML = '<i class="fas fa-lock"></i><span>Account needed</span>';
        title.textContent = options && options.title ? options.title : "Sign in to continue";
        copy.textContent = options && options.copy
            ? options.copy
            : "Sign in to start video chat, save your profile, use daily chat passes, and keep your chat history connected.";
        benefits.className = "token-auth-benefits";
        benefits.innerHTML = `
            <li><i class="fas fa-coins"></i><span>3 free new-chat passes every day</span></li>
            <li><i class="fas fa-infinity"></i><span>Unlimited messages after a person is unlocked</span></li>
            <li><i class="fas fa-user-plus"></i><span>Add friends and keep chat history</span></li>
            <li><i class="fas fa-shield-halved"></i><span>Safer account-based conversations</span></li>
        `;
        primary.className = "token-subscribe-primary";
        primary.type = "button";
        primary.textContent = "Sign in / create account";
        secondary.className = "token-subscribe-secondary";
        secondary.type = "button";
        secondary.textContent = "Maybe later";

        function removeModal() {
            overlay.remove();
        }

        close.addEventListener("click", removeModal);
        secondary.addEventListener("click", removeModal);
        primary.addEventListener("click", function() {
            window.location.href = getLoginUrl(redirectTarget);
        });
        overlay.addEventListener("pointerdown", function(event) {
            if (event.target === overlay) removeModal();
        });

        sheet.append(close, kicker, title, copy, benefits, primary, secondary);
        overlay.appendChild(sheet);
        document.body.appendChild(overlay);
    }

    function requireAuth(options) {
        if (isAuthenticated()) return true;
        showAuthModal(options);
        return false;
    }

    function showSubscriptionModal(options) {
        injectStyles();
        if (!isAuthenticated()) {
            showAuthModal(options);
            return;
        }

        const existing = document.querySelector(".token-subscription-overlay");
        if (existing) existing.remove();

        const personName = options && options.personName ? options.personName : "this person";
        const state = getState();
        const overlay = document.createElement("div");
        const sheet = document.createElement("div");
        const close = document.createElement("button");
        const kicker = document.createElement("div");
        const title = document.createElement("h2");
        const copy = document.createElement("p");
        const plans = document.createElement("div");
        const primary = document.createElement("button");
        const secondary = document.createElement("button");

        overlay.className = "token-subscription-overlay";
        sheet.className = "token-subscription-sheet";
        close.className = "token-subscription-close";
        close.type = "button";
        close.innerHTML = '<i class="fas fa-times"></i>';
        kicker.className = "token-subscription-kicker";
        kicker.innerHTML = '<i class="fas fa-coins"></i><span>Free limit finished</span>';
        title.textContent = "Unlock more chats";
        copy.textContent = "Your 3 free daily chat passes are used. A pass is charged only once per new person; unlocked conversations stay unlimited. To talk with " + personName + " now, visit the shop or wait " + formatResetLabel(getResetMs(state)) + " for your next 3 passes.";
        plans.className = "token-plan-grid";
        plans.innerHTML = `
            <div class="token-plan-card"><span>Coins</span><strong>from ₹49</strong><small>Pay only when needed</small></div>
            <div class="token-plan-card is-featured"><span>Popular</span><strong>₹249</strong><small>1 month VIP</small></div>
            <div class="token-plan-card"><span>Free</span><strong>3 daily</strong><small>Refills automatically</small></div>
        `;
        primary.className = "token-subscribe-primary";
        primary.type = "button";
        primary.textContent = "Open VibeMatch shop";
        secondary.className = "token-subscribe-secondary";
        secondary.type = "button";
        secondary.textContent = "Maybe later";

        function removeModal() {
            overlay.remove();
        }

        close.addEventListener("click", removeModal);
        secondary.addEventListener("click", removeModal);
        primary.addEventListener("click", function() {
            window.location.href = "shop.html";
        });
        overlay.addEventListener("pointerdown", function(event) {
            if (event.target === overlay) removeModal();
        });

        sheet.append(close, kicker, title, copy, plans, primary, secondary);
        overlay.appendChild(sheet);
        document.body.appendChild(overlay);
    }

    function requestChatAccess(personName) {
        const result = useTokenForPerson(personName);
        updateWidgets();

        if (result.needsAuth) {
            showAuthModal({
                title: "Sign in to message",
                copy: "Sign in to get 3 free chat passes daily. Each pass opens one new person; after that, you can message them without limits."
            });
            return false;
        }

        if (!result.allowed) {
            showSubscriptionModal({ personName: personName });
            return false;
        }

        return true;
    }

    window.VibeMatchTokens = {
        getState: getState,
        isAuthenticated: isAuthenticated,
        requireAuth: requireAuth,
        mountWidget: mountWidget,
        requestChatAccess: requestChatAccess,
        showAuthModal: showAuthModal,
        showSubscriptionModal: showSubscriptionModal,
        updateWidgets: updateWidgets
    };

    window.addEventListener("storage", function(event) {
        if (event.key === storageKey) updateWidgets();
    });

    window.addEventListener("vibematch:tokens-updated", updateWidgets);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateWidgets);
    } else {
        updateWidgets();
    }
})();
