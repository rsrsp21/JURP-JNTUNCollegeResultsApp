'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import UiIcon from '@/components/UiIcon';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/cgpa', label: 'CGPA' },
  { href: '/results', label: 'Semester Results', aliases: ['/semester_results'] },
  { href: '/ask-ai', label: 'Ask AI' },
  { href: '/toppers', label: 'Toppers' }
];

const adminAppUrl = 'http://localhost:5001/login';
const externalLinks = [
  { href: 'https://jntukucen.ac.in', label: 'Official Website' },
  { href: adminAppUrl, label: 'Admin Portal' }
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme || 'light';
    setTheme(currentTheme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      localStorage.setItem('jntuk-theme', next);
      return next;
    });
  }

  return (
    <div className="site-shell">
      <motion.header
        className="site-header"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="site-header-inner">
          <Link href="/" className="brand-lockup" onClick={() => setOpen(false)}>
            <span className="brand-mark" aria-hidden="true">
              <img className="brand-logo brand-logo-light" src="/images/logo-light.svg" alt="" />
              <img className="brand-logo brand-logo-dark" src="/images/logo-dark.svg" alt="" />
            </span>
            <span className="brand-copy">
              <span className="brand-title">JURP</span>
            </span>
          </Link>

          <div className="header-actions">
            <nav className="desktop-nav" aria-label="Primary navigation">
              {navItems.map((item) => (
                <motion.div
                  key={item.href}
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <Link
                    href={item.href}
                    className={`nav-link ${isActive(pathname, item) ? 'active' : ''}`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <div
                className={`nav-dropdown ${linksOpen ? 'open' : ''}`}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setLinksOpen(false);
                }}
              >
                <button
                  className="nav-link nav-dropdown-trigger"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={linksOpen}
                  onClick={() => setLinksOpen((value) => !value)}
                >
                  Links
                  <UiIcon name="chevronDown" />
                </button>
                <div className="nav-dropdown-menu" role="menu">
                  {externalLinks.map((item) => (
                    <a
                      className="nav-dropdown-link"
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      key={item.href}
                      role="menuitem"
                      onClick={() => setLinksOpen(false)}
                    >
                      <UiIcon name="external" />
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </nav>

            <motion.button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {theme === 'dark' ? (
                  <motion.svg
                    key="sun"
                    className="theme-toggle-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    initial={{ rotate: -45, scale: 0.55, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: 45, scale: 0.55, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="moon"
                    className="theme-toggle-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    initial={{ rotate: 45, scale: 0.55, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: -45, scale: 0.55, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path d="M20.2 14.7A7.4 7.4 0 0 1 9.3 3.8 8.6 8.6 0 1 0 20.2 14.7Z" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </motion.button>

            <motion.button
              className={`mobile-menu-button ${open ? 'open' : ''}`}
              type="button"
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <span className="hamburger-line" aria-hidden="true" />
              <span className="hamburger-line" aria-hidden="true" />
              <span className="hamburger-line" aria-hidden="true" />
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.nav
              className="mobile-nav"
              aria-label="Mobile navigation"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {navItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -10, opacity: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.18 }}
                >
                  <Link
                    href={item.href}
                    className={`mobile-nav-link ${isActive(pathname, item) ? 'active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              {externalLinks.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -10, opacity: 0 }}
                  transition={{ delay: (navItems.length + index) * 0.03, duration: 0.18 }}
                >
                  <a
                    href={item.href}
                    className="mobile-nav-link mobile-external-link"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    <UiIcon name="external" />
                    {item.label}
                  </a>
                </motion.div>
              ))}
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </motion.header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          className="site-main"
          key={pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.main>
      </AnimatePresence>

      <motion.footer
        className="site-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.08 }}
      >
        <div className="site-footer-inner">
          <div>© 2026 JURP - JNTUK UCEN Results Portal</div>
          <div className="footer-creator">
            Created by <span>Sri Ram Sai Pavan Relangi</span>
            <div className="footer-socials">
              <a href="https://linkedin.com/in/sriramsaipavanrelangi" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <UiIcon name="linkedin" />
              </a>
              <a href="https://x.com/sriram_relangi" target="_blank" rel="noreferrer" aria-label="Twitter">
                <UiIcon name="twitter" />
              </a>
              <a href="https://instagram.com/sram_217" target="_blank" rel="noreferrer" aria-label="Instagram">
                <UiIcon name="instagram" />
              </a>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

function isActive(pathname, item) {
  return pathname === item.href || item.aliases?.includes(pathname);
}
