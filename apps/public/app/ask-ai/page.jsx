'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import UiIcon from '@/components/UiIcon';
import { isValidRollNumber, normalizeRollNumber } from '@/lib/client-utils';
import { useApp } from '@/components/AppContext';

const suggestions = [
  { type: 'send', icon: 'alert', message: 'Do I have any backlogs?', label: 'Do I have any backlogs?' },
  { type: 'send', icon: 'trend', message: 'Which semester did I perform the best?', label: 'Best performing semester' },
  { type: 'roll', icon: 'userSearch', label: 'Ask by roll number' },
  { type: 'compare', icon: 'compare', label: 'Compare students' },
  { type: 'send', icon: 'sparkles', message: 'How can I improve my academic performance?', label: 'Improve performance' },
  { type: 'send', icon: 'user', message: 'How do I add my name and email for result updates?', label: 'Add name & email' },
  { type: 'send', icon: 'download', message: 'How do I download my result PDF?', label: 'Download help' },
  { type: 'send', icon: 'bell', message: 'What results were recently released?', label: 'Latest results' }
];

function isNameEmailQuestion(message = '') {
  const text = message.toLowerCase();
  const mentionsFeature = /\b(name|email|id card|idcard)\b/.test(text);
  const mentionsIntent = /\b(add|verify|verified|upload|change|update|updates|register|set|fix|approve|approval|remove|how)\b/.test(text);
  return mentionsFeature && mentionsIntent;
}

