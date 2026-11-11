export interface Rank {
  title: string;
  line: string;
}

export function shownSeconds(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.ceil(seconds);
}

export function formatTime(seconds: number): string {
  const whole = shownSeconds(seconds);
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

export function rankFor(score: number): Rank {
  if (score >= 700) return { title: "庙会传奇", line: "这手法，摊主都想拜师。" };
  if (score >= 350) return { title: "套圈好手", line: "稳、准，还带着风。" };
  if (score >= 150) return { title: "夜市熟客", line: "再来一局，金元宝就在眼前。" };
  if (score >= 40) return { title: "初窥门道", line: "方向对了，力度再大胆一点。" };
  return { title: "路过看客", line: "拖远一点，朝奖品松手。" };
}

export function readNumber(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}
