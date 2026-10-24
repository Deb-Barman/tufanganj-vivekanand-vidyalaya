/** How complete a profile is (0–100) and what is still missing — shown as "Portfolio strength" on My profile. */

export function strength(d: { headline: string; about: string; quote: string; career_goal: string; city: string; talents: string[]; skills: unknown[]; project_list: unknown[]; achievement_items: unknown[]; social_links: Record<string, string> }, hasPhoto: boolean) {
  const items: [string, boolean][] = [
    ["a photo", hasPhoto], ["a headline", !!d.headline.trim()], ["an “About me”", d.about.trim().length >= 40], ["a favourite quote", !!d.quote.trim()],
    ["where you live", !!d.city.trim()], ["what you want to become", !!d.career_goal.trim()], ["3+ skills", d.skills.length + d.talents.length >= 3],
    ["a project", d.project_list.length >= 1], ["an achievement", d.achievement_items.length >= 1], ["a social link", Object.values(d.social_links).some((v) => v.trim())],
  ];
  const done = items.filter(([, ok]) => ok).length;
  return { percent: Math.round((done / items.length) * 100), missing: items.filter(([, ok]) => !ok).map(([n]) => n) };
}
