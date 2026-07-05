'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import UiIcon from '@/components/UiIcon';

const years = [
  ['2021', '2021-25'],
  ['2022', '2022-26'],
  ['2023', '2023-27'],
  ['2024', '2024-28'],
  ['2025', '2025-29']
];

const branches = [
  ['cse', 'Computer Science'],
  ['ece', 'Electronics & Communication'],
  ['eee', 'Electrical & Electronics'],
  ['mec', 'Mechanical'],
  ['ce', 'Civil']
];

const toppersMemoryCache = new Map();

export default function ToppersPage() {
  const [year, setYear] = useState('2021');
  const [branch, setBranch] = useState('cse');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readToppersCache(year);

    setData(cached);
    setLoading(!cached);
    setError('');
    if (cached) return undefined;

    fetch(`/api/toppers?year=${year}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const nextData = payload && !payload.error ? payload : null;
        setData(nextData);
        if (nextData) writeToppersCache(year, nextData);
      })
      .catch(() => {
        if (active && !cached) setError('Unable to load toppers data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [year]);

  const overallRows = data?.overall || [];
  const podiumRows = useMemo(() => [overallRows[1], overallRows[0], overallRows[2]].filter(Boolean), [overallRows]);
  const branchRows = data?.[branch] || [];
  const selectedBatch = years.find(([value]) => value === year)?.[1] || year;

  return (
    <>
      <PageHeader
        eyebrow="Rankings"
        title="Toppers List"
        description="Academic excellence rankings across batches and branches."
        icon="trophy"
      >
        <div className="download-row toppers-filter-row">
          <label className="filter-field">
            <span className="section-kicker">Batch</span>
            <div className="filter-menu" onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setBatchMenuOpen(false);
            }}>
              <button
                className={`filter-select-wrap ${batchMenuOpen ? 'open' : ''}`}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={batchMenuOpen}
                onClick={() => setBatchMenuOpen((open) => !open)}
              >
                <UiIcon name="calendar" />
                <span className="filter-select-value">{selectedBatch} Batch</span>
                <UiIcon name="chevronDown" />
              </button>
              {batchMenuOpen ? (
                <div className="filter-options" role="listbox" aria-label="Select batch">
                  {years.map(([value, label]) => (
                    <button
                      className={`filter-option ${year === value ? 'active' : ''}`}
                      type="button"
                      role="option"
                      aria-selected={year === value}
                      key={value}
                      onClick={() => {
                        setYear(value);
                        setBatchMenuOpen(false);
                      }}
                    >
                      {label} Batch
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
        </div>
      </PageHeader>

      <section className="section">
        <div className="page-container section-pad">
          {error ? <div className="error-message">{error}</div> : null}

          <div className="section-heading-row">
            <h2 className="section-title"><UiIcon name="trophy" /> Overall College Toppers</h2>
            <span className="section-kicker">{selectedBatch}</span>
          </div>

          {loading && !overallRows.length ? (
            <ToppersLoading />
          ) : overallRows.length ? (
            <>
              <div className="podium-grid">
                {podiumRows.map((row, index) => {
                  const rank = overallRows.findIndex((item) => item.roll_number === row.roll_number) + 1;
                  return (
                    <PodiumCard
                      key={row.roll_number}
                      index={index}
                      rank={rank}
                      roll={row.roll_number}
                      cgpa={row.cgpa}
                      highlight={rank === 1}
                    />
                  );
                })}
              </div>

              <div className="table-scroll mt-48">
                <TopperTable rows={overallRows} />
              </div>
            </>
          ) : !loading ? (
            <div className="status-message">No overall rankings found for this batch.</div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="page-container section-pad">
          <div className="section-heading-row">
            <h2 className="section-title"><UiIcon name="branch" /> Branch-wise Toppers</h2>
          </div>
          <div className="tabs-row mb-32">
            {branches.map(([value, label]) => (
              <motion.button
                className={`subtle-button ${branch === value ? 'active' : ''}`}
                type="button"
                key={value}
                onClick={() => setBranch(value)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <UiIcon name="branch" />
                {label}
              </motion.button>
            ))}
          </div>

          {loading && !branchRows.length ? (
            <BranchLoading />
          ) : branchRows.length ? (
            <div className="table-scroll">
              <TopperTable rows={branchRows} />
            </div>
          ) : !loading ? (
            <div className="status-message">No branch rankings found for this batch.</div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function ToppersLoading() {
  return (
    <div className="toppers-loading" aria-label="Loading toppers">
      <div className="podium-grid loading-podium">
        {[0, 1, 2].map((item) => (
          <motion.div
            className="podium-card loading-card"
            key={item}
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', delay: item * 0.08 }}
          >
            <span className="loading-line short" />
            <span className="loading-line title" />
            <span className="loading-line" />
            <span className="loading-line value" />
          </motion.div>
        ))}
      </div>
      <BranchLoading />
    </div>
  );
}

function BranchLoading() {
  return (
    <div className="loading-table" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <motion.span
          className="loading-line"
          key={item}
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', delay: item * 0.06 }}
        />
      ))}
    </div>
  );
}

function PodiumCard({ rank, roll, cgpa, highlight = false }) {
  return (
    <motion.div
      className={`podium-card rank-${rank} ${highlight ? 'highlight' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.26 }}
    >
      <div className="podium-icon"><UiIcon name="trophy" /></div>
      <div className="rank-index">Rank</div>
      <div className="podium-rank">{rankLabel(rank)}</div>
      <div className="podium-roll">{roll}</div>
      <div className="podium-cgpa">{formatCgpa(cgpa)}</div>
      <div className="rank-index">CGPA</div>
    </motion.div>
  );
}

function TopperTable({ rows }) {
  return (
    <table className="data-table topper-table">
      <thead>
        <tr>
          <th className="rank-column">Rank</th>
          <th>Roll Number</th>
          <th className="numeric cgpa-column">CGPA</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <motion.tr
            key={`${item.roll_number}-${index}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.025, duration: 0.18 }}
          >
            <td className="mono muted" data-label="Rank">{String(index + 1).padStart(2, '0')}</td>
            <td className="mono" data-label="Roll Number">{item.roll_number}</td>
            <td className="numeric serif topper-cgpa-value" data-label="CGPA">{formatCgpa(item.cgpa)}</td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  );
}

function rankLabel(rank) {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function formatCgpa(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : String(value ?? 'N/A');
}

function readToppersCache(year) {
  return toppersMemoryCache.get(year) || null;
}

function writeToppersCache(year, data) {
  toppersMemoryCache.set(year, data);
}
