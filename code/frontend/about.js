document.addEventListener('DOMContentLoaded', () => {
    // Handle programmatic navigation based on data-href attribute
    const navigationElements = document.querySelectorAll('[data-href]');
    navigationElements.forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            const url = element.getAttribute('data-href');
            if (url) {
                window.location.href = url;
            }
        });
    });

    // Handle generic alerts based on data-alert attribute
    const alertElements = document.querySelectorAll('[data-alert]');
    alertElements.forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            const message = element.getAttribute('data-alert');
            if (message) {
                alert(message);
            }
        });
    });
});