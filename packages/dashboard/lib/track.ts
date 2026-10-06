/** เรียกตอนสมัครสำเร็จ — นับเป็นคอนเวอร์ชันของโฆษณา */
export function trackSignup() {
  const w = window as unknown as { fbq?: (...a: unknown[]) => void; ttq?: { track: (e: string) => void } };
  try { w.fbq?.('track', 'CompleteRegistration'); } catch { /* ignore */ }
  try { w.ttq?.track('CompleteRegistration'); } catch { /* ignore */ }
}
