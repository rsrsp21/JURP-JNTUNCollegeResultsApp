/* ------------------------------------------------------------------ */
/*  Ask AI — chat logic                                                 */
/* ------------------------------------------------------------------ */

function escapeChatHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
    });
}

function formatChatAnswer(answer) {
    if (typeof marked !== 'undefined') {
        return marked.parse(answer);
    }
    return '<p>' + escapeChatHTML(answer)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>') + '</p>';
}

function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

document.addEventListener('DOMContentLoaded', function () {

    /* --- Nav toggle --- */
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu   = document.querySelector('.nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => navMenu.classList.toggle('active'));
    }

    /* --- Welcome message timestamp --- */
    const welcomeTime = document.getElementById('welcome-time');
    if (welcomeTime) welcomeTime.textContent = getTime();
    const aiStatus = document.querySelector('.chat-ai-status');
    if (aiStatus) aiStatus.textContent = 'Powered by Gemini';
    const welcomeBubble = document.querySelector('.chat-messages-window .ai-bubble');
    if (welcomeBubble) {
        welcomeBubble.innerHTML = [
            "<p>Hi! I'm your <strong>Results AI</strong>.</p>",
            '<p>I can help you check CGPA, SGPA, grades, credits, and backlogs, compare two students by roll number, find best semester and toppers, guide downloads, and share academic improvement tips.</p>',
            '<p><strong>What would you like to know?</strong></p>'
        ].join('');
    }

    /* --- Core elements --- */
    const messagesArea  = document.getElementById('ask-ai-messages');
    const textarea      = document.getElementById('ask-ai-chat-input');
    const sendBtn       = document.getElementById('ask-ai-chat-send');
    const suggestions   = document.getElementById('chat-suggestions');
    const suggestionsToggle = document.getElementById('chat-suggestions-toggle');
    const clearBtn      = document.getElementById('chat-clear-btn');
    const chips         = document.querySelectorAll('.chat-chip:not(.chat-suggestions-toggle)');

    if (!messagesArea || !textarea || !sendBtn) return;

    let activeStudentId = '';
    let chatHistory     = [];
    let hasAskedFirstQuestion = false;

    function collapseSuggestions() {
        if (!suggestions || !suggestionsToggle) return;
        suggestions.classList.add('is-collapsed');
        suggestionsToggle.setAttribute('aria-expanded', 'false');
    }

    function expandSuggestions() {
        if (!suggestions || !suggestionsToggle) return;
        suggestions.classList.remove('is-collapsed');
        suggestionsToggle.setAttribute('aria-expanded', 'true');
    }

    /* --- Auto-grow textarea --- */
    textarea.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });

    /* ----------------------------------------------------------------
       addMessage — appends a chat row to the messages area
    ----------------------------------------------------------------- */
    function addMessage(content, type) {
        const row = document.createElement('div');
        row.className = `chat-row ${type === 'user' ? 'user-row' : 'ai-row'}`;

        const avatar = document.createElement('div');
        avatar.className = `chat-avatar ${type === 'user' ? 'user-avatar' : 'ai-avatar'}`;
        avatar.innerHTML = type === 'user'
            ? '<span>You</span>'
            : '<i class="fas fa-wand-magic-sparkles"></i>';

        const bubbleWrap = document.createElement('div');
        bubbleWrap.className = 'chat-bubble-wrap';

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${type === 'user' ? 'user-bubble' : 'ai-bubble'}${type === 'error' ? ' error-bubble' : ''}`;

        if (type === 'user') {
            bubble.innerHTML = `<p>${escapeChatHTML(content)}</p>`;
        } else if (type === 'typing') {
            bubble.classList.add('typing-bubble');
            bubble.innerHTML = `
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>`;
        } else {
            bubble.innerHTML = formatChatAnswer(content);
        }

        const time = document.createElement('span');
        time.className = 'chat-time';
        time.textContent = getTime();

        bubbleWrap.appendChild(bubble);
        bubbleWrap.appendChild(time);

        row.appendChild(avatar);
        row.appendChild(bubbleWrap);

        messagesArea.appendChild(row);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        return bubble; // return bubble so caller can swap content later
    }

    /* ----------------------------------------------------------------
       sendChatMessage
    ----------------------------------------------------------------- */
    async function sendChatMessage(messageText) {
        const message = (messageText || textarea.value || '').trim();
        if (!message) return;

        addMessage(message, 'user');
        if (!hasAskedFirstQuestion) {
            hasAskedFirstQuestion = true;
            collapseSuggestions();
        }

        textarea.value = '';
        textarea.style.height = 'auto';
        sendBtn.disabled = true;

        // Typing indicator
        const typingBubble = addMessage('', 'typing');

        try {
            const response = await fetch('/api/chat-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, activeStudentId, history: chatHistory })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'AI chat failed');

            if (data.studentId) activeStudentId = data.studentId;

            const answer = data.answer || 'I could not prepare an answer for that.';

            // Replace typing indicator with actual answer
            typingBubble.classList.remove('typing-bubble');
            typingBubble.innerHTML = formatChatAnswer(answer);
            messagesArea.scrollTop = messagesArea.scrollHeight;

            // Multi-turn history (cap at 8 turns = 16 entries)
            chatHistory.push({ role: 'user',  text: message });
            chatHistory.push({ role: 'model', text: answer  });
            if (chatHistory.length > 16) {
                chatHistory.splice(0, 2);
            }

        } catch (error) {
            typingBubble.classList.remove('typing-bubble');
            typingBubble.classList.add('error-bubble');
            typingBubble.innerHTML = `<p>${error.message || 'Results AI is offline. Please try again shortly.'}</p>`;
            messagesArea.scrollTop = messagesArea.scrollHeight;
            console.warn('Ask AI error:', error);
        } finally {
            sendBtn.disabled = false;
            textarea.focus();
        }
    }

    /* ----------------------------------------------------------------
       Events — send
    ----------------------------------------------------------------- */
    sendBtn.addEventListener('click', () => sendChatMessage());

    textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    /* ----------------------------------------------------------------
       Clear chat
    ----------------------------------------------------------------- */
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            // Remove everything except the first welcome row
            const rows = messagesArea.querySelectorAll('.chat-row');
            rows.forEach((row, i) => { if (i > 0) row.remove(); });

            chatHistory      = [];
            activeStudentId  = '';
            hasAskedFirstQuestion = false;

            if (suggestions) {
                suggestions.classList.remove('hidden', 'is-collapsed');
            }
            if (suggestionsToggle) suggestionsToggle.setAttribute('aria-expanded', 'false');
            textarea.focus();
        });
    }

    /* ----------------------------------------------------------------
       Roll Number Prompt Modal
    ----------------------------------------------------------------- */
    const rollModal   = document.getElementById('roll-prompt-modal');
    const rollInput   = document.getElementById('roll-prompt-input');
    const rollSubmit  = document.getElementById('roll-prompt-submit');
    const rollCancel  = document.getElementById('roll-prompt-cancel');
    const rollError   = document.getElementById('roll-prompt-error');
    let pendingCallback = null;

    function openRollModal(cb) {
        if (!rollModal) return;
        pendingCallback = cb;
        rollInput.value = '';
        if (rollError) rollError.classList.add('hidden');
        rollModal.classList.remove('hidden');
        void rollModal.offsetWidth;
        rollModal.classList.add('active');
        rollInput.focus();
    }

    function closeRollModal() {
        if (!rollModal) return;
        rollModal.classList.remove('active');
        rollModal.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'opacity') {
                rollModal.classList.add('hidden');
                rollModal.removeEventListener('transitionend', handler);
            }
        });
        pendingCallback = null;
    }

    function submitRollValue() {
        const val = (rollInput.value || '').trim().toUpperCase();
        const isValid = val.length === 10 && /^[0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4}$/i.test(val);
        if (!isValid) {
            if (rollError) rollError.classList.remove('hidden');
            rollInput.focus();
            return;
        }
        if (pendingCallback) pendingCallback(val);
        closeRollModal();
    }

    if (rollCancel)  rollCancel.addEventListener('click', closeRollModal);
    if (rollModal)   rollModal.addEventListener('click', e => { if (e.target === rollModal) closeRollModal(); });
    if (rollSubmit)  rollSubmit.addEventListener('click', submitRollValue);
    if (rollInput)   rollInput.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); submitRollValue(); } });

    /* ----------------------------------------------------------------
       Suggestion Chips
    ----------------------------------------------------------------- */
    if (suggestionsToggle) {
        suggestionsToggle.addEventListener('click', function () {
            expandSuggestions();
        });
    }

    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            const msg = chip.dataset.message;

            if (chip.classList.contains('compare-chip')) {
                textarea.value = 'Compare ROLL1 and ROLL2';
                textarea.dispatchEvent(new Event('input'));
                textarea.focus();
                textarea.select();
                if (hasAskedFirstQuestion) collapseSuggestions();
                return;
            }

            if (chip.textContent.toLowerCase().includes('roll number')) {
                if (hasAskedFirstQuestion) collapseSuggestions();
                openRollModal(rollNumber => sendChatMessage(`What is the CGPA of ${rollNumber}?`));
                return;
            }

            if (hasAskedFirstQuestion) collapseSuggestions();
            sendChatMessage(msg);
        });
    });
});
