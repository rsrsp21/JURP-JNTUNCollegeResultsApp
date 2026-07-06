'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const quickLinks = [
  { href: '/cgpa', icon: 'graduationCap', code: 'CG', label: 'CGPA', desc: 'Overall score, percentage, credits, and SGPA trend.', action: 'Check' },
  { href: '/results', icon: 'fileText', code: 'SR', label: 'Semester Results', desc: 'Subject grades, credits, and semester PDFs.', action: 'View' },
  { href: '/ask-ai', icon: 'sparkles', code: 'AI', label: 'Ask AI', desc: 'Compare students, backlogs, SGPA, and result questions.', action: 'Ask' },
  { href: '/toppers', icon: 'trophy', code: 'TP', label: 'Toppers', desc: 'Batch-wise and branch-wise rankings.', action: 'Rankings' }
];

const whatsappGroupUrl = 'https://chat.whatsapp.com/Flaf1SsPaL4DDhMRKIghlS';
let notificationsMemoryCache = null;

const features = [
  { icon: 'bookOpen', title: 'Detailed Results', points: ['Semester-wise performance breakdown', 'Subject-wise grades and marks'] },
  { icon: 'calculator', title: 'CGPA Calculator', points: ['Automatic CGPA from database', 'Percentage and classification'] },
  { icon: 'trophy', title: 'Toppers Rankings', points: ['Overall college rankings', 'Branch-wise leaderboards'] },
  { icon: 'sparkles', title: 'AI Assistant', points: ['Ask about results and credits', 'Compare students and backlogs'] }
];



const heroMetrics = [
  { icon: 'zap', label: 'Lookup', value: 'Fast' },
  { icon: 'layers', label: 'Semesters', value: '8' },
  { icon: 'sparkles', label: 'AI', value: 'Ready' },
  { icon: 'download', label: 'PDF', value: 'Export' }
];

const chartPoints = [
  [8, 76],
  [44, 55],
  [80, 62],
  [116, 42],
  [152, 49],
  [188, 31],
  [224, 38],
  [260, 18]
];

const heroPhrases = [
  'JURP for quick results',
  'JURP with AI help',
  'JURP for CGPA'
];

