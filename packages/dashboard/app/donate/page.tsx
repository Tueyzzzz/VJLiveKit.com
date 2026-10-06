import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DonateClient } from '@/components/DonateClient';

export const metadata: Metadata = { title: 'โดเนทให้วีเจ', description: 'โดเนทผ่านพร้อมเพย์ให้วีเจโดยตรง แล้วชื่อกับข้อความของคุณจะขึ้นจอไลฟ์', robots: { index: false } };

export default function DonatePage() {
  return <Suspense><DonateClient /></Suspense>;
}
