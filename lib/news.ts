import { XMLParser } from "fast-xml-parser";

export interface NewsItem {
  title: string;
  source: string;
  date: string;
}

/** Searches Google News (RSS) for recent headlines. No API key needed. */
export async function searchNews(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SprintoOutreachBot/0.1 (+educational demo)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];
    return list.slice(0, 5).map((it: any) => ({
      title: String(it.title ?? ""),
      source: String(it.source?.["#text"] ?? it.source ?? ""),
      date: String(it.pubDate ?? ""),
    }));
  } catch {
    return [];
  }
}
