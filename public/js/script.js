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