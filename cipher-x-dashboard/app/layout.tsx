import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CIPHER-X | Satellite Change Detection",
  description: "Detect construction, demolition and human-induced land change using multi-temporal Sentinel-2 imagery.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#070B14] text-slate-100 min-h-screen overflow-x-hidden font-[Inter,system-ui,sans-serif]">
        {children}
      </body>
    </html>
  );
}