export default function UiIcon({ name, className = 'ui-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
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
    case 'mail':
      return (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      );
    case 'upload':
      return (
        <>
          <path d="M12 15V4" />
          <path d="m8 8 4-4 4 4" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
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
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
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
        </>
      );
    case 'calendar':
      return (
        <>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
        </>
      );
    case 'branch':
      return (
        <>
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <path d="M8.5 8.5 12 15" />
          <path d="m15.5 8.5-3.5 6.5" />
        </>
      );
    case 'chevronDown':
      return <path d="m6 9 6 6 6-6" />;
    case 'chevronUp':
      return <path d="m18 15-6-6-6 6" />;
    case 'plus':
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case 'x':
      return (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      );
    case 'check':
      return <path d="m5 12 4 4L19 6" />;
    case 'external':
      return (
        <>
          <path d="M14 3h7v7" />
          <path d="M10 14 21 3" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </>
      );
    case 'send':
      return (
        <>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </>
      );
    case 'user':
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      );
    case 'bot':
      return (
        <>
          <rect x="5" y="8" width="14" height="11" rx="3" />
          <path d="M12 4v4" />
          <path d="M9 13h.01" />
          <path d="M15 13h.01" />
          <path d="M10 17h4" />
        </>
      );
    case 'alert':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6" />
          <path d="M12 17h.01" />
        </>
      );
    case 'trend':
      return (
        <>
          <path d="M4 18V6" />
          <path d="M4 18h16" />
          <path d="m7 14 4-4 3 3 5-6" />
          <path d="M19 7v5h-5" />
        </>
      );
    case 'userSearch':
      return (
        <>
          <circle cx="10" cy="8" r="4" />
          <path d="M3 20a7 7 0 0 1 10.5-6.1" />
          <circle cx="17" cy="17" r="3" />
          <path d="m20 20-1.4-1.4" />
        </>
      );
    case 'compare':
      return (
        <>
          <path d="M7 7h11" />
          <path d="m15 4 3 3-3 3" />
          <path d="M17 17H6" />
          <path d="m9 14-3 3 3 3" />
        </>
      );
    case 'bell':
      return (
        <>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 6-3 8h18c0-2-3-1-3-8" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </>
      );
    case 'linkedin':
      return (
        <>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect width="4" height="12" x="2" y="9" />
          <circle cx="4" cy="4" r="2" />
        </>
      );
    case 'twitter':
      return (
        <>
          <path d="M4 4l11.73 16h4.27L8.27 4z" />
          <path d="M4 20l6.77-6.77" />
          <path d="M20 4l-6.77 6.77" />
        </>
      );
    case 'instagram':
      return (
        <>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="8" />;
  }
}
