import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Daikin Support Assistant",
  description:
    "RAG-powered support assistant for Daikin products. Ask questions and get answers grounded in official documentation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-scale flex overflow-hidden">
          <Sidebar />
          <main className="flex flex-1 flex-col overflow-hidden bg-chatbg">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
