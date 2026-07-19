'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import RollSearch from '@/components/RollSearch';
import IdNameUpload from '@/components/IdNameUpload';
import EmailSubscribe from '@/components/EmailSubscribe';
import UiIcon from '@/components/UiIcon';
import { batchDisplay, branchFromRoll, displayValue, isValidRollNumber, normalizeRollNumber, semesters } from '@/lib/client-utils';
import { downloadAllSemestersPdf, downloadSemesterPdf } from '@/lib/pdf';
import { useApp } from '@/components/AppContext';

const semesterResultsMemoryCache = new Map();

export default function SemesterResultsPage() {
  const {
    resultsRollNumber: rollNumber,
    setResultsRollNumber: setRollNumber,
    resultsPayload: payload,
    setResultsPayload: setPayload,
    resultsOpenSemesters: openSemesters,
    setResultsOpenSemesters: setOpenSemesters
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      const normalized = normalizeRollNumber(id);
      setRollNumber(normalized);
      void loadResults(normalized);
    }
  }, []);

  async function loadResults(value = rollNumber) {
    const normalized = normalizeRollNumber(value);
    if (!isValidRollNumber(normalized)) {
      setError('Enter a valid roll number.');
      return;
    }

    setLoading(true);
    setError('');
    setPayload(null);
    setOpenSemesters({});
    try {
      const cached = readSemesterResultsCache(normalized);
      if (cached) {
        setRollNumber(normalized);
        setPayload(cached);
        setOpenSemesters({});
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/student-results/${encodeURIComponent(normalized)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No data found for this roll number.');
      setRollNumber(normalized);
      setPayload(data);
      setOpenSemesters({});
      writeSemesterResultsCache(normalized, data);
    } catch (err) {
      setError(err.message || 'Unable to load semester results.');
    } finally {
      setLoading(false);
    }
  }

  const semesterEntries = useMemo(() => {
    const semesterData = payload?.semesterData || {};
    return semesters
      .map((semester) => ({
        ...semester,
        rows: semesterData[String(semester.number)] || [],
        summary: payload?.semesterSummaries?.[String(semester.number)] || {}
      }))
      .filter((semester) => semester.rows.length);
  }, [payload]);

  const cgpaData = payload?.cgpaData || {};

  function toggleSemester(key) {
    setOpenSemesters((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <>
      <PageHeader
        eyebrow="Transcript"
        title="Semester-wise Results"
        description="View your semester grades, SGPA, and credits earned across your academic journey."
        icon="fileText"
      />

      <section>
        <div className="page-container section-pad">
          <div className="search-tabs">
            <Link
              href={`/results${rollNumber ? `?id=${rollNumber}` : ''}`}
              className="search-tab active"
            >
              <UiIcon name="fileText" />
              Semester Results
            </Link>
            <Link
              href={`/cgpa${rollNumber ? `?id=${rollNumber}` : ''}`}
              className="search-tab"
            >
              <UiIcon name="graduationCap" />
              CGPA & SGPA Trend
            </Link>
          </div>

          <RollSearch value={rollNumber} onValueChange={setRollNumber} onSearch={loadResults} loading={loading} />

          {loading ? <div className="status-message">Fetching semester records from database...</div> : null}
          {error ? <div className="error-message">{error}</div> : null}
          {!loading && !error && !payload ? (
            <div className="status-message">Enter a roll number to view semester records.</div>
          ) : null}

          {payload ? (
            <>
              <motion.div
                className="student-header"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
              >
                <div>
                  <div className="data-block-label">Roll Number</div>
                  <div className="roll-display">{payload.studentId}</div>
                </div>
                <div>
                  <div className="data-block-label">{cgpaData.Name ? 'Name' : 'Branch'}</div>
                  <div className="branch-display">
                    {cgpaData.Name || branchFromRoll(payload.studentId)}
                    {cgpaData.Name && cgpaData.NameStatus !== 'approved' ? <span className="pending-tag">Pending approval</span> : null}
                  </div>
                </div>
                <div className="mini-meta-row">
                  <div>
                    <div className="data-block-label">Batch</div>
                    <div className="mini-meta-value">{batchDisplay(cgpaData.Batch)}</div>
                  </div>
                  <div>
                    <div className="data-block-label">Reg</div>
                    <div className="mini-meta-value">{displayValue(cgpaData.Regulation)}</div>
                  </div>
                </div>
                {cgpaData.Name ? (
                  <div className="student-header-sub">
                    <div className="data-block-label">Branch</div>
                    <div className="branch-display sub">{branchFromRoll(payload.studentId)}</div>
                  </div>
                ) : null}
              </motion.div>

              <div className="profile-actions">
                <IdNameUpload
                    studentId={payload.studentId}
                    currentName={cgpaData.Name || ''}
                    nameEditUsed={Boolean(cgpaData.NameEditUsed)}
                    onVerified={(name, data) => {
                      const next = {
                        ...payload,
                        cgpaData: {
                          ...payload.cgpaData,
                          Name: name,
                          NameStatus: 'pending',
                          NameEditUsed: data?.mode === 'edit' ? 1 : payload.cgpaData.NameEditUsed
                        }
                      };
                      setPayload(next);
                      writeSemesterResultsCache(payload.studentId, next);
                    }}
                  />
                <EmailSubscribe
                  studentId={payload.studentId}
                  currentEmail={cgpaData.Email || ''}
                  pendingEmail={cgpaData.PendingEmail || ''}
                  changeUsed={Boolean(cgpaData.EmailEditUsed)}
                  onSaved={(result) => {
                    const next = {
                      ...payload,
                      cgpaData: { ...payload.cgpaData, Email: result.email, PendingEmail: result.pendingEmail || '' }
                    };
                    setPayload(next);
                    writeSemesterResultsCache(payload.studentId, next);
                  }}
                />
              </div>

              <motion.div
                className="meta-grid"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.04 }}
              >
                <Meta label="Percentage" value={displayValue(cgpaData.academicSummary?.percentage)} />
                <Meta label="CGPA" value={displayValue(cgpaData.CGPA)} />
                <Meta label="Total Credits Earned" value={displayValue(cgpaData['Total Credits'])} />
              </motion.div>

              <div className="download-row">
                <button className="outline-button" type="button" onClick={() => downloadAllSemestersPdf({ ...payload, includeHonors: false })}>
                  <UiIcon name="download" />
                  Download all results
                </button>
                <button className="subtle-button" type="button" onClick={() => downloadAllSemestersPdf({ ...payload, includeHonors: true })}>
                  <UiIcon name="fileText" />
                  Download all with Honors/Minor
                </button>
              </div>

              {semesterEntries.length ? (
                <div className="accordion-list mt-48">
                  {semesterEntries.map((semester) => {
                    const key = String(semester.number);
                    const open = Boolean(openSemesters[key]);
                    return (
                      <motion.div
                        className="accordion-item"
                        key={key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Number(key) * 0.025, duration: 0.22 }}
                      >
                        <motion.button
                          className="accordion-trigger"
                          type="button"
                          onClick={() => toggleSemester(key)}
                          whileHover={{ x: 3 }}
                          whileTap={{ scale: 0.995 }}
                        >
                          <span className="meta-label">Sem</span>
                          <span className="accordion-label">{semester.label}</span>
                          <span className="accordion-summary">
                            {displayValue(semester.summary.sgpa)} SGPA
                          </span>
                          <span className="accordion-chevron">
                            <UiIcon name={open ? 'chevronUp' : 'chevronDown'} />
                          </span>
                        </motion.button>
                        <AnimatePresence initial={false}>
                          {open ? (
                          <motion.div
                            className="accordion-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className="semester-summary-strip">
                              <div>
                                <div className="data-block-label">SGPA</div>
                                <div className="semester-summary-value">{displayValue(semester.summary.sgpa)}</div>
                              </div>
                              <div />
                              <div>
                                <div className="data-block-label">Credits</div>
                                <div className="mini-meta-value">{displayValue(semester.summary.credits)}</div>
                              </div>
                            </div>

                            <div className="table-scroll">
                              <table className="data-table semester-result-table">
                                <thead>
                                  <tr>
                                    <th>Code</th>
                                    <th>Subject</th>
                                    <th>Grade</th>
                                    <th className="numeric">Credits</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {semester.rows.map((row, index) => (
                                    <motion.tr
                                      className="result-table-row"
                                      key={`${row['Subject Code']}-${index}`}
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: index * 0.025, duration: 0.2 }}
                                    >
                                      <td className="mono semester-code-cell" data-label="Code" data-credits={displayValue(row.Credits)}>{row['Subject Code']}</td>
                                      <td className="semester-subject-cell" data-label="Subject">{row['Subject Name']}</td>
                                      <td className="semester-grade-cell" data-label="Grade"><span className={`grade-badge ${gradeClass(row.Grade)}`}>{row.Grade}</span></td>
                                      <td className="numeric mono muted semester-credit-cell" data-label="Credits">{displayValue(row.Credits)}</td>
                                    </motion.tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="download-row">
                              <button
                                className="outline-button"
                                type="button"
                                onClick={() => downloadSemesterPdf({
                                  studentId: payload.studentId,
                                  cgpaData,
                                  semester: key,
                                  summary: semester.summary,
                                  rows: semester.rows
                                })}
                              >
                                <UiIcon name="download" />
                                Download semester {semester.label} result
                              </button>
                            </div>
                          </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="status-message">CGPA data may exist, but subject rows were not found.</div>
              )}
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}

function readSemesterResultsCache(rollNumber) {
  if (semesterResultsMemoryCache.has(rollNumber)) return semesterResultsMemoryCache.get(rollNumber);
  return null;
}

function writeSemesterResultsCache(rollNumber, data) {
  semesterResultsMemoryCache.set(rollNumber, data);
}

function Meta({ label, value }) {
  return (
    <motion.div className="meta-cell" whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
      <div className="data-block-label">{label}</div>
      <div className="meta-value">{value}</div>
    </motion.div>
  );
}

function gradeClass(grade = '') {
  const value = String(grade).trim().toUpperCase();
  return value === 'F' || value === 'AB' || value === 'ABSENT' ? 'fail' : '';
}
