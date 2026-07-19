'use client';

import { useEffect, useRef, useState } from 'react';

const MIN_SIZE = 32;

// Lightweight canvas-based cropper: drag the box to move it, drag a corner to
// resize. "Apply crop" exports the selected region at the image's natural
// resolution; "Use full image" skips cropping.
export default function ImageCropper({ file, onDone, onCancel }) {
  const [url, setUrl] = useState('');
  const [rect, setRect] = useState(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    function onMove(event) {
      const drag = dragRef.current;
      const img = imgRef.current;
      if (!drag || !img) return;
      event.preventDefault();
      const maxW = img.clientWidth;
      const maxH = img.clientHeight;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const start = drag.rect;
      let { x, y, w, h } = start;

      if (drag.mode === 'move') {
        x = clamp(start.x + dx, 0, maxW - start.w);
        y = clamp(start.y + dy, 0, maxH - start.h);
      } else {
        if (drag.mode.includes('e')) w = clamp(start.w + dx, MIN_SIZE, maxW - start.x);
        if (drag.mode.includes('s')) h = clamp(start.h + dy, MIN_SIZE, maxH - start.y);
        if (drag.mode.includes('w')) {
          const newX = clamp(start.x + dx, 0, start.x + start.w - MIN_SIZE);
          w = start.w + (start.x - newX);
          x = newX;
        }
        if (drag.mode.includes('n')) {
          const newY = clamp(start.y + dy, 0, start.y + start.h - MIN_SIZE);
          h = start.h + (start.y - newY);
          y = newY;
        }
      }
      setRect({ x, y, w, h });
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    setRect({
      x: Math.round(img.clientWidth * 0.06),
      y: Math.round(img.clientHeight * 0.06),
      w: Math.round(img.clientWidth * 0.88),
      h: Math.round(img.clientHeight * 0.88)
    });
  }

  function startDrag(event, mode) {
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, rect: { ...rect } };
  }

  async function applyCrop() {
    const img = imgRef.current;
    if (!img || !rect) return;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rect.w * scaleX));
    canvas.height = Math.max(1, Math.round(rect.h * scaleY));
    const context = canvas.getContext('2d');
    context.drawImage(
      img,
      rect.x * scaleX,
      rect.y * scaleY,
      rect.w * scaleX,
      rect.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const type = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
    if (!blob) return;
    onDone(new File([blob], file.name, { type }));
  }

  return (
    <div className="cropper-overlay" role="dialog" aria-modal="true" aria-label="Crop your image">
      <div className="cropper-dialog">
        <div className="cropper-heading">Crop your image</div>
        <p className="cropper-hint">Drag the box to move it, or drag a corner to resize. Crop out any mobile number before saving.</p>
        <div className="cropper-stage">
          {url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img ref={imgRef} src={url} alt="Image to crop" onLoad={onImageLoad} draggable={false} />
          ) : null}
          {rect ? (
            <div
              className="cropper-box"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              onPointerDown={(event) => startDrag(event, 'move')}
            >
              {['nw', 'ne', 'sw', 'se'].map((corner) => (
                <span
                  key={corner}
                  className={`cropper-handle ${corner}`}
                  onPointerDown={(event) => startDrag(event, corner)}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="cropper-actions">
          <button className="ink-button" type="button" onClick={applyCrop}>Apply crop</button>
          <button className="outline-button" type="button" onClick={() => onDone(file)}>Use full image</button>
          <button className="subtle-button" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
