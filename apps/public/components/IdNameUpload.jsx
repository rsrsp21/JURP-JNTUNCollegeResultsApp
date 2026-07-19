'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UiIcon from '@/components/UiIcon';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export default function IdNameUpload({ studentId, onVerified }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle | verifying | error
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  function pickFile(nextFile) {
    setMessage('');
    setStatus('idle');
    if (!nextFile) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) {
      setStatus('error');
      setMessage('Upload a JPG, PNG, or WEBP image.');
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setStatus('error');
      setMessage('Image must be under 4 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function verify() {
    if (!file || status === 'verifying') return;
    setStatus('verifying');
    setMessage('');
    try {
      const imageBase64 = await fileToBase64(file);
      const response = await fetch('/api/verify-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, mimeType: file.type, imageBase64 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed.');
      setStatus('idle');
      setOpen(false);
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      onVerified?.(data.name);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Verification failed. Try again.');
    }
  }

  return (
    <div className="id-upload">
      <button className={`subtle-button id-upload-toggle ${open ? '' : 'glow-attract'}`} type="button" onClick={() => setOpen((value) => !value)}>
        <UiIcon name="fileText" />
        {open ? 'Hide ID upload' : 'Add your name (upload ID card)'}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="id-upload-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24 }}
          >
            <p className="id-upload-note">
              <strong>Privacy first:</strong> upload your college ID card with the <strong>mobile number cropped
              out</strong>. Your photo and the college name are fine — either a cropped Name / Branch / Roll No strip or
              the card itself works. Uploads showing a mobile number are strictly rejected and your name will not be
              saved.
            </p>

            <div className="id-upload-examples">
              <figure className="id-example good">
                <img src="/images/id-crop-example.svg" alt="Accepted example: cropped strip showing only Name, Branch and Roll No" />
                <figcaption>✓ Accepted — cropped Name / Branch / Roll No strip</figcaption>
              </figure>
              <figure className="id-example good">
                <img src="/images/id-full-example.svg" alt="Accepted example: ID card with photo and college name, mobile number cropped out" />
                <figcaption>✓ Accepted — card with photo, mobile number cropped out</figcaption>
              </figure>
              <figure className="id-example bad">
                <img src="/images/id-mobile-example.svg" alt="Rejected example: ID card showing a mobile number" />
                <figcaption>✗ Rejected — mobile number visible</figcaption>
              </figure>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden-input"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />

            <div className="id-upload-actions">
              <button className="outline-button" type="button" onClick={() => inputRef.current?.click()}>
                <UiIcon name="upload" />
                {file ? 'Change image' : 'Choose cropped image'}
              </button>
              {file ? (
                <button className="ink-button" type="button" disabled={status === 'verifying'} onClick={verify}>
                  {status === 'verifying' ? 'Verifying…' : 'Verify & save name'}
                </button>
              ) : null}
            </div>

            {previewUrl ? (
              <div className="id-upload-preview">
                <img src={previewUrl} alt="Preview of your cropped ID upload" />
              </div>
            ) : null}

            {status === 'verifying' ? (
              <div className="status-message">Verifying your ID — reading Name and Roll No…</div>
            ) : null}
            {status === 'error' && message ? <div className="error-message">{message}</div> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}
