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
    if (typeof marked !== 'undefined') {
        // Parse markdown to HTML using marked.js
        return marked.parse(answer);
    }
    // Safe fallback if marked.js is not loaded
    return '<p>' + escapeChatHTML(answer)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>') + '</p>';
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
        message.innerHTML = type === 'user' ? `<p>${escapeChatHTML(content)}</p>` : formatChatAnswer(content);
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

            loadingMessage.innerHTML = formatChatAnswer(data.answer || 'I could not prepare an answer for that.');
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

    // --- Simple Roll Prompt Modal Logic ---
    const rollPromptModal = document.getElementById('roll-prompt-modal');
    const rollPromptInput = document.getElementById('roll-prompt-input');
    const rollPromptSubmit = document.getElementById('roll-prompt-submit');
    const rollPromptCancel = document.getElementById('roll-prompt-cancel');
    const rollPromptError = document.getElementById('roll-prompt-error');
    let pendingCallback = null;

    function openRollModal(callback) {
        if (!rollPromptModal) return;
        pendingCallback = callback;
        rollPromptInput.value = '';
        if (rollPromptError) rollPromptError.classList.add('hidden');
        
        rollPromptModal.classList.remove('hidden');
        void rollPromptModal.offsetWidth; // force reflow
        rollPromptModal.classList.add('active');
        rollPromptInput.focus();
    }

    function closeRollModal() {
        if (!rollPromptModal) return;
        rollPromptModal.classList.remove('active');
        rollPromptModal.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'opacity') {
                rollPromptModal.classList.add('hidden');
                rollPromptModal.removeEventListener('transitionend', handler);
            }
        });
        pendingCallback = null;
    }

    if (rollPromptCancel) rollPromptCancel.addEventListener('click', closeRollModal);
    if (rollPromptModal) {
        rollPromptModal.addEventListener('click', function(e) {
            if (e.target === rollPromptModal) {
                closeRollModal();
            }
        });
    }

    function submitRollValue() {
        const val = (rollPromptInput.value || '').trim().toUpperCase();
        // Validation: exactly 10 characters conforming to JNTU pattern
        const isValid = val.length === 10 && /^[0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4}$/i.test(val);
        
        if (!isValid) {
            if (rollPromptError) rollPromptError.classList.remove('hidden');
            rollPromptInput.focus();
            return;
        }
        
        if (pendingCallback) pendingCallback(val);
        closeRollModal();
    }

    if (rollPromptSubmit) rollPromptSubmit.addEventListener('click', submitRollValue);
    if (rollPromptInput) {
        rollPromptInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitRollValue();
            }
        });
    }

    chips.forEach(function(chip) {
        chip.addEventListener('click', function() {
            let message = chip.dataset.message;
            if (chip.textContent.toLowerCase().includes('roll number')) {
                openRollModal(function(rollNumber) {
                    sendChatMessage(`What is the CGPA of ${rollNumber}?`);
                });
            } else {
                sendChatMessage(message);
            }
        });
    });
});
