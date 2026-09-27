const featureDetails = {
  "HD Video Calls": {
    icon: "fa-video",
    text: "High-quality video chat experience for smooth conversations on desktop and mobile.",
  },
  "Private & Safe": {
    icon: "fa-shield-halved",
    text: "Safety focused controls help users report issues and keep conversations more comfortable.",
  },
  "Instant Matching": {
    icon: "fa-bolt",
    text: "Fast matching helps users start a new chat without waiting through a complicated setup.",
  },
  "Global Community": {
    icon: "fa-globe",
    text: "Connect with people from different countries and discover new cultures in real time.",
  },
  "Live Messaging": {
    icon: "fa-comments",
    text: "Text chat keeps the conversation moving while users stay connected on video.",
  },
  "Mobile Friendly": {
    icon: "fa-mobile-screen-button",
    text: "The layout is designed to stay clean and easy to use on smaller screens.",
  },
};

const revealItems = document.querySelectorAll(
  ".hero-content, .section-heading, .feature-box, .stats-box, .premium-left, .closing-line"
);

revealItems.forEach(function (item) {
  item.classList.add("about-reveal");
});

const revealObserver = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.15,
  }
);

revealItems.forEach(function (item) {
  revealObserver.observe(item);
});

const statsObserver = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateStat(entry.target.querySelector("h2"));
        statsObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.35,
  }
);

document.querySelectorAll(".stats-box").forEach(function (box) {
  statsObserver.observe(box);
});

function getStatParts(text) {
  const match = text.trim().match(/^(\d+)([MK])?(\+|\/7)?$/i);

  if (!match) {
    return null;
  }

  const base = Number(match[1]);
  const multiplier = match[2] && match[2].toUpperCase() === "M" ? 1000000 : match[2] && match[2].toUpperCase() === "K" ? 1000 : 1;

  return {
    target: base * multiplier,
    suffix: match[3] || "",
    compact: match[2] ? match[2].toUpperCase() : "",
    finalText: text.trim(),
  };
}

function formatStat(value, parts) {
  if (parts.compact === "M") {
    return Math.max(1, Math.round(value / 1000000)) + "M" + parts.suffix;
  }

  if (parts.compact === "K") {
    return Math.max(1, Math.round(value / 1000)) + "K" + parts.suffix;
  }

  return Math.round(value).toLocaleString() + parts.suffix;
}

function animateStat(statElement) {
  if (!statElement) {
    return;
  }

  const parts = getStatParts(statElement.textContent);

  if (!parts || parts.suffix === "/7") {
    statElement.classList.add("stat-ready");
    return;
  }

  const duration = 1400;
  const startTime = performance.now();

  function updateCounter(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    statElement.textContent = formatStat(parts.target * easedProgress, parts);

    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      statElement.textContent = parts.finalText;
      statElement.classList.add("stat-ready");
    }
  }

  requestAnimationFrame(updateCounter);
}

function openFeatureBox(box) {
  const title = box.querySelector("h3");

  if (!title) {
    return;
  }

  showFeaturePopup(title.textContent.trim());
}

document.querySelectorAll(".feature-box").forEach(function (box) {
  box.setAttribute("tabindex", "0");
  box.setAttribute("role", "button");
});

document.addEventListener("click", function (event) {
  const box = event.target.closest(".feature-box");

  if (box) {
    openFeatureBox(box);
  }
});

document.addEventListener("keydown", function (event) {
  const box = event.target.closest(".feature-box");

  if (box) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFeatureBox(box);
    }
  }
});

function showFeaturePopup(title) {
  const detail = featureDetails[title];

  if (!detail) {
    return;
  }

  const existingPopup = document.querySelector(".about-detail-modal");

  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement("div");
  popup.className = "about-detail-modal";
  popup.innerHTML = `
    <div class="about-detail-box">
      <button class="about-detail-back" type="button" aria-label="Back">
        <span aria-hidden="true">&lt;</span>
      </button>
      <i class="fas ${detail.icon} about-detail-icon"></i>
      <h3>${title}</h3>
      <p>${detail.text}</p>
      <a href="videochat.html" class="about-detail-action">Try this feature</a>
    </div>
  `;

  document.body.appendChild(popup);

  popup.addEventListener("click", function (event) {
    if (event.target === popup || event.target.closest(".about-detail-back")) {
      popup.remove();
    }
  });
}

document.querySelectorAll(".premium-left li").forEach(function (item) {
  item.addEventListener("click", function () {
    document.querySelectorAll(".premium-left li").forEach(function (listItem) {
      listItem.classList.remove("active");
    });

    item.classList.add("active");
  });
});

document.querySelectorAll(".primary-btn, .secondary-btn").forEach(function (button) {
  button.addEventListener("click", function () {
    button.classList.add("button-pressed");

    setTimeout(function () {
      button.classList.remove("button-pressed");
    }, 160);
  });
});

document.querySelectorAll(".floating-card").forEach(function (card, index) {
  card.style.animation = "float 4s ease-in-out infinite";
  card.style.animationDelay = index * 0.35 + "s";
});
