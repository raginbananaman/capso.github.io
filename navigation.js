// navigation.js
// This script fetches and injects the shared navigation, then highlights the active page.
// It now dispatches a custom event to signal when it's finished.

document.addEventListener("DOMContentLoaded", function() {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) {
        console.error("Critical Error: Navigation placeholder div not found!");
        return;
    }

    fetch('nav.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(html => {
            navPlaceholder.innerHTML = html;
            highlightActiveLink();

            // This is the key change:
            // Announce that the navigation has been successfully loaded.
            // Other scripts can now listen for this event.
            document.dispatchEvent(new CustomEvent('navigationLoaded'));
            console.log("Navigation loaded and 'navigationLoaded' event dispatched.");
        })
        .catch(error => {
            console.error('Failed to load navigation:', error);
            navPlaceholder.innerHTML = '<p style="color:red; text-align:center;">Error: Could not load navigation menu.</p>';
        });
});

function highlightActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    // The navigation is now inside the placeholder, so we query within it.
    const navLinks = document.querySelectorAll('#nav-placeholder nav a.nav-link');

    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}
