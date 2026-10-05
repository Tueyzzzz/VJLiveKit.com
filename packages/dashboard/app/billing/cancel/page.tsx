import Link from 'next/link';
import { Button, Card } from '@/components/ui';

export default function BillingCancel() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="max-w-md p-8 text-center">
        <h1 className="font-display text-2xl">ยกเลิกการชำระเงิน</h1>
        <p className="mt-2 text-sm text-muted">ยังไม่มีการตัดเงิน กลับไปเลือกแพลนใหม่ได้ทุกเมื่อ</p>
        <Link href="/dashboard/billing/" className="mt-6 inline-block"><Button variant="secondary">กลับไปหน้าแพลน</Button></Link>
      </Card>
    </div>
  );
}
