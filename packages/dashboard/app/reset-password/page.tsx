import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = { title: 'ตั้งรหัสผ่านใหม่', robots: { index: false } };

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
