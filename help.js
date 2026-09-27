/* =========================
   SEARCH FUNCTIONALITY
========================= */

const searchInput = document.querySelector(".search-box input");

const supportCards = document.querySelectorAll(".support-card");
const miniBoxes = document.querySelectorAll(".mini-box");
const libraryCategories = document.querySelectorAll(".library-category");
const libraryArticles = document.querySelectorAll(".library-article");

const articleGuidance = {
    "Safety": [
        "Use Next, Stop, Block, and Report when a chat feels unsafe.",
        "Do not share private images, personal details, passwords, or payment information.",
        "Report sexual content, threats, hate, scams, underage concerns, or privacy violations.",
        "Review the Community Guidelines before starting video chat."
    ],
    "Security": [
        "Use a secure login method and do not share verification codes.",
        "Log out of shared devices and report suspicious account activity quickly.",
        "Avoid unknown links, fake giveaways, payment requests, and external files.",
        "Contact support if you believe your account or device was compromised."
    ],
    "Privacy": [
        "Only share information you are comfortable showing to strangers.",
        "Use profile, message, and video chat settings carefully.",
        "Do not record, screenshot, repost, or expose another user without permission.",
        "Contact support to request privacy help or account data guidance."
    ],
    "Technical": [
        "Refresh the page after checking browser permissions.",
        "Use a stable connection and close other apps that may use camera or microphone.",
        "Try another browser or device if video, audio, or login still fails.",
        "Contact support with your device, browser, and the exact problem."
    ],
    "Account": [
        "Keep your profile accurate, respectful, and safe for random chat.",
        "Update gender, country, language, and interests from your profile settings.",
        "Use account recovery if login or verification stops working.",
        "Contact support before deleting your account if you need help exporting details."
    ],
    "Video Chat and Messages": [
        "Allow camera and microphone permissions before starting a video chat.",
        "Use Next or Stop when a conversation is not comfortable.",
        "Keep friend requests, messages, and notifications respectful.",
        "Block or report users who spam, harass, threaten, or pressure you."
    ],
    "Payments": [
        "Check Purchase history in the shop before retrying a payment.",
        "Never share a card PIN, UPI PIN, OTP, password, or full payment credentials.",
        "Keep the transaction reference, payment date, and charged amount for support.",
        "Contact support if a completed charge does not unlock the purchased item."
    ]
};

const helpTopics = {
    "Account Access": {
        intro: "Manage sign-in, verification, password reset, and profile access from here.",
        points: [
            "Reset your password if you cannot sign in.",
            "Check email or phone verification steps.",
            "Update profile details and account settings.",
            "Recover your account if access is blocked."
        ]
    },
    "Privacy & Safety": {
        intro: "Find privacy controls, safety tools, reporting options, and community guidelines.",
        points: [
            "Control who can connect with you.",
            "Report or block unsafe users.",
            "Review privacy settings for your profile.",
            "Follow safety tips before starting conversations."
        ]
    },
    "Community Guidelines": {
        intro: "Review the behavior standards that keep VibeMatch safer across video chat, messages, profiles, and reports.",
        points: [
            "Read the full Community Guidelines before starting video chat.",
            "Avoid nudity, harassment, hate, scams, threats, and privacy violations.",
            "Use Report or Block when a conversation feels unsafe.",
            "Keep profile details, friend requests, and messages respectful."
        ]
    },
    "Video & Audio": {
        intro: "Fix camera, microphone, browser permissions, and call quality issues.",
        points: [
            "Allow camera and microphone permissions in your browser.",
            "Check that no other app is using your camera.",
            "Use a stable internet connection for video chat.",
            "Refresh the page after changing device permissions."
        ]
    },
    "Getting Started": {
        intro: "Learn the basics of using VibeMatch and starting your first conversation.",
        points: [
            "Create or sign in to your account.",
            "Open Video Chat and allow camera access.",
            "Start matching with people around the world.",
            "Use Messages to continue conversations later."
        ]
    },
    "Payments & Billing": {
        intro: "Get clear help for checkout, coins, VIP purchases, receipts, refunds, and pending payments.",
        points: [
            "Open Purchase history in the shop to confirm completed orders.",
            "Check your payment app or bank before retrying a pending charge.",
            "Keep your transaction reference when contacting support.",
            "Never share your UPI PIN, card PIN, OTP, or password."
        ]
    },
    "Fast Assistance": {
        intro: "Use this section when you want quick answers without browsing every help article.",
        points: [
            "Find the most common support topics quickly.",
            "Use search to highlight matching help cards.",
            "Open any card to see direct steps for that topic.",
            "Contact support from the drawer if you still need help."
        ]
    },
    "Secure Platform": {
        intro: "This section explains the privacy and safety systems that help keep VibeMatch protected.",
        points: [
            "Keep your account protected with secure sign-in habits.",
            "Use report and block options for unsafe interactions.",
            "Review privacy settings before sharing personal details.",
            "Follow community guidelines during video chats and messages."
        ]
    }
};

