'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import UiIcon from '@/components/UiIcon';

export default function RollSearch({ value = '', onValueChange, onSearch, loading = false }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function updateValue(nextValue) {
    const normalized = nextValue.toUpperCase();
    setLocalValue(normalized);
    onValueChange?.(normalized);
  }

  return (
    <motion.form
      className="roll-search"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch?.(localValue);
      }}
    >
      <label className="meta-label" htmlFor="roll-search-input">Roll No.</label>
      <input
        id="roll-search-input"
        value={localValue}
        onChange={(event) => updateValue(event.target.value)}
        placeholder="e.g. 21031A0546"
        className="roll-search-input"
        maxLength={10}
        autoComplete="off"
      />
      <motion.button
        className="ink-button"
        type="submit"
        disabled={loading}
        whileHover={loading ? undefined : { y: -1 }}
        whileTap={loading ? undefined : { scale: 0.98 }}
      >
        <UiIcon name="search" />
        {loading ? 'Searching' : 'Search'}
      </motion.button>
    </motion.form>
  );
}
