'use client';

import { useState } from 'react';
import UiIcon from '@/components/UiIcon';

export default function EmailSubscribe({ studentId, currentEmail = '', pendingEmail = '', onSaved }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/subscribe-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save email.');
      setEditing(false);
      setNotice(data.status === 'pending' ? 'Email change requested — waiting for admin approval.' : '');
      onSaved?.(data);
    } catch (err) {
      setError(err.message || 'Could not save email.');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="email-subscribe">
        {currentEmail ? (
          <span className="email-subscribe-current">
            <UiIcon name="mail" /> Result updates go to <strong>{currentEmail}</strong>
          </span>
        ) : null}
        {pendingEmail ? (
          <span className="email-subscribe-current">
            <span className="pending-tag">Change to {pendingEmail} pending approval</span>
          </span>
        ) : null}
        {!pendingEmail ? (
          <button
            className={`subtle-button ${currentEmail ? '' : 'glow-attract'}`}
            type="button"
            onClick={() => {
              setEmail(currentEmail);
              setNotice('');
              setEditing(true);
            }}
          >
            <UiIcon name="mail" />
            {currentEmail ? 'Change email' : 'Add email'}
          </button>
        ) : null}
        {notice ? <span className="email-subscribe-hint">{notice}</span> : null}
      </div>
    );
  }

  return (
    <form className="email-subscribe editing" onSubmit={save}>
      <span className="email-subscribe-hint">
        {currentEmail
          ? 'Changing your email needs admin approval. Your current email stays active until then.'
          : 'Get result updates through email.'}
      </span>
      <input
        type="email"
        className="email-subscribe-input"
        value={email}
        placeholder="you@example.com"
        maxLength={120}
        required
        onChange={(event) => setEmail(event.target.value)}
      />
      <button className="ink-button" type="submit" disabled={saving}>
        {saving ? 'Saving…' : currentEmail ? 'Request change' : 'Save'}
      </button>
      <button className="subtle-button" type="button" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error ? <span className="email-subscribe-error">{error}</span> : null}
    </form>
  );
}
