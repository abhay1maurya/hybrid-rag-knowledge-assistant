// policies.js

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Sidebar Active Link Highlighting on Scroll
    const sections = document.querySelectorAll('.policy-section');
    const navLinks = document.querySelectorAll('.policy-sidebar nav a');

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px', // Adjusts when the section is considered "active"
        threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active class from all links
                navLinks.forEach(link => link.classList.remove('active'));
                
                // Add active class to the currently intersecting section
                const activeId = entry.target.getAttribute('id');
                const activeLink = document.querySelector(`.policy-sidebar nav a[href="#${activeId}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        sectionObserver.observe(section);
    });

    // 2. Smooth Scrolling for Sidebar Links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                // Offset for the sticky header
                const headerOffset = 100; 
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 3. Back to Top Button
    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // 4. Newsletter Form Mock Submission
    const newsletterForm = document.getElementById('newsletter-form');
    const subscribeMsg = document.getElementById('subscribe-msg');
    
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            if (emailInput.value) {
                newsletterForm.style.display = 'none';
                subscribeMsg.style.display = 'block';
                // Reset after 3 seconds
                setTimeout(() => {
                    emailInput.value = '';
                    newsletterForm.style.display = 'flex';
                    subscribeMsg.style.display = 'none';
                }, 3000);
            }
        });
    }
});