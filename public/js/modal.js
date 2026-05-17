/* Results AI Announcement Modal and Carousel Logic */

document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('ask-ai-modal');
    if (!overlay) return;

    const closeBtn = overlay.querySelector('.modal-close-btn');
    const actionBtn = overlay.querySelector('.modal-action-btn');
    const dismissLink = overlay.querySelector('.modal-dismiss-link');
    const slides = overlay.querySelectorAll('.carousel-slide');
    const dots = overlay.querySelectorAll('.dot');
    const track = overlay.querySelector('.carousel-slides');
    const prevBtn = overlay.querySelector('.prev-btn');
    const nextBtn = overlay.querySelector('.next-btn');

    let currentIndex = 0;
    const totalSlides = slides.length;
    let autoSlideInterval;

    // --- Modal Display Logic ---
    function showModal() {
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        // Force reflow for transitions to trigger
        void overlay.offsetWidth;
        overlay.classList.add('active');
        startAutoSlide();
    }

    function closeModal() {
        overlay.classList.remove('active');
        sessionStorage.setItem('hasSeenAskAiModal', 'true');
        stopAutoSlide();

        // Hide overlay after animation finishes
        overlay.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'opacity') {
                overlay.classList.add('hidden');
                overlay.setAttribute('aria-hidden', 'true');
                overlay.removeEventListener('transitionend', handler);
            }
        });
    }

    // Check sessionStorage and show modal only once
    if (!sessionStorage.getItem('hasSeenAskAiModal')) {
        // Optional slight delay for polished page-load entrance
        setTimeout(showModal, 1000);
    }

    // Modal Close Event Listeners
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (actionBtn) actionBtn.addEventListener('click', function () {
        sessionStorage.setItem('hasSeenAskAiModal', 'true');
    });
    if (dismissLink) dismissLink.addEventListener('click', closeModal);

    // Close when clicking outside of the card
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            closeModal();
        }
    });

    // --- Carousel Controls Logic ---
    function updateCarousel(index) {
        // Handle wrap-around
        if (index >= totalSlides) index = 0;
        if (index < 0) index = totalSlides - 1;

        // Transition slide track
        if (track) {
            track.style.transform = `translateX(-${index * 100}%)`;
        }

        // Toggle active states
        slides.forEach((slide, i) => {
            if (i === index) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });

        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        currentIndex = index;
    }

    // Next/Prev Buttons
    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            stopAutoSlide(); // Stop auto-play once user interacts
            updateCarousel(currentIndex + 1);
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            stopAutoSlide(); // Stop auto-play once user interacts
            updateCarousel(currentIndex - 1);
        });
    }

    // Pagination Dots
    dots.forEach((dot, idx) => {
        dot.addEventListener('click', function () {
            stopAutoSlide(); // Stop auto-play once user interacts
            updateCarousel(idx);
        });
    });

    // --- Auto Slide Setup ---
    function startAutoSlide() {
        stopAutoSlide();
        autoSlideInterval = setInterval(function () {
            updateCarousel(currentIndex + 1);
        }, 2000); // Change slide every 2 seconds
    }

    function stopAutoSlide() {
        if (autoSlideInterval) {
            clearInterval(autoSlideInterval);
        }
    }
});