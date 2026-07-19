'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UiIcon from '@/components/UiIcon';
import ImageCropper from '@/components/ImageCropper';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function useImageSlot() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const inputRef = useRef(null);

  function accept(nextFile) {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(nextFile);
    });
    setFile(nextFile);
  }

  function clear() {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return '';
    });
    setFile(null);
  }

  return { file, previewUrl, inputRef, accept, clear };
}

export default function IdNameUpload({ studentId, currentName = '', nameEditUsed = false, onVerified }) {
  const editMode = Boolean(currentName);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | verifying | error
  const [message, setMessage] = useState('');
  const idSlot = useImageSlot();
  const gradeSlot = useImageSlot();
  const [cropTarget, setCropTarget] = useState(null); // { slot: 'id' | 'grade', file }

  if (editMode && nameEditUsed) return null;

  function fail(text) {
    setStatus('error');
    setMessage(text);
  }

  function pickForCrop(slotName, nextFile) {
    setStatus('idle');
    setMessage('');
    if (!nextFile) return;
    if (!ALLOWED_TYPES.includes(nextFile.type)) return fail('Upload a JPG, PNG, or WEBP image.');
    if (nextFile.size > MAX_IMAGE_BYTES) return fail('Image must be under 4 MB.');
    setCropTarget({ slot: slotName, file: nextFile });
  }

  async function verify() {
    if (status === 'verifying') return;
    if (editMode && !gradeSlot.file) return fail('Upload your grade card to change your name.');
    if (!editMode && !idSlot.file) return fail('Upload your ID card image first.');

    setStatus('verifying');
    setMessage('');
    try {
      const body = { studentId, mode: editMode ? 'edit' : 'new' };
      if (!editMode) {
        body.idImage = { mimeType: idSlot.file.type, imageBase64: await fileToBase64(idSlot.file) };
      }
      if (gradeSlot.file) {
        body.gradeCardImage = { mimeType: gradeSlot.file.type, imageBase64: await fileToBase64(gradeSlot.file) };
      }

      const response = await fetch('/api/verify-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed.');
      setStatus('idle');
      setOpen(false);
      idSlot.clear();
      gradeSlot.clear();
      onVerified?.(data.name, data);
    } catch (err) {
      fail(err.message || 'Verification failed. Try again.');
    }
  }

  return (
    <div className="id-upload">
      <button className={`subtle-button id-upload-toggle ${open || editMode ? '' : 'glow-attract'}`} type="button" onClick={() => setOpen((value) => !value)}>
        <UiIcon name="fileText" />
        {open
          ? editMode ? 'Hide name edit' : 'Hide ID upload'
          : editMode ? 'Edit name (upload grade card)' : 'Add your name (upload ID card)'}
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
            {editMode ? (
              <p className="id-upload-note">
                <strong>One-time name correction:</strong> upload a clear photo of your <strong>JNTUK grade
                card</strong> — the full card with the GRADE CARD banner, Hall Ticket No., course table, stamp, and
                signature visible. Your new name is taken from the grade card, must match your current name
                (<strong>{currentName}</strong>) by initials, and goes to an admin for approval. You can do this{' '}
                <strong>only once</strong>.
              </p>
            ) : (
              <>
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

                <p className="id-upload-note">
                  <strong>Grade card (optional, recommended):</strong> also upload your JNTUK grade card to record your{' '}
                  <strong>full official name</strong> (ID cards often carry initials only). The Hall Ticket No. must match
                  your roll number and the name must match your ID card by initials — for example, <em>B M SIVA
                  SANJAY</em> on the ID matches <em>BHIMANENI MOHAN SIVA SANJAY</em> on the grade card.
                </p>
              </>
            )}

            <input
              ref={idSlot.inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden-input"
              onChange={(event) => {
                pickForCrop('id', event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <input
              ref={gradeSlot.inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden-input"
              onChange={(event) => {
                pickForCrop('grade', event.target.files?.[0]);
                event.target.value = '';
              }}
            />

            <div className="id-upload-actions">
              {!editMode ? (
                <button className="outline-button" type="button" onClick={() => idSlot.inputRef.current?.click()}>
                  <UiIcon name="upload" />
                  {idSlot.file ? 'Change ID card' : 'ID card (required)'}
                </button>
              ) : null}
              <button className="outline-button" type="button" onClick={() => gradeSlot.inputRef.current?.click()}>
                <UiIcon name="upload" />
                {gradeSlot.file
                  ? 'Change grade card'
                  : editMode ? 'Grade card (required)' : 'Grade card (optional)'}
              </button>
              {(editMode ? gradeSlot.file : idSlot.file) ? (
                <button className="ink-button" type="button" disabled={status === 'verifying'} onClick={verify}>
                  {status === 'verifying' ? 'Verifying…' : 'Verify & save name'}
                </button>
              ) : null}
            </div>

            {idSlot.previewUrl || gradeSlot.previewUrl ? (
              <div className="id-upload-preview-row">
                {idSlot.previewUrl ? (
                  <div className="id-upload-preview">
                    <img src={idSlot.previewUrl} alt="Preview of your ID card upload" />
                  </div>
                ) : null}
                {gradeSlot.previewUrl ? (
                  <div className="id-upload-preview">
                    <img src={gradeSlot.previewUrl} alt="Preview of your grade card upload" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {status === 'verifying' ? (
              <div className="status-message">
                Verifying your {editMode ? 'grade card' : gradeSlot.file ? 'ID and grade card' : 'ID'} — reading Name and Roll No…
              </div>
            ) : null}
            {status === 'error' && message ? <div className="error-message">{message}</div> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {cropTarget ? (
        <ImageCropper
          file={cropTarget.file}
          onDone={(croppedFile) => {
            (cropTarget.slot === 'id' ? idSlot : gradeSlot).accept(croppedFile);
            setCropTarget(null);
          }}
          onCancel={() => setCropTarget(null)}
        />
      ) : null}
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
