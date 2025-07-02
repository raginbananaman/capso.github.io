// navigation.js
document.addEventListener("DOMContentLoaded", function() {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) {
        console.error("Critical Error: Navigation placeholder div not found!");
        return;
    }

    // THE FIX IS HERE: Appending a timestamp forces the browser to fetch a fresh file, bypassing the cache.
    const cacheBustingUrl = `nav.html?v=${new Date().getTime()}`;

    fetch(cacheBustingUrl)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(html => {
            navPlaceholder.innerHTML = html;
            highlightActiveLink();

            // --- NEW MOBILE MENU LOGIC ---
            const mobileMenuButton = document.getElementById('mobile-menu-button');
            const mobileMenu = document.getElementById('mobile-menu');
            const hamburgerIcon = document.getElementById('hamburger-icon');
            const closeIcon = document.getElementById('close-icon');

            if (mobileMenuButton && mobileMenu && hamburgerIcon && closeIcon) {
                mobileMenuButton.addEventListener('click', () => {
                    mobileMenu.classList.toggle('hidden');
                    hamburgerIcon.classList.toggle('hidden');
                    closeIcon.classList.toggle('hidden');
                });
            }
            // --- END NEW LOGIC ---

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
    
    // Highlight desktop links
    const navLinks = document.querySelectorAll('nav a.nav-link');
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });

    // Highlight mobile links
    const mobileNavLinks = document.querySelectorAll('#mobile-menu a.nav-link-mobile');
    mobileNavLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}
