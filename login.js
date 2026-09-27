const authForm = document.getElementById("authForm");
const formTabs = document.querySelectorAll(".tab-btn");
const nameGroup = document.getElementById("nameGroup");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const formTitle = document.getElementById("formTitle");
const formSub = document.getElementById("formSub");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");
const togglePassword = document.getElementById("togglePassword");
const forgotLink = document.querySelector(".forgot-link");
const socialButtons = document.querySelectorAll(".social-btn");

const USERS_KEY = "vibematch_users";
const SESSION_KEY = "vibematch_current_user";
let authMode = "signup";
const params = new URLSearchParams(window.location.search);

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setMessage(message, type) {
    if (!formMessage) {
        return;
    }

    formMessage.textContent = message;
    formMessage.classList.remove("success", "error");
    formMessage.classList.add(type === "success" ? "success" : "error");
}

function clearMessage() {
    if (formMessage) {
        formMessage.textContent = "";
        formMessage.classList.remove("success", "error");
    }
}

function setAuthMode(mode) {
    authMode = mode === "signin" ? "signin" : "signup";
    const isSignup = authMode === "signup";

    formTabs.forEach(function (tab) {
        tab.classList.toggle("active", tab.dataset.mode === authMode);
    });

    if (nameGroup) {
        nameGroup.classList.toggle("hidden", !isSignup);
    }

    if (nameInput) {
        nameInput.required = isSignup;
    }

    if (passwordInput) {
        passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
    }

    if (formTitle) {
        formTitle.textContent = isSignup ? "Create account" : "Welcome back";
    }

    if (formSub) {
        formSub.textContent = isSignup
            ? "Join VibeMatch and start meeting new people."
            : "Sign in to continue your conversations.";
    }

    if (submitBtn) {
        submitBtn.innerHTML = isSignup
            ? '<i class="fas fa-user-plus"></i> Create account'
            : '<i class="fas fa-sign-in-alt"></i> Sign in';
    }

    clearMessage();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm() {
    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (authMode === "signup" && name.length < 2) {
        setMessage("Please enter your full name.", "error");
        nameInput.focus();
        return null;
    }

    if (!isValidEmail(email)) {
        setMessage("Please enter a valid email address.", "error");
        emailInput.focus();
        return null;
    }

    if (password.length < 6) {
        setMessage("Password must be at least 6 characters.", "error");
        passwordInput.focus();
        return null;
    }

    return { name, email, password };
}

function setLoading(isLoading) {
    if (!submitBtn) {
        return;
    }

    submitBtn.disabled = isLoading;
    submitBtn.innerHTML = isLoading
        ? '<i class="fas fa-spinner fa-spin"></i> Please wait'
        : authMode === "signup"
            ? '<i class="fas fa-user-plus"></i> Create account'
            : '<i class="fas fa-sign-in-alt"></i> Sign in';
}

function getSafeRedirectTarget() {
    const redirect = params.get("redirect") || "videochat.html";
    const cleaned = redirect.trim();

    if (!cleaned || /^https?:\/\//i.test(cleaned) || cleaned.startsWith("//") || cleaned.includes("\\")) {
        return "videochat.html";
    }

    return cleaned;
}

function finishAuth(user, message) {
    const session = {
        name: user.name,
        email: user.email,
        loggedInAt: new Date().toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_KEY);

    setMessage(message, "success");

    setTimeout(function () {
        window.location.href = getSafeRedirectTarget();
    }, 900);
}

function handleSignup(formData) {
    const users = getUsers();
    const existingUser = users.find(function (user) {
        return user.email === formData.email;
    });

    if (existingUser) {
        setAuthMode("signin");
        setMessage("This email is already registered. Please sign in.", "error");
        return;
    }

    const newUser = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);
    finishAuth(newUser, "Account created successfully. Redirecting...");
}

function handleSignin(formData) {
    const users = getUsers();
    const user = users.find(function (item) {
        return item.email === formData.email && item.password === formData.password;
    });

    if (!user) {
        setMessage("Email or password is incorrect.", "error");
        return;
    }

    finishAuth(user, "Signed in successfully. Redirecting...");
}

formTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
        setAuthMode(tab.dataset.mode);
    });
});

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const shouldShow = passwordInput.type === "password";
        passwordInput.type = shouldShow ? "text" : "password";
        togglePassword.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
        togglePassword.innerHTML = shouldShow
            ? '<i class="fas fa-eye-slash"></i>'
            : '<i class="fas fa-eye"></i>';
    });
}

if (authForm) {
    authForm.addEventListener("submit", function (event) {
        event.preventDefault();
        clearMessage();

        const formData = validateForm();

        if (!formData) {
            return;
        }

        setLoading(true);

        setTimeout(function () {
            if (authMode === "signup") {
                handleSignup(formData);
            } else {
                handleSignin(formData);
            }

            setLoading(false);
        }, 450);
    });
}

if (forgotLink) {
    forgotLink.addEventListener("click", function (event) {
        event.preventDefault();

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";

        if (!isValidEmail(email)) {
            setMessage("Enter your email first, then click forgot password.", "error");
            emailInput.focus();
            return;
        }

        const user = getUsers().find(function (item) {
            return item.email === email;
        });

        setMessage(
            user
                ? "Demo reset link generated. Use your saved password to sign in."
                : "No account found with this email.",
            user ? "success" : "error"
        );
    });
}

socialButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const provider = button.classList.contains("google-btn") ? "Google" : "Facebook";
        setMessage(provider + " login is ready for backend connection.", "success");
    });
});

if (emailInput) {
    emailInput.addEventListener("input", clearMessage);
}

if (passwordInput) {
    passwordInput.addEventListener("input", clearMessage);
}

if (nameInput) {
    nameInput.addEventListener("input", clearMessage);
}

setAuthMode(params.get("mode"));
