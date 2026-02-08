export function getFaviconUrl(url: string, size: number = 16): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return "";
  }
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
