import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'JNTUK UCEN Results Portal',
  description: 'Public results portal for JNTUK UCEN students.',
  icons: {
    icon: [
      { url: '/images/favicon-light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
      { url: '/images/favicon-dark.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' }
    ]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var storedTheme = localStorage.getItem('jntuk-theme');
                var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = storedTheme || (systemDark ? 'dark' : 'light');
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme;
              } catch (_) {}
            `
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
