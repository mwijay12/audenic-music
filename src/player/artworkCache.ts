const goodUrls = new Set<string>();
const badUrls = new Set<string>();

export async function validateArtworkUrl(url: string): Promise<boolean> {
  if (!url || url.trim() === "") return false;
  if (goodUrls.has(url)) return true;
  if (badUrls.has(url)) return false;

  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      badUrls.add(url);
      resolve(false);
    }, 3000);

    img.onload = () => {
      clearTimeout(timeout);
      goodUrls.add(url);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      badUrls.add(url);
      resolve(false);
    };
    img.src = url;
  });
}

export async function prefetchArtworkBatch(
  urls: string[],
  batchSize = 5
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const uniqueUrls = [...new Set(urls.filter((u) => u && u.length > 0))];

  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const valid = await validateArtworkUrl(url);
        return [url, valid] as [string, boolean];
      })
    );
    batchResults.forEach(([url, valid]) => results.set(url, valid));

    if (i + batchSize < uniqueUrls.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return results;
}

export function clearArtworkCache(): void {
  goodUrls.clear();
  badUrls.clear();
}
