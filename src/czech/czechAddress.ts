export interface ZipCity {
  zip: string;
  city: string;
}

/** "110 00 Praha 1" → { zip: "110 00", city: "Praha 1" }; without a leading PSČ the text stays the city. */
export function splitZipCity(text: string): ZipCity {
  const trimmed = text.trim();
  const match = /^(\d{3})\s?(\d{2})\s+(.+)$/.exec(trimmed);
  if (!match) return { zip: '', city: trimmed };
  return { zip: `${match[1]} ${match[2]}`, city: match[3] ?? '' };
}
