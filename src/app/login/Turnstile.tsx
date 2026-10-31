"use client";

import Script from "next/script";

// Cloudflare Turnstile (free captcha). Only rendered when a site key is configured;
// enable it in Supabase Auth > Attack Protection with the matching secret.
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} />
    </>
  );
}
