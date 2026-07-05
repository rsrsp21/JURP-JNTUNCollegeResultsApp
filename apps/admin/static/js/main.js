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

// Dynamic Notifications loading
document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/notifications')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                // 1. Update all page-header blinking notes with the 1st notification
                const blinkingNotes = document.querySelectorAll('.blinking-note.text-center');
                blinkingNotes.forEach(note => {
                    note.textContent = data[0].text;
                });

                // 2. Render top 5 in notification card (if present)
                const notificationsCard = document.querySelector('.notifications-section .notification-card');
                if (notificationsCard) {
                    notificationsCard.innerHTML = '';
                    data.slice(0, 5).forEach((item, index) => {
                        const p = document.createElement('p');
                        // Use textContent to prevent XSS, but preserve spacing
                        p.textContent = item.text + ' ';
                        
                        if (item.is_new) {
                            const newBadge = document.createElement('span');
                            newBadge.className = 'blinking-note';
                            newBadge.textContent = 'New!';
                            p.appendChild(newBadge);
                        }

                        if (item.date) {
                            const dateSpan = document.createElement('span');
                            dateSpan.className = 'notification-date';
                            dateSpan.textContent = ' ' + item.date;
                            p.appendChild(dateSpan);
                        }
                        notificationsCard.appendChild(p);
                    });
                }
            }
        })
        .catch(err => console.error('Error fetching notifications:', err));
});

