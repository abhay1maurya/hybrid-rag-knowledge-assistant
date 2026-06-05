// site.js
// Javascript logic for Hybrid RAG 

document.addEventListener('DOMContentLoaded', () => {
  // Navigation active state handling (optional enhancement)
  const navLinks = document.querySelectorAll('.nav-links a');
  const currentPath = window.location.pathname.split('/').pop();

  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
});