/** 이 도구는 한 사람이 한국에서 쓰는 걸 전제로 하루 경계를 KST(Asia/Seoul)로 고정한다. */
export function todayIsoInSeoul(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
