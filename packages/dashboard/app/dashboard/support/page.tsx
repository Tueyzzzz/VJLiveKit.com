'use client';

import { useCallback } from 'react';
import { PageHeader } from '@/components/ui';
import { SupportChat, type SupportMsg } from '@/components/SupportChat';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** แชทแจ้งปัญหากับทีมงาน (แอดมินตอบจากหลังบ้าน) */
export default function SupportPage() {
  const t = useT();
  const load = useCallback(async () => {
    const r = await api<{ msgs: SupportMsg[] }>('/api/support');
    window.dispatchEvent(new Event('vjl-support-read'));
    return r.msgs;
  }, []);
  const send = useCallback(async (b: { text: string; img?: string }) => { await api('/api/support', { method: 'POST', body: b }); }, []);
  return (
    <div>
      <PageHeader title={t('แจ้งปัญหา / แชทกับทีมงาน')} description={t('เจอบัก ใช้งานไม่เป็น หรืออยากได้ฟีเจอร์ใหม่ พิมพ์บอกได้เลย แนบรูปหน้าจอได้ ทีมงานตอบกลับที่นี่ (มีตัวเลขแจ้งที่เมนู)')} />
      <SupportChat load={load} send={send} me="user" />
    </div>
  );
}
