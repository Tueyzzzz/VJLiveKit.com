import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="VJLiveKit หน้าแรก">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="font-display text-xl text-ink">VJ<span className="text-gradient">LiveKit</span></span>
    </Link>
  );
}
