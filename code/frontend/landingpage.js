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

    // FAQ Accordion Logic
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            question.classList.toggle('active');
            const answer = question.nextElementSibling;
            if (question.classList.contains('active')) {
                answer.style.maxHeight = answer.scrollHeight + 'px';
            } else {
                answer.style.maxHeight = 0;
            }
        });
    });
});

function triggerDemoChat(userText) {
    const chatWindow = document.getElementById('chat-window');
    const buttons = document.querySelectorAll('.demo-prompt-btn');
    buttons.forEach(btn => btn.disabled = true);

    const userMsgHTML = `
        <div class="message user-message fade-in-up">
            <div class="avatar"><span class="material-symbols-outlined">person</span></div>
            <div class="bubble">${userText}</div>
        </div>
    `;
    chatWindow.insertAdjacentHTML('beforeend', userMsgHTML);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    setTimeout(() => {
        let aiResponse = '';
        if (userText.includes('methodology')) {
            aiResponse = 'Based on the embedded document, the methodology used a mixed-methods approach with qualitative review and structured data extraction.';
        } else {
            aiResponse = 'The key findings show a strong accuracy gain and improved privacy when using local offline inference for sensitive documents.';
        }

        const aiMsgHTML = `
            <div class="message ai-message fade-in-up">
                <div class="avatar"><span class="material-symbols-outlined">smart_toy</span></div>
                <div class="bubble">${aiResponse}</div>
            </div>
        `;
        chatWindow.insertAdjacentHTML('beforeend', aiMsgHTML);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        buttons.forEach(btn => btn.disabled = false);
    }, 1200);
}
// Newsletter form submission interaction
    const newsletterForm = document.getElementById('newsletter-form');
    const subscribeMsg = document.getElementById('subscribe-msg');
    
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent page reload
            newsletterForm.style.display = 'none'; // Hide form
            subscribeMsg.style.display = 'block'; // Show success message
        });
    }

    // Back to Top functionality
    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