export default function AskAiPage() {
  const {
    messages,
    setMessages,
    askAiInput: input,
    setAskAiInput: setInput,
    activeStudentId,
    setActiveStudentId
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rollPrompt, setRollPrompt] = useState(null);
  const [rollOne, setRollOne] = useState('');
  const [rollTwo, setRollTwo] = useState('');
  const [promptError, setPromptError] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const messagesRef = useRef(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(value = input) {
    const message = value.trim();
    if (!message || loading) return;

    const history = messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .slice(-16)
      .map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', text: item.text }));

    setMessages((current) => [...current, { role: 'user', text: message }]);
    setInput('');
    setSuggestionsOpen(false);
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/chat-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, activeStudentId, history })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Results AI is unavailable.');
      if (data.studentId) setActiveStudentId(data.studentId);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: data.answer || 'I could not prepare an answer.',
          action: isNameEmailQuestion(message) ? 'name-email' : null
        }
      ]);
    } catch (err) {
      setError(err.message || 'Results AI is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setMessages([
      {
        role: 'assistant',
        text: 'New chat started. Ask about a roll number, toppers, downloads, or notifications.'
      }
    ]);
    setActiveStudentId('');
    setInput('');
    setError('');
    setSuggestionsOpen(true);
  }

  function openRollPrompt(type) {
    setRollPrompt(type);
    setRollOne('');
    setRollTwo('');
    setPromptError('');
  }

  function closeRollPrompt() {
    setRollPrompt(null);
    setPromptError('');
  }

  function updateRollOne(value) {
    setRollOne(normalizeRollNumber(value));
  }

  function updateRollTwo(value) {
    setRollTwo(normalizeRollNumber(value));
  }

  function handleSuggestion(suggestion) {
    if (suggestion.type === 'roll' || suggestion.type === 'compare') {
      openRollPrompt(suggestion.type);
      return;
    }
    void sendMessage(suggestion.message);
  }

  function submitRollPrompt(event) {
    event.preventDefault();

    const first = normalizeRollNumber(rollOne);
    const second = normalizeRollNumber(rollTwo);

    if (!isValidRollNumber(first)) {
      setPromptError('Enter a valid roll number.');
      return;
    }

    if (rollPrompt === 'compare') {
      if (!isValidRollNumber(second)) {
        setPromptError('Enter two valid roll numbers.');
        return;
      }
      if (first === second) {
        setPromptError('Enter two different roll numbers.');
        return;
      }
      closeRollPrompt();
      void sendMessage(`Compare ${first} and ${second}`);
      return;
    }

    closeRollPrompt();
    void sendMessage(`What is the CGPA of ${first}?`);
  }

  return (
    <>
      <PageHeader
        eyebrow="AI Assistant"
        title="Ask AI"
        description="Chat about results, CGPA, SGPA, credits, backlogs, compare students, toppers, downloads, and portal help."
        icon="sparkles"
      />

      <section>
        <div className="page-container narrow-container section-pad">
          <div className="chat-panel">
            <div className="chat-status">
              <div className="status-left">
                <span className="online-dot" />
                <span>Results AI</span>
                <span className="muted">{activeStudentId ? `Context: ${activeStudentId}` : 'Online, Gemini powered'}</span>
              </div>
              <motion.button
                className="new-chat-button"
                type="button"
                aria-label="Start new chat"
                title="New chat"
                onClick={resetChat}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
              >
                <UiIcon name="plus" className="chat-icon" />
              </motion.button>
            </div>

            <div className="messages" ref={messagesRef} aria-live="polite">
              <AnimatePresence initial={false}>
                {messages.map((message, index) => (
                  <motion.div
                    className={`message-row ${message.role === 'user' ? 'user' : 'assistant'}`}
                    key={`${message.role}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                  >
                    <span className="message-avatar" aria-hidden="true">
                      <UiIcon name={message.role === 'user' ? 'user' : 'bot'} className="chat-icon" />
                    </span>
                    <div className="message">
                      <div className="message-body">
                        {message.role === 'assistant' ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                        ) : (
                          <p>{message.text}</p>
                        )}
                        {message.action === 'name-email' ? (
                          <Link href="/#name-email-setup" className="ink-button chat-action-button">
                            <UiIcon name="user" />
                            Add name &amp; email
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {loading ? (
                <motion.div
                  key="assistant-thinking"
                  className="message-row assistant"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="message-avatar" aria-hidden="true">
                    <UiIcon name="bot" className="chat-icon" />
                  </span>
                  <div className="message">
                    <div className="message-body"><p className="thinking-dots">Thinking</p></div>
                  </div>
                </motion.div>
              ) : null}
            </div>

            {error ? <div className="error-message chat-error">{error}</div> : null}

            <div className={`suggestions ${suggestionsOpen ? 'open' : 'collapsed'}`}>
              <button
                className="suggestions-toggle"
                type="button"
                aria-expanded={suggestionsOpen}
                onClick={() => setSuggestionsOpen((value) => !value)}
              >
                <span>Suggested</span>
                <span className="suggestions-arrow" aria-hidden="true">{suggestionsOpen ? 'Up' : 'Down'}</span>
              </button>
              <AnimatePresence initial={false}>
                {suggestionsOpen ? (
                  <motion.div
                    className="suggestion-list"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {suggestions.map((suggestion) => (
                      <motion.button
                        className="suggestion-chip"
                        type="button"
                        key={suggestion.label}
                        onClick={() => handleSuggestion(suggestion)}
                        disabled={loading}
                        whileHover={loading ? undefined : { y: -1 }}
                        whileTap={loading ? undefined : { scale: 0.98 }}
                      >
                        <UiIcon name={suggestion.icon} className="chat-icon" />
                        {suggestion.label}
                      </motion.button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <motion.form
              className="chat-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                className="chat-input"
                placeholder="Ask about results, CGPA, backlogs, toppers..."
                rows={1}
                autoComplete="off"
                aria-label="Type your message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={loading}
              />
              <motion.button
                type="submit"
                className="round-send"
                aria-label="Send message"
                disabled={loading}
                whileHover={loading ? undefined : { scale: 1.05 }}
                whileTap={loading ? undefined : { scale: 0.94 }}
              >
                <UiIcon name="send" className="chat-icon" />
              </motion.button>
            </motion.form>
            <p className="disclaimer">Results AI can make mistakes. Always verify important information.</p>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {rollPrompt ? (
          <motion.div
            className="prompt-modal-overlay"
            role="presentation"
            onMouseDown={closeRollPrompt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="prompt-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="roll-prompt-title"
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <form onSubmit={submitRollPrompt}>
                <div className="prompt-modal-header">
                  <div>
                    <div className="meta-label">Roll number</div>
                    <h2 id="roll-prompt-title" className="prompt-modal-title">
                      {rollPrompt === 'compare' ? 'Compare students' : 'Ask by roll number'}
                    </h2>
                  </div>
                  <button className="modal-close" type="button" onClick={closeRollPrompt} aria-label="Close modal">
                    <UiIcon name="x" />
                  </button>
                </div>

                <div className="prompt-modal-fields">
                  <label className="prompt-field">
                    <span className="meta-label">{rollPrompt === 'compare' ? 'First roll no.' : 'Roll no.'}</span>
                    <input
                      className="prompt-input"
                      value={rollOne}
                      onChange={(event) => updateRollOne(event.target.value)}
                      placeholder="Enter roll number"
                      maxLength={10}
                      autoComplete="off"
                      autoFocus
                    />
                  </label>

                  {rollPrompt === 'compare' ? (
                    <label className="prompt-field">
                      <span className="meta-label">Second roll no.</span>
                      <input
                        className="prompt-input"
                        value={rollTwo}
                        onChange={(event) => updateRollTwo(event.target.value)}
                        placeholder="Enter roll number"
                        maxLength={10}
                        autoComplete="off"
                      />
                    </label>
                  ) : null}
                </div>

                {promptError ? <div className="prompt-error">{promptError}</div> : null}

                <div className="prompt-modal-actions">
                  <button className="outline-button" type="button" onClick={closeRollPrompt}>
                    <UiIcon name="x" />
                    Cancel
                  </button>
                  <button className="ink-button" type="submit" disabled={loading}>
                    <UiIcon name={rollPrompt === 'compare' ? 'compare' : 'sparkles'} />
                    {rollPrompt === 'compare' ? 'Compare' : 'Ask AI'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <section className="section border-top">
        <div className="page-container narrow-container section-pad">
          <h2 className="section-title">Feedback: Results AI Feature</h2>
          <p className="hero-description feedback-description">
            Help us improve the new Results AI feature. Your feedback on its capabilities and user experience is highly valuable.
          </p>
          
          <div className="feedback-accordion">
            <button
              className="outline-button feedback-open-button"
              type="button"
              onClick={() => setFeedbackOpen((prev) => !prev)}
            >
              <UiIcon name={feedbackOpen ? 'chevronUp' : 'chevronDown'} />
              {feedbackOpen ? 'Close feedback form' : 'Open feedback form'}
            </button>

            <AnimatePresence initial={false}>
              {feedbackOpen ? (
                <motion.div
                  style={{ overflow: 'hidden' }}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <iframe
                    className="feedback-frame mt-24"
                    src="https://docs.google.com/forms/d/e/1FAIpQLSfZPbsIAYu-azK04t0GUs8Rxc8M6pLVIa3S8EYxyDmi9PkvRg/viewform?embedded=true"
                    width="640"
                    height="2765"
                    frameBorder="0"
                    marginHeight="0"
                    marginWidth="0"
                    title="Ask AI Google Form"
                    loading="lazy"
                  >
                    Loading...
                  </iframe>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  );
}
