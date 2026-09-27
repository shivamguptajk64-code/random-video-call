document.addEventListener("DOMContentLoaded", function () {
    const feedback = document.querySelector(".guideline-feedback");

    if (!feedback) {
        return;
    }

    const choices = feedback.querySelectorAll(".feedback-choice");
    const message = feedback.querySelector(".feedback-message");
    const form = feedback.querySelector(".feedback-form");
    const textarea = feedback.querySelector("textarea");

    function selectChoice(button) {
        choices.forEach(function (choice) {
            choice.classList.remove("is-selected");
        });

        button.classList.add("is-selected");
    }

    choices.forEach(function (button) {
        button.addEventListener("click", function () {
            selectChoice(button);

            if (button.dataset.feedback === "yes") {
                form.hidden = true;
                textarea.value = "";
                message.textContent = "Thanks for your feedback. It helps us keep VibeMatch safer.";
                return;
            }

            form.hidden = false;
            message.textContent = "Tell us what was missing or confusing.";
            textarea.focus();
        });
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!textarea.value.trim()) {
            message.textContent = "Please write a short issue before sending.";
            textarea.focus();
            return;
        }

        textarea.value = "";
        form.hidden = true;
        message.textContent = "Thanks, your feedback was sent. We will use it to improve these guidelines.";
    });
});
