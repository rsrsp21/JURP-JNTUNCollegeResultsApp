// Wait for DOM to be fully loaded

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navToggle.contains(event.target) && !navMenu.contains(event.target)) {
                navMenu.classList.remove('active');
            }
        });

        // Close menu when clicking a link
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
            });
        });
    }
});

// Feature Tabs Functionality
document.addEventListener('DOMContentLoaded', function() {
    const featureTabs = document.querySelectorAll('.feature-tab');
    const featureContents = document.querySelectorAll('.feature-content');

    featureTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            featureTabs.forEach(t => t.classList.remove('active'));
            featureContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
});

// Features Carousel Functionality
document.addEventListener('DOMContentLoaded', function() {
    const track = document.querySelector('.features-track');
    const cards = document.querySelectorAll('.feature-card');
    const indicators = document.querySelectorAll('.indicator');
    let currentIndex = 0;
    const totalCards = cards.length;

    // Initialize first card
    cards[0].classList.add('active');
    indicators[0].classList.add('active');

    // Function to move to next card
    function moveToNext() {
        cards[currentIndex].classList.remove('active');
        indicators[currentIndex].classList.remove('active');
        
        currentIndex = (currentIndex + 1) % totalCards;
        
        cards[currentIndex].classList.add('active');
        indicators[currentIndex].classList.add('active');
        
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    // Set up automatic rotation
    setInterval(moveToNext, 5000); // Change slide every 5 seconds

    // Add click handlers for indicators
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            cards[currentIndex].classList.remove('active');
            indicators[currentIndex].classList.remove('active');
            
            currentIndex = index;
            
            cards[currentIndex].classList.add('active');
            indicators[currentIndex].classList.add('active');
            
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
        });
    });
});

// Navigation bar scroll behavior
document.addEventListener('DOMContentLoaded', function() {
    const navbar = document.querySelector('.navigation-bar');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;

        // Add scrolled class when scrolling down
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });
});
