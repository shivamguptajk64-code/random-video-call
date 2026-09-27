(function () {
    const pauseTime = 2600;

    function makeCloneReady(clone) {
        clone.classList.add("auto-carousel-clone");
        clone.setAttribute("aria-hidden", "true");

        if (clone.matches("a, button, input, textarea, select, [tabindex]")) {
            clone.setAttribute("tabindex", "-1");
        }

        clone.querySelectorAll("a, button, input, textarea, select, [tabindex]").forEach(function (item) {
            item.setAttribute("tabindex", "-1");
        });
    }

    function pauseThenResume(container) {
        container.classList.add("is-paused");
        window.clearTimeout(container.autoCarouselTimer);

        container.autoCarouselTimer = window.setTimeout(function () {
            container.classList.remove("is-paused");
        }, pauseTime);
    }

    function setupCarousel(container) {
        if (container.dataset.carouselReady === "true") {
            return;
        }

        const slides = Array.from(container.children);

        if (!slides.length) {
            return;
        }

        const track = document.createElement("div");
        track.className = "auto-carousel-track";

        slides.forEach(function (slide) {
            track.appendChild(slide);
        });

        container.appendChild(track);
        container.dataset.carouselReady = "true";

        function fillTrack() {
            const originalWidth = track.scrollWidth;
            const trackStyle = window.getComputedStyle(track);
            const trackGap = parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
            const cycleWidth = originalWidth + trackGap;

            if (!originalWidth) {
                return;
            }

            container.style.setProperty("--carousel-shift", cycleWidth + "px");

            while (track.scrollWidth < container.clientWidth + cycleWidth * 2) {
                slides.forEach(function (slide) {
                    const clone = slide.cloneNode(true);
                    makeCloneReady(clone);
                    track.appendChild(clone);
                });
            }
        }

        fillTrack();

        container.addEventListener("click", function () {
            pauseThenResume(container);
        });

        container.addEventListener("pointerdown", function () {
            pauseThenResume(container);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("[data-auto-carousel]").forEach(setupCarousel);
    });
})();
