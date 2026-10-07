'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui';
import { useT } from '@/lib/i18n';

/** ช่องรหัสผ่าน + ปุ่มรูปตา กดดู/ซ่อนรหัสผ่าน */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const t = useT();
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-10" />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t('ซ่อนรหัสผ่าน') : t('แสดงรหัสผ่าน')}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-ink">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
