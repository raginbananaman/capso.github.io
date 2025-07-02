// navigation.js
// This script fetches and injects the shared navigation, then highlights the active page.

document.addEventListener("DOMContentLoaded", function() {
    // The element where the navigation will be placed.
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) {
        console.error("Critical Error: Navigation placeholder div not found!");
        return;
    }

    // Fetch the navigation HTML from the external file.
    fetch('nav.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.text();
        })
        .then(html => {
            // Inject the fetched HTML into the placeholder.
            navPlaceholder.innerHTML = html;
            // After loading, highlight the correct link.
            highlightActiveLink();
        })
        .catch(error => {
            console.error('Failed to load navigation:', error);
            navPlaceholder.innerHTML = '<p style="color:red;">Error: Could not load navigation menu.</p>';
        });
});

/**
 * Finds the current page's link in the navigation and adds an 'active' class to it.
 */
function highlightActiveLink() {
    // Get the filename of the current page (e.g., "index.html").
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Get all the links within the navigation.
    const navLinks = document.querySelectorAll('nav a.nav-link');

    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        // If the link's href matches the current page, add the 'active' class.
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}
