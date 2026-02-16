import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { cookieToInitialState } from "wagmi";

import { Providers } from "./providers";
import { getWagmiConfig } from "@/lib/wagmi-config";

import "./globals.css";

export const metadata: Metadata = {
  title: "Shape of Life",
  description: "Spectator-first Conway Arena on Shape L2",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const initialState = cookieToInitialState(getWagmiConfig(), (await headers()).get("cookie"));

  return (
    <html lang="en" className="dark">
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
