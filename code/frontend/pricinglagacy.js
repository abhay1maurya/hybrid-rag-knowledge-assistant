document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Generic Button Alerts
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            alert(`Action Triggered: ${e.target.innerText.trim()}`);
        });
    });

    // 2. Pricing Toggle Logic (Monthly vs Yearly)
    const pricingToggle = document.getElementById('pricing-toggle');
    const toggleCircle = document.getElementById('toggle-circle');
    const pricePro = document.getElementById('price-pro');
    const periodPro = document.getElementById('period-pro');
    const periodStarter = document.getElementById('period-starter');
    
    // Labels to change color to show active state
    const labelMonthly = document.getElementById('label-monthly');
    const labelYearly = document.getElementById('label-yearly');

    let isYearly = false; // Initial State is Monthly

    pricingToggle.addEventListener('click', () => {
        isYearly = !isYearly;
        
        if (isYearly) {
            // Switch to Yearly Visuals
            toggleCircle.classList.add('toggled');
            
            // Toggle label classes
            labelMonthly.classList.remove('active');
            labelYearly.classList.add('active');
            
            // Switch Text
            pricePro.innerText = '₹14,390'; // ₹29 * 12 * 0.8 (20% off) -> Used your existing numbers
            periodPro.innerText = '/year';
            periodStarter.innerText = '/year';
        } else {
            // Switch to Monthly Visuals
            toggleCircle.classList.remove('toggled');
            
            // Toggle label classes
            labelMonthly.classList.add('active');
            labelYearly.classList.remove('active');
            
            // Switch Text
            pricePro.innerText = '₹1499';
            periodPro.innerText = '/month';
            periodStarter.innerText = '/month';
        }
    });

    // 3. FAQ Accordion Logic
    const faqToggles = document.querySelectorAll('.faq-toggle');
    
    faqToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const content = toggle.nextElementSibling;
            const icon = toggle.querySelector('.faq-icon');
            
            // Toggle the hidden class on the paragraph (defined in our custom CSS)
            content.classList.toggle('hidden');
            
            // Animate the chevron icon (defined in our custom CSS)
            if (content.classList.contains('hidden')) {
                icon.classList.remove('rotate-180');
            } else {
                icon.classList.add('rotate-180');
            }
        });
    });
});