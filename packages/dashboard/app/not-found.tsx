import Link from 'next/link';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-6xl text-gradient">404</p>
        <p className="mt-2 text-muted">ไม่พบหน้านี้</p>
        <Link href="/" className="mt-6 inline-block"><Button variant="secondary">กลับหน้าแรก</Button></Link>
      </div>
    </div>
  );
}