export default function HomePage() {
  const cached = readNotificationsCache();
  const [notifications, setNotifications] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const [heroText, setHeroText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allNotifications, setAllNotifications] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);

  function openAllNotifications() {
    setIsModalOpen(true);
    if (allNotifications.length === 0 && !loadingAll) {
      setLoadingAll(true);
      fetch(`/api/notifications?limit=all&t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => setAllNotifications(Array.isArray(data) ? data : []))
        .finally(() => setLoadingAll(false));
    }
  }

  useEffect(() => {
    fetch(`/api/notifications?limit=3&t=${Date.now()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        const nextNotifications = Array.isArray(data) ? data : [];
        setNotifications(nextNotifications);
        writeNotificationsCache(nextNotifications);
        setError('');
      })
      .catch(() => {
        if (!notificationsMemoryCache) setError('Unable to load notifications right now.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    function tick() {
      const phrase = heroPhrases[phraseIndex];
      let delay = deleting ? 46 : 92;

      if (deleting) {
        charIndex -= 1;
        setHeroText(phrase.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % heroPhrases.length;
          delay = 260;
        }
      } else {
        charIndex += 1;
        setHeroText(phrase.slice(0, charIndex));
        if (charIndex === phrase.length) {
          deleting = true;
          delay = phraseIndex === 0 ? 1100 : 1700;
        }
      }

      timeoutId = window.setTimeout(tick, delay);
    }

    timeoutId = window.setTimeout(tick, 220);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const visibleNotifications = notifications.slice(0, 3);

  return (
    <div className={loading ? 'page-loading-skeleton' : ''}>
      <section className="page-hero home-hero">
        <div className="page-container page-hero-inner home-hero-grid">
          <div className="home-hero-left">
            <motion.div
              className="home-hero-copy"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="hero-title typing-title" aria-label="JURP - JNTUK UCEN Results Portal">
                <span className="typing-text">
                  {heroText || 'JURP'}
                </span>
                <span className="typing-cursor" aria-hidden="true" />
              </h1>
              <p className="hero-description">
                <strong>JURP</strong> (<strong>J</strong>NTUK <strong>U</strong>CEN <strong>R</strong>esults <strong>P</strong>ortal) is a comprehensive tool to check your academic performance, access your complete course history, and calculate your SGPA &amp; CGPA with just your roll number.
              </p>
              <div className="download-row home-hero-actions">
                <Link href="/cgpa" className="ink-button">
                  <Icon name="search" />
                  Check your results
                </Link>
                <Link href="/ask-ai" className="outline-button">
                  <Icon name="sparkles" />
                  Ask AI
                </Link>
                <a href={whatsappGroupUrl} className="outline-button whatsapp-button" target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" />
                  Join
                </a>
              </div>
            </motion.div>

            <motion.div
              className="home-hero-chart"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.08 }}
            >
              <motion.div
                className="home-hero-panel"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.08 }}
              >
                <div className="home-metric-strip">
                  {heroMetrics.map((metric, index) => (
                    <motion.div
                      className="home-metric"
                      key={metric.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.14 + index * 0.04, duration: 0.24 }}
                    >
                      <span className="metric-icon"><Icon name={metric.icon} /></span>
                      <span className="metric-label">{metric.label}</span>
                      <span className="metric-value">{metric.value}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="home-chart-preview">
                  <div>
                    <div className="chart-preview-header">
                      <span className="section-kicker">SGPA Preview</span>
                      <span className="chart-preview-score">9.10 CGPA</span>
                    </div>
                    <svg className="home-chart-svg" viewBox="0 0 268 96" role="img" aria-label="Sample semester performance line chart">
                      <path className="home-chart-grid" d="M0 24H268M0 48H268M0 72H268" />
                      <path className="home-chart-area" d={`M${chartPoints.map(([x, y]) => `${x} ${y}`).join(' L ')} L260 96 L8 96 Z`} />
                      <polyline className="home-chart-line" points={chartPoints.map(([x, y]) => `${x},${y}`).join(' ')} />
                      {chartPoints.map(([x, y], index) => (
                        <circle className="home-chart-dot" cx={x} cy={y} r="3.5" key={`${x}-${index}`} />
                      ))}
                    </svg>
                  </div>
                  <div className="grade-chip-column">
                    {['A+', 'A', 'B', 'C'].map((grade) => (
                      <span className="grade-chip" key={grade}>{grade}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <div className="home-hero-right">
            <motion.div
              className="home-hero-notifications"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <NotificationsPanel
                loading={loading}
                error={error}
                notifications={visibleNotifications}
                onViewAll={openAllNotifications}
              />
            </motion.div>

            <motion.div
              className="home-hero-quick"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <QuickAccessPanel />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page-container section-pad">
          <div className="section-heading-row">
            <div>
              <h2 className="section-title"><Icon name="layers" /> Everything you need, nothing you don't.</h2>
            </div>
          </div>
          <div className="feature-grid">
            {features.map((feature, index) => (
              <motion.div
                className="feature-cell"
                key={feature.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: index * 0.04, duration: 0.28 }}
                whileHover={{ y: -2 }}
              >
                <div className="feature-card-head">
                  <span className="feature-icon"><Icon name={feature.icon} /></span>
                  <span className="feature-index">0{index + 1}</span>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <ul className="feature-list">
                  {feature.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="modal-header">
                <h3 className="modal-title"><Icon name="bell" /> All Notifications</h3>
                <button className="modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                  <Icon name="x" />
                </button>
              </div>
              <div className="modal-body divider-list">
                {loadingAll ? (
                  <div className="empty-state">Loading all notifications...</div>
                ) : (
                  allNotifications.map((item, index) => (
                    <div className="notification-row divider-row" key={`modal-notif-${index}`}>
                      <span className="notification-icon"><Icon name={isNewNotification(item) ? 'bell' : 'clock'} /></span>
                      <p className="notification-text">
                        {item.text || ''}
                        {isNewNotification(item) ? <span className="new-tag">New</span> : null}
                      </p>
                      {item.date ? <span className="notification-date">{item.date}</span> : null}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickAccessPanel() {
  return (
    <div className="hero-quick-panel">
      <div className="hero-quick-header">
        <h2 className="section-title"><Icon name="zap" /> Quick access</h2>
      </div>
      <div className="quick-access-grid home-quick-access-grid hero-quick-grid">
        {quickLinks.map((link, index) => (
          <motion.div
            key={link.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + index * 0.04, duration: 0.24 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
          >
            <Link href={link.href} className="quick-access-card">
              <span className="quick-access-code">
                <Icon name={link.icon} />
              </span>
              <span className="quick-access-copy">
                <span className="quick-link-title">{link.label}</span>
                <span className="quick-link-desc">{link.desc}</span>
              </span>
              <span className="quick-access-action">{link.action}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function readNotificationsCache() {
  return notificationsMemoryCache;
}

function writeNotificationsCache(items) {
  notificationsMemoryCache = items;
}

function isNewNotification(item) {
  const value = item?.is_new ?? item?.isNew ?? item?.new;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());
}

function NotificationsPanel({ loading, error, notifications, onViewAll }) {
  return (
    <div className="hero-notification-panel">
      <div className="hero-notification-header">
        <div>
          <h2 className="section-title"><Icon name="bell" /> Notifications</h2>
        </div>
      </div>
      <div className="divider-list notification-list hero-notification-list">
        {loading ? (
          <>
            {[1, 2, 3].map((n) => (
              <div className="notification-row divider-row" key={`skeleton-${n}`}>
                <span className="notification-icon"><Icon name="clock" /></span>
                <p className="notification-text">Loading notification...</p>
                <span className="notification-date">Just now</span>
              </div>
            ))}
          </>
        ) : null}
        {error ? <div className="error-message">{error}</div> : null}
        {!loading && !error && !notifications.length ? (
          <div className="empty-state">No notifications available.</div>
        ) : null}
        {notifications.map((item, index) => (
          <motion.div
            className="notification-row divider-row"
            key={`${item.text || 'notification'}-${index}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.24 }}
          >
            <span className="notification-icon"><Icon name={isNewNotification(item) ? 'bell' : 'clock'} /></span>
            <p className="notification-text">
              {item.text || ''}
              {isNewNotification(item) ? <span className="new-tag">New</span> : null}
            </p>
            {item.date ? <span className="notification-date">{item.date}</span> : null}
          </motion.div>
        ))}
        {!loading && !error && notifications.length > 0 ? (
          <div className="view-all-row">
            <button type="button" className="view-all-button" onClick={onViewAll}>
              View All Notifications
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Icon({ name }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name) {
  switch (name) {
    case 'calculator':
      return (
        <>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8" />
          <path d="M16 14v4" />
          <path d="M16 10h.01" />
          <path d="M12 10h.01" />
          <path d="M8 10h.01" />
          <path d="M12 14h.01" />
          <path d="M8 14h.01" />
          <path d="M12 18h.01" />
          <path d="M8 18h.01" />
        </>
      );
    case 'graduationCap':
      return (
        <>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </>
      );
    case 'lineChart':
      return (
        <>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m7 15 3.5-4 3 2.5L19 7" />
          <path d="M19 7v4h-4" />
        </>
      );
    case 'fileText':
      return (
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </>
      );
    case 'sparkles':
      return (
        <>
          <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" />
          <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
          <path d="m5 13 .7 1.8L8 15.5l-2.3.7L5 18l-.7-1.8-2.3-.7 2.3-.7Z" />
        </>
      );
    case 'trophy':
      return (
        <>
          <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
          <path d="M8 6H5a3 3 0 0 0 3 3" />
          <path d="M16 6h3a3 3 0 0 1-3 3" />
          <path d="M12 13v4" />
          <path d="M9 21h6" />
          <path d="M10 17h4" />
        </>
      );
    case 'bookOpen':
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21Z" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21Z" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </>
      );
    case 'scan':
      return (
        <>
          <path d="M7 4H5a1 1 0 0 0-1 1v2" />
          <path d="M17 4h2a1 1 0 0 1 1 1v2" />
          <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
          <path d="M17 20h2a1 1 0 0 0 1-1v-2" />
          <path d="M7 12h10" />
        </>
      );
    case 'download':
      return (
        <>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 20h14" />
        </>
      );
    case 'bell':
      return (
        <>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 6-3 8h18c0-2-3-1-3-8" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </>
      );
    case 'whatsapp':
      return (
        <>
          <path d="M5.5 18.5 4 22l3.8-1.2A9 9 0 1 0 2.9 12a8.9 8.9 0 0 0 2.6 6.5Z" />
          <path d="M8.8 8.6c.2-.5.4-.5.7-.5h.6c.2 0 .4.1.5.4l.7 1.7c.1.3 0 .5-.1.6l-.5.6c.8 1.4 1.8 2.4 3.2 3.2l.6-.5c.2-.1.4-.2.6-.1l1.8.8c.2.1.4.3.4.5v.6c0 .3-.1.6-.5.8-.6.3-1.4.5-2.5.2-3-.8-5.4-3.1-6.2-6.1-.3-1.1-.1-1.8.2-2.2Z" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </>
      );
    case 'zap':
      return <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />;
    case 'layers':
      return (
        <>
          <path d="m12 3 9 5-9 5-9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </>
      );
    case 'x':
      return (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="8" />;
  }
}
