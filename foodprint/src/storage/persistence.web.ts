import { emptyDiary, parseDiary, type SavedDiary } from './schema';
const KEY = 'food-diary-preview-v1';
export async function loadDiary(): Promise<SavedDiary> {
  const raw = localStorage.getItem(KEY);
  return raw ? parseDiary(raw) : emptyDiary();
}
export async function saveDiary(state: SavedDiary) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export async function startFreshDiary(): Promise<SavedDiary> {
  throw new Error('Device diary recovery is only available in the iOS app.');
}