if (searchInput) {
    searchInput.addEventListener("input", function () {

        let searchValue = searchInput.value.trim().toLowerCase();

        document.querySelectorAll(".support-card").forEach(function (card) {

            let title =
                card.querySelector("h2").innerText.toLowerCase();

            let text =
                card.querySelector("p").innerText.toLowerCase();

            let isMatch =
                !searchValue ||
                title.includes(searchValue) ||
                text.includes(searchValue);

            card.classList.toggle("search-muted", !isMatch);
            card.classList.toggle("search-match", Boolean(searchValue) && isMatch);

        });

        libraryCategories.forEach(function(category){

            let hasMatch =
                !searchValue;

            category
            .querySelectorAll(".library-article")
            .forEach(function(article){

                let articleText =
                    article.innerText.toLowerCase();

                let summary =
                    (article.dataset.summary || "").toLowerCase();

                let categoryName =
                    (article.dataset.category || "").toLowerCase();

                let isMatch =
                    !searchValue ||
                    articleText.includes(searchValue) ||
                    summary.includes(searchValue) ||
                    categoryName.includes(searchValue);

                article.classList.toggle("is-hidden", !isMatch);

                if(isMatch){
                    hasMatch = true;
                }

            });

            category.classList.toggle("is-hidden", !hasMatch);
            category.classList.toggle("search-match", Boolean(searchValue) && hasMatch);

        });

    });
}

/* =========================
   CARD BUTTON ACTIONS
========================= */

document.addEventListener("click", function (e) {

    let libraryArticle =
        e.target.closest(".library-article");

    if (libraryArticle) {

        e.preventDefault();

        if (libraryArticle.innerText.trim() === "VibeMatch Community Guidelines") {
            window.location.href = "community-guidelines.html";
            return;
        }

        openLibraryArticle(libraryArticle);

        return;

    }

    let cardLink =
        e.target.closest(".support-card a");

    let supportCard =
        e.target.closest(".support-card");

    let miniBox =
        e.target.closest(".mini-box");

    if (cardLink) {

        let href =
            cardLink.getAttribute("href");

        if (href && href !== "#") {
            return;
        }

    }

    if (cardLink || supportCard) {

        e.preventDefault();

        let card =
            supportCard || cardLink.closest(".support-card");

        openTopicFromElement(card, "h2");

        return;

    }

    if (miniBox) {

        openTopicFromElement(miniBox, "h3");

    }

});

function openLibraryArticle(article) {

    let title =
        article.innerText.trim();

    let category =
        article.dataset.category || "Help";

    let summary =
        article.dataset.summary ||
        "This article explains the selected VibeMatch help topic.";

    let points =
        articleGuidance[category] || [
            "Review the guidance carefully.",
            "Follow the recommended steps in order.",
            "Contact support if the issue continues."
        ];

    showTopicPopup(title, {
        intro: summary,
        points: points
    });

}

