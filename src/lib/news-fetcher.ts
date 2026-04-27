/**
 * News Fetching Utility
 * 
 * Fetches recent macro-economic news via Google News RSS.
 * We use simple regex parsing to avoid adding heavy XML dependencies.
 */

export async function fetchMacroNews(limit: number = 8): Promise<string[]> {
  try {
    const query = encodeURIComponent("Nigeria Economy OR Africa Macro OR CBN OR Interest Rates OR Inflation");
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-NG&gl=NG&ceid=NG:en`;
    
    // Add caching so we don't spam Google News on every single reload
    const res = await fetch(url, { next: { revalidate: 1800 } }); 
    if (!res.ok) {
      console.error("Google News RSS returned:", res.status);
      return [];
    }
    
    const xml = await res.text();
    
    // Google News RSS structure has <item> blocks containing <title>
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    
    const headlines: string[] = [];
    
    for (const item of itemMatches) {
      if (headlines.length >= limit) break;
      const titleMatch = item.match(/<title>(.*?)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        // Strip out CDATA and unescape HTML entities
        let cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
        cleanTitle = cleanTitle
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");
        
        // Remove the source from the end (e.g. " - Reuters") if you prefer
        // cleanTitle = cleanTitle.split(' - ')[0]; 
        
        headlines.push(cleanTitle);
      }
    }
    
    console.log(`Fetched ${headlines.length} news headlines for context.`);
    return headlines;
  } catch (e) {
    console.error("Failed to fetch macro news:", e);
    return [];
  }
}
