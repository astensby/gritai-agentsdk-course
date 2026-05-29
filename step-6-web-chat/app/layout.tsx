import type { ReactNode } from "react";

export const metadata = {
  title: "Workshop Agent",
  description: "Step 6 — the workshop agent behind a web UI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#0b0d10",
          color: "#e7eaee",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
