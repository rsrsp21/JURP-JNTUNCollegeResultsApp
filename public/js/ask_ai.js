function escapeChatHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, function(character) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[character];
    });
}

function formatChatAnswer(answer) {
    return escapeChatHTML(answer)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const messages = document.getElementById('ask-ai-messages');
    const input = document.getElementById('ask-ai-chat-input');
    const sendButton = document.getElementById('ask-ai-chat-send');
    const chips = document.querySelectorAll('.ask-ai-chat-chip');
    let activeStudentId = '';

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    if (!messages || !input || !sendButton) {
        return;
    }

    function addMessage(content, type) {
        const message = document.createElement('div');
        message.className = `ask-ai-chat-message ${type}`;
        message.innerHTML = type === 'user' ? escapeChatHTML(content) : `<p>${formatChatAnswer(content)}</p>`;
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
        return message;
    }

    async function sendChatMessage(messageText) {
        const message = (messageText || input.value || '').trim();
        if (!message) {
            return;
        }

        addMessage(message, 'user');
        input.value = '';
        sendButton.disabled = true;
        const loadingMessage = addMessage('Thinking with Gemini...', 'ai');

        try {
            const response = await fetch('/api/chat-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    activeStudentId
                })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'AI chat failed');
            }

            if (data.studentId) {
                activeStudentId = data.studentId;
            }

            loadingMessage.innerHTML = `<p>${formatChatAnswer(data.answer || 'I could not prepare an answer for that.')}</p>`;
        } catch (error) {
            loadingMessage.classList.add('error');
            loadingMessage.innerHTML = '<p>AI chat is unavailable right now. Check the Gemini API key in your environment variables and try again.</p>';
            console.warn('Ask AI chat error:', error);
        } finally {
            sendButton.disabled = false;
            input.focus();
        }
    }

    sendButton.addEventListener('click', function() {
        sendChatMessage();
    });

    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendChatMessage();
        }
    });

    chips.forEach(function(chip) {
        chip.addEventListener('click', function() {
            sendChatMessage(chip.dataset.message);
        });
    });
});