function openTopicFromElement(element, titleSelector) {

    if (!element) {
        return;
    }

    let titleElement =
        element.querySelector(titleSelector);

    if (!titleElement) {
        return;
    }

    showTopicPopup(titleElement.innerText.trim());

}

/* =========================
   CONTACT SUPPORT BUTTON
========================= */

const supportButton =
    document.querySelector(".footer button");

if (supportButton) {
    supportButton.addEventListener("click", function () {

        showPopup();

    });
}

/* =========================
   POPUP CREATION
========================= */

function showPopup() {

    let existingPopup =
        document.querySelector(".support-popup");

    if (existingPopup) {
        return;
    }

    let popup =
        document.createElement("div");

    popup.classList.add("support-popup");

    popup.innerHTML = `

        <a href="index.html" class="popup-home-link" aria-label="Back" style="color:rgba(255,255,255,0.86);background:transparent;border:0;box-shadow:none;">
            <span class="back-sign" aria-hidden="true" style="color:rgba(255,255,255,0.86);">&lt;</span>
        </a>

        <div class="popup-box">

            <h2>Contact Support</h2>

            <p>
                Our support team usually responds
                within a few hours.
            </p>

            <input type="text"
            placeholder="Your email">

            <textarea
            placeholder="Describe your issue"></textarea>

            <button class="send-support">
                Send Request
            </button>

            <button class="close-popup">
                Close
            </button>

        </div>

    `;

    document.body.appendChild(popup);

    /* CLOSE BUTTON */

    popup
    .querySelector(".close-popup")
    .addEventListener("click", function () {

        popup.remove();

    });

    /* SEND BUTTON */

    popup
    .querySelector(".send-support")
    .addEventListener("click", function () {

        popup.remove();

        showNotification(
            "Support request submitted"
        );

    });

}

function showTopicPopup(title, customTopic) {

    let topic =
        customTopic ||
        helpTopics[title] || {

            intro:
            "This section contains detailed guidance and platform support.",

            points: [
                "Review the available support information.",
                "Follow the recommended steps carefully.",
                "Contact support if the issue continues."
            ]
        };

    let topicItems =
        topic.points.map(function(point, index){

            return `

                <div class="topic-item" tabindex="0" role="button" aria-expanded="false">

                    <div class="topic-line"></div>

                    <p>${point}</p>

                    <div class="topic-detail">
                        Step ${index + 1}: Follow this guidance, then refresh or reopen the related page if the issue still appears.
                    </div>

                </div>

            `;

        }).join("");

    let existingPopup =
        document.querySelector(".support-drawer");

    if(existingPopup){

        existingPopup.remove();

    }

    /* CREATE DRAWER */

    let drawer =
        document.createElement("div");

    drawer.classList.add("support-drawer");

    drawer.innerHTML = `

        <div class="drawer-overlay"></div>

        <div class="drawer-panel">

            <a href="index.html" class="popup-home-link" aria-label="Back" style="color:rgba(255,255,255,0.86);background:transparent;border:0;box-shadow:none;">
                <span class="back-sign" aria-hidden="true" style="color:rgba(255,255,255,0.86);">&lt;</span>
            </a>

            <!-- TOP -->

            <div class="drawer-top">

                <div>

                    <span class="drawer-tag">
                        Help Section
                    </span>

                    <h1>${title}</h1>

                </div>

                <button class="drawer-close" aria-label="Close help section">
                    ×
                </button>

            </div>

            <!-- BODY -->

            <div class="drawer-body">

                <div class="drawer-intro">

                    <p>
                        ${topic.intro}
                    </p>

                </div>

                <div class="topic-container">

                    ${topicItems}

                </div>

                <!-- SUPPORT BOX -->

                <div class="premium-support-box">

                    <div class="support-box-left">

                        <span>
                            Priority Support
                        </span>

                        <h3>
                            Need additional assistance?
                        </h3>

                        <p>
                            Contact the VibeMatch support team
                            for direct help and faster guidance.
                        </p>

                    </div>

                    <button class="premium-contact-btn">

                        Contact Support

                    </button>

                </div>

            </div>

        </div>

    `;

    document.body.appendChild(drawer);

    /* CLOSE */

    drawer
    .querySelector(".drawer-close")
    .addEventListener("click", function(){

        closeDrawer(drawer);

    });

    drawer
    .querySelector(".drawer-overlay")
    .addEventListener("click", function(){

        closeDrawer(drawer);

    });

    /* CONTACT BUTTON */

    drawer
    .querySelector(".premium-contact-btn")
    .addEventListener("click", function(){

        closeDrawer(drawer);

        showPopup();

    });

    drawer
    .querySelectorAll(".topic-item")
    .forEach(function(item){

        item.addEventListener("click", function(){

            toggleTopicItem(item);

        });

        item.addEventListener("keydown", function(e){

            if(e.key === "Enter" || e.key === " "){

                e.preventDefault();

                toggleTopicItem(item);

            }

        });

    });

}

