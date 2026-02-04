/**
 * Research History Management using localStorage
 *
 * Stores research task IDs and metadata for retrieval from Valyu
 */

export interface ResearchHistoryItem {
  id: string; // deepresearch_id from Valyu
  title: string; // research subject/title
  researchType: string; // company, market, competitive, industry, custom
  createdAt: number; // timestamp
  status?: "queued" | "processing" | "completed" | "failed" | "cancelled";
}

const STORAGE_KEY = "consulting_research_history";
const MAX_HISTORY_ITEMS = 50;

/**
 * Get all research history items from localStorage
 */
export function getResearchHistory(): ResearchHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ResearchHistoryItem[];
  } catch (error) {
    console.error("Failed to load research history:", error);
    return [];
  }
}

/**
 * Save a new research item to history
 */
export function saveToHistory(item: Omit<ResearchHistoryItem, "createdAt">): void {
  if (typeof window === "undefined") return;

  try {
    const history = getResearchHistory();

    // Check if this ID already exists
    const existingIndex = history.findIndex((h) => h.id === item.id);

    const newItem: ResearchHistoryItem = {
      ...item,
      createdAt: Date.now(),
    };

    if (existingIndex !== -1) {
      // Update existing item
      history[existingIndex] = { ...history[existingIndex], ...newItem };
    } else {
      // Add to beginning of array
      history.unshift(newItem);
    }

    // Limit history size
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error("Failed to save to research history:", error);
  }
}

/**
 * Update the status of a research item
 */
export function updateHistoryStatus(
  id: string,
  status: ResearchHistoryItem["status"]
): void {
  if (typeof window === "undefined") return;

  try {
    const history = getResearchHistory();
    const index = history.findIndex((h) => h.id === id);

    if (index !== -1) {
      history[index].status = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  } catch (error) {
    console.error("Failed to update research history status:", error);
  }
}

/**
 * Remove a research item from history
 */
export function removeFromHistory(id: string): void {
  if (typeof window === "undefined") return;

  try {
    const history = getResearchHistory();
    const filtered = history.filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to remove from research history:", error);
  }
}

/**
 * Clear all research history
 */
export function clearHistory(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear research history:", error);
  }
}

/**
 * Get a single research item by ID
 */
export function getHistoryItem(id: string): ResearchHistoryItem | undefined {
  const history = getResearchHistory();
  return history.find((h) => h.id === id);
}
