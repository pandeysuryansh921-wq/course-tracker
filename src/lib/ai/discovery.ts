export interface DiscoveredResource {
  title: string;
  url: string;
  description?: string;
  type: 'video' | 'article' | 'documentation' | 'tool';
}

/**
 * Searches the web using user's Tavily Search API key for verified educational URLs and docs.
 */
export async function searchTavily(query: string, apiKey: string): Promise<DiscoveredResource[]> {
  try {
    if (!apiKey) return [];
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} tutorial documentation guide`,
        search_depth: 'basic',
        max_results: 3
      })
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((r: any) => ({
      title: r.title || 'Educational Reference',
      url: r.url,
      description: r.content?.substring(0, 160),
      type: 'documentation' as const
    }));
  } catch (err) {
    console.warn('[Discovery] Tavily search error:', err);
    return [];
  }
}

/**
 * Searches YouTube Data API v3 using user's API key for tutorials and lectures.
 */
export async function searchYouTube(query: string, apiKey: string): Promise<DiscoveredResource[]> {
  try {
    if (!apiKey) return [];
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q=${encodeURIComponent(query + ' tutorial course')}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) return [];

    return data.items.map((item: any) => ({
      title: item.snippet?.title || 'YouTube Tutorial',
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      description: item.snippet?.description?.substring(0, 160),
      type: 'video' as const
    }));
  } catch (err) {
    console.warn('[Discovery] YouTube search error:', err);
    return [];
  }
}

/**
 * Searches GitHub for top repositories, code examples, or assignments.
 */
export async function searchGitHub(query: string, token?: string): Promise<DiscoveredResource[]> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'DegreeTrack-Client'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=3`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) return [];

    return data.items.map((repo: any) => ({
      title: repo.full_name || repo.name,
      url: repo.html_url,
      description: repo.description?.substring(0, 160),
      type: 'tool' as const
    }));
  } catch (err) {
    console.warn('[Discovery] GitHub search error:', err);
    return [];
  }
}