function toggleTopicItem(item){

    let isOpen =
        item.classList.toggle("active");

    item.setAttribute("aria-expanded", String(isOpen));

}

/* CLOSE DRAWER */

function closeDrawer(drawer){

    drawer
    .querySelector(".drawer-panel")
    .classList.add("drawer-hide");

    setTimeout(function(){

        drawer.remove();

    },400);

}


/* =========================
   NOTIFICATION
========================= */

function showNotification(message) {

    let oldNotification =
        document.querySelector(".notification-box");

    if (oldNotification) {

        oldNotification.remove();

    }

    let notification =
        document.createElement("div");

    notification.classList.add("notification-box");

    notification.innerText = message;

    document.body.appendChild(notification);

    setTimeout(function () {

        notification.classList.add("show");

    }, 100);

    setTimeout(function () {

        notification.classList.remove("show");

        setTimeout(function () {

            notification.remove();

        }, 300);

    }, 2500);

}

/* =========================
   NAVBAR ACTIVE EFFECT
========================= */

const navLinks =
    document.querySelectorAll(".nav-links a");

navLinks.forEach(function (link) {

    link.addEventListener("click", function (e) {

        let action =
            this.dataset.helpNav;

        if (action === "support") {

            e.preventDefault();

            showPopup();

        }

        if (action === "safety") {

            e.preventDefault();

            showTopicPopup("Privacy & Safety");

        }

        navLinks.forEach(function (item) {

            item.classList.remove("active-link");

        });

        this.classList.add("active-link");

    });

});

/* =========================
   INPUT ENTER SUPPORT
========================= */

if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {

        if (e.key === "Enter") {

            showNotification(
                "Search results updated"
            );

        }

    });
}

/* =========================
   SMOOTH CARD ANIMATION
========================= */

function revealVisibleCards() {

    supportCards.forEach(function (card) {

        let cardTop =
            card.getBoundingClientRect().top;

        if (cardTop < window.innerHeight - 100) {

            card.style.opacity = "1";

            card.style.transform =
                "translateY(0px)";

        }

    });

}

window.addEventListener("scroll", revealVisibleCards);

/* INITIAL CARD STYLE */

supportCards.forEach(function (card) {

    card.style.opacity = "0";

    card.style.transform =
        "translateY(40px)";

    card.style.transition =
        "all 0.6s ease";

});

/* =========================
   PAGE LOAD EFFECT
========================= */

window.addEventListener("load", function () {

    document.body.classList.add("loaded");

    revealVisibleCards();

    if (window.location.hash === "#payments") {
        let paymentsSection = document.getElementById("payments");
        if (paymentsSection) {
            window.setTimeout(function () {
                paymentsSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
        }
    }

});

revealVisibleCards();
