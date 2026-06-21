import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vouch - payments that vouch for themselves",
  description:
    "Every payment Vouch handles is judged by an AI running inside a sealed TEE enclave on 0G Compute. The reasoning, the verdict, and the cryptographic proof live on 0G Storage and 0G Chain, and anyone can re-check them with one click. Don't trust us. Check the receipts.",
  metadataBase: new URL("https://vouch.unitynodes.com"),
  openGraph: {
    title: "Vouch - payments that vouch for themselves",
    description:
      "AI-judged payments on 0G. Every verdict is attested in a TEE and re-checkable on-chain. Don't trust us. Check the receipts.",
    url: "https://vouch.unitynodes.com",
    siteName: "Vouch",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
