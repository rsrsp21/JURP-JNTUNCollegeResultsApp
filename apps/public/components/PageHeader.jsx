import { motion } from 'framer-motion';
import UiIcon from '@/components/UiIcon';

export default function PageHeader({ title, description, icon, children }) {
  return (
    <section className="page-hero">
      <div className="page-container page-hero-inner">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="hero-title">
            {icon ? <UiIcon name={icon} className="hero-title-icon" /> : null}
            {title}
          </h1>
          {description ? <p className="hero-description">{description}</p> : null}
          {children ? <div className="hero-actions">{children}</div> : null}
        </motion.div>
      </div>
    </section>
  );
}
