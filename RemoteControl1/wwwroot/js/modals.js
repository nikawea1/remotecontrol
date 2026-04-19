//modals.js

function lockBodyScroll() {
    document.body.classList.add("modal-open");
}

function unlockBodyScroll() {
    const hasOpenedModal = document.querySelector(".modal.show");
    const hasOpenedProjectView = document.querySelector(".project-view-shell.show");

    if (hasOpenedModal || hasOpenedProjectView) {
        return;
    }

    document.body.classList.remove("modal-open");
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.display = "flex";

    requestAnimationFrame(() => {
        modal.classList.add("show");
    });

    lockBodyScroll();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove("show");
    modal.style.display = "none";

    unlockBodyScroll();
}

function closeAllModals() {
    document.querySelectorAll(".modal.show").forEach(modal => {
        modal.classList.remove("show");
        modal.style.display = "none";
    });

    document.querySelectorAll(".project-view-shell.show").forEach(modal => {
        modal.classList.remove("show");
    });

    document.querySelectorAll(".project-view-overlay.show").forEach(overlay => {
        overlay.classList.remove("show");
    });

    unlockBodyScroll();
}

document.addEventListener("click", function (event) {
    const modal = event.target.closest(".modal");
    if (modal && event.target === modal) {
        closeModal(modal.id);
        return;
    }

    const overlay = event.target.closest(".project-view-overlay");
    if (overlay && event.target === overlay) {
        if (typeof closeProjectViewModal === "function") {
            closeProjectViewModal();
        }
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeAllModals();
    }
});