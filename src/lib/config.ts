/** Server-side only (reads process.env). The family's IANA timezone (set FAMILY_TIMEZONE in .env.local and Vercel). Vercel itself runs on UTC. */
export const FAMILY_TZ: string = (() => {
  const tz = process.env.FAMILY_TIMEZONE || process.env.Family_Timezone || "America/Denver";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    console.error(`Invalid FAMILY_TIMEZONE "${tz}", falling back to America/Denver`);
    return "America/Denver";
  }
})();
