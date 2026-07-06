import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import React from 'react';

// Registers the service worker that makes the web build installable (PWA).
const swRegister = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

// Web-only: configures the root HTML for every page during static rendering.
export default function Root({ children }: { children: React.ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>Safeco Taxi Service</title>
        <meta name="description" content="Taxi fleet management · Port Moresby" />
        <meta name="theme-color" content="#1E2A4A" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* Disable body scrolling on web so ScrollView works like native. */}
        <ScrollViewStyleReset />

        {/* The design system draws its own focus ring (navy border swap on
            the Input frame) — drop the browser's default black outline. */}
        <style
          dangerouslySetInnerHTML={{
            __html: 'input:focus, textarea:focus, select:focus { outline: none; }',
          }}
        />

        {headNodes}

        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
