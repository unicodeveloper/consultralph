const STORAGE_KEY = "consulting_research_usage";

interface UsageData {
  researchCount: number;
}

const LIMITS = {
  researchCount: 3,
};

function getUsageData(): UsageData {
  if (typeof window === "undefined") {
    return { researchCount: 0 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return { researchCount: 0 };
}

function saveUsageData(data: UsageData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function incrementResearchCount(): number {
  const data = getUsageData();
  data.researchCount += 1;
  saveUsageData(data);
  return data.researchCount;
}

export function hasReachedLimit(): boolean {
  const data = getUsageData();
  return data.researchCount >= LIMITS.researchCount;
}

export function getUsageCounts(): UsageData {
  return getUsageData();
}

export function getRemainingResearches(): number {
  const data = getUsageData();
  return Math.max(0, LIMITS.researchCount - data.researchCount);
}

export function clearUsage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
