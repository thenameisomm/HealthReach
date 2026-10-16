import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "HealthReach AI — culturally intelligent health outreach",
  description:
    "Plan community health campaigns with cultural intelligence, verified venue data, and AI-assisted planning. No personal health data collected.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* App Router has no _document; General Sans (Fontshare) is not in next/font/google, so links with system fallbacks are correct (rule disabled in .eslintrc.json). */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@600,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:p-2 link"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <footer className="border-t border-line mt-16">
          <div className="mx-auto max-w-[1280px] px-6 py-8 text-[13px] text-secondary">
            <p>
              HealthReach AI · Cultural signals by Qloo (taste affinity only —
              never diagnoses or health-need data). Venue data © OpenStreetMap
              contributors (ODbL). AI outputs are drafts requiring professional
              review. We collect aggregate counts only — never personal health
              data.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
