export function isCloudflareChallengeHtml(body: string): boolean {
  if (!body) return false;
  const s = body.toLowerCase();
  return (
    s.includes("just a moment") ||
    s.includes("_cf_chl_opt") ||
    s.includes("cdn-cgi/challenge-platform")
  );
}

