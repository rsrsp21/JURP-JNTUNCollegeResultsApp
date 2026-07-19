'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import RollSearch from '@/components/RollSearch';
import IdNameUpload from '@/components/IdNameUpload';
import EmailSubscribe from '@/components/EmailSubscribe';
import UiIcon from '@/components/UiIcon';
import { isValidRollNumber, normalizeRollNumber } from '@/lib/client-utils';

export default function NameEmailSetup() {
  const [rollNumber, setRollNumber] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadStudent(value = rollNumber) {
    const normalized = normalizeRollNumber(value);
    if (!isValidRollNumber(normalized)) {
      setError('Enter a valid roll number.');
      return;
    }
    setLoading(true);
    setError('');
    setStudent(null);
    try {
      const response = await fetch(`/api/cgpa/${encodeURIComponent(normalized)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No data found for this roll number.');
      setRollNumber(normalized);
      setStudent(data);
    } catch (err) {
      setError(err.message || 'Unable to look up this roll number.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="name-email-setup"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.3 }}
    >
      <div className="section-heading-row">
        <h2 className="section-title"><UiIcon name="user" /> Add your name &amp; email</h2>
        <span className="section-kicker">New</span>
      </div>
      <p className="name-email-setup-desc">
        Verify your name with your college ID and add an email to get result updates. Enter your roll number to begin.
      </p>

      <RollSearch value={rollNumber} onValueChange={setRollNumber} onSearch={loadStudent} loading={loading} />

      {loading ? <div className="status-message">Looking up your record...</div> : null}
      {error ? <div className="error-message">{error}</div> : null}

      {student ? (
        <div className="name-email-setup-result">
          <div className="name-email-setup-summary">
            <span className="mono">{student.ID}</span>
            {student.Name ? (
              <span className="name-email-verified">
                <UiIcon name="graduationCap" /> {student.Name}
                {student.NameStatus !== 'approved' ? <span className="pending-tag">Pending approval</span> : null}
              </span>
            ) : (
              <span className="name-email-missing">Name not added yet</span>
            )}
          </div>

          <div className="profile-actions">
            {!student.Name ? (
              <IdNameUpload
                studentId={student.ID}
                onVerified={(name) => setStudent({ ...student, Name: name })}
              />
            ) : null}
            <EmailSubscribe
              studentId={student.ID}
              currentEmail={student.Email || ''}
              pendingEmail={student.PendingEmail || ''}
              onSaved={(result) => setStudent({ ...student, Email: result.email, PendingEmail: result.pendingEmail || '' })}
            />
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
