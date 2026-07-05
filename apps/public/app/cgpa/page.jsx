'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import RollSearch from '@/components/RollSearch';
import SgpaChart from '@/components/SgpaChart';
import UiIcon from '@/components/UiIcon';
import { batchDisplay, branchFromRoll, displayValue, isValidRollNumber, normalizeRollNumber, semesters } from '@/lib/client-utils';
import { downloadCgpaPdf } from '@/lib/pdf';

const cgpaMemoryCache = new Map();

export default function CgpaPage() {
  const [rollNumber, setRollNumber] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      const normalized = normalizeRollNumber(id);
      setRollNumber(normalized);
      void loadStudent(normalized);
    }
  }, []);

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
      const cached = readCgpaCache(normalized);
      if (cached) {
        setRollNumber(normalized);
        setStudent(cached);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/cgpa/${encodeURIComponent(normalized)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No data found for this roll number.');
      setRollNumber(normalized);
      setStudent(data);
      writeCgpaCache(normalized, data);
    } catch (err) {
      setError(err.message || 'Unable to load CGPA.');
    } finally {
      setLoading(false);
    }
  }

  const semesterRows = useMemo(() => {
    if (!student) return [];
    return semesters
      .filter((semester) => semester.number < 9)
      .map((semester) => ({
        ...semester,
        fullLabel: fullSemesterLabel(semester.key),
        sgpa: student[semester.key],
        credits: student[semester.creditsKey]
      }))
      .filter((row) => row.sgpa || row.credits);
  }, [student]);

  const summary = student?.academicSummary || {};

  return (
    <>
      <PageHeader
        eyebrow="Cumulative GPA"
        title="Check CGPA"
        description="View your semester-wise SGPA and overall credits, percentage, and CGPA."
      />

      <section>
        <div className="page-container section-pad">
          <RollSearch value={rollNumber} onValueChange={setRollNumber} onSearch={loadStudent} loading={loading} />

          {loading ? <div className="status-message">Fetching CGPA from database...</div> : null}
          {error ? <div className="error-message">{error}</div> : null}
          {!loading && !error && !student ? (
            <div className="status-message">Enter a roll number to view CGPA.</div>
          ) : null}

          {student ? (
            <>
              <motion.div
                className="student-header"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
              >
                <div>
                  <div className="data-block-label">Roll Number</div>
                  <div className="roll-display">{student.ID}</div>
                </div>
                <div>
                  <div className="data-block-label">Branch</div>
                  <div className="branch-display">{branchFromRoll(student.ID)}</div>
                </div>
                <div className="mini-meta-row">
                  <div>
                    <div className="data-block-label">Batch</div>
                    <div className="mini-meta-value">{batchDisplay(student.Batch)}</div>
                  </div>
                  <div>
                    <div className="data-block-label">Reg</div>
                    <div className="mini-meta-value">{displayValue(student.Regulation)}</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="stat-grid"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 }}
              >
                <Stat label="CGPA" value={displayValue(student.CGPA)} note={displayValue(summary.division)} big />
                <Stat label="Percentage" value={displayValue(summary.percentage)} />
                <Stat label="Total Credits" value={displayValue(student['Total Credits'])} />
                <Stat label="Supplementary" value={summary.supplementaryCount > 0 ? String(summary.supplementaryCount) : 'None'} />
              </motion.div>

              <motion.div
                className="chart-section"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 }}
              >
                <div className="section-heading-row">
                  <h2 className="section-title">Semester-wise performance</h2>
                  <span className="section-kicker">SGPA / semester</span>
                </div>
                <SgpaChart rows={semesterRows} />
              </motion.div>

              <div className="semester-breakdown">
                <h2 className="section-title">Semester breakdown</h2>
                {semesterRows.length ? (
                  <div className="semester-list mt-32">
                    {semesterRows.map((row, index) => (
                      <motion.div
                        className="semester-breakdown-row"
                        key={row.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.035, duration: 0.22 }}
                        whileHover={{ x: 3 }}
                      >
                        <div className="semester-name">{row.fullLabel}</div>
                        <div className="semester-sgpa">{displayValue(row.sgpa)}</div>
                        <div className="semester-credits">{displayValue(row.credits)} cr</div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No semester data available for chart.</div>
                )}

                <div className="download-row">
                  <button className="outline-button" type="button" onClick={() => downloadCgpaPdf(student)}>
                    <UiIcon name="download" />
                    Download
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, note, big = false }) {
  return (
    <motion.div className="stat-cell" whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
      <div className="data-block-label">{label}</div>
      <div className={`stat-value ${big ? 'big' : ''}`}>{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </motion.div>
  );
}

function readCgpaCache(rollNumber) {
  if (cgpaMemoryCache.has(rollNumber)) return cgpaMemoryCache.get(rollNumber);
  return null;
}

function writeCgpaCache(rollNumber, data) {
  cgpaMemoryCache.set(rollNumber, data);
}

function fullSemesterLabel(key) {
  const labels = {
    '1-1': 'First Year - First Semester',
    '1-2': 'First Year - Second Semester',
    '2-1': 'Second Year - First Semester',
    '2-2': 'Second Year - Second Semester',
    '3-1': 'Third Year - First Semester',
    '3-2': 'Third Year - Second Semester',
    '4-1': 'Fourth Year - First Semester',
    '4-2': 'Fourth Year - Second Semester'
  };
  return labels[key] || key;
}
