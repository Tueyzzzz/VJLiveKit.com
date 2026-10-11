import type { PkMvp } from './types.js';

/** ผลแยกฝั่งจากข้อมูล linkMicArmies: คะแนนเรา/คู่แข่ง + ผู้ช่วยอันดับต้น ๆ ของแต่ละฝั่ง */
export interface PkArmiesSnapshot {
  us?: number;
  them: number;
  mvp: PkMvp[]; // ฝั่งเรา 3 อันดับแรก
  themMvp?: PkMvp; // อันดับ 1 ฝั่งคู่แข่ง (คู่แข่งคะแนนสูงสุด)
}

function topOf(list: any[] | undefined, n: number): PkMvp[] {
  const rows: PkMvp[] = [];
  for (const u of list ?? []) {
    const score = Number(u?.score ?? 0);
    const name = String(u?.nickname ?? '').trim();
    if (!name || !Number.isFinite(score) || score <= 0) continue;
    const avatar = u?.avatarThumb?.urlList?.[0] ?? u?.avatarThumb?.url?.[0] ?? '';
    rows.push({ name, score, ...(avatar ? { avatar: String(avatar) } : {}), ...(u?.userIdStr || u?.userId ? { id: String(u.userIdStr || u.userId) } : {}) });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, n);
}

/** แยกฝั่งเรา (hostId) ออกจากคู่แข่ง · ไม่รู้ hostId → us = undefined */
export function extractPkArmies(armies: Record<string, any> | undefined, hostId: string): PkArmiesSnapshot {
  let us: number | undefined, them = 0, mvp: PkMvp[] = [], themMvp: PkMvp | undefined, themBest = -1;
  for (const [id, a] of Object.entries(armies ?? {})) {
    const sc = Number(a?.hostscore ?? 0) || 0;
    if (hostId && (id === hostId || String(a?.anchorIdStr ?? '') === hostId)) { us = sc; mvp = topOf(a?.userArmies, 3); }
    else {
      them = Math.max(them, sc);
      const top = topOf(a?.userArmies, 1)[0];
      if (top && (sc > themBest || !themMvp)) { themMvp = top; themBest = sc; }
    }
  }
  return { us, them, mvp, themMvp };
}
