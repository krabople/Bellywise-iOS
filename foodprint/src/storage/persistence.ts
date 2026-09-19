import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { emptyDiary, parseDiary, type SavedDiary } from './schema';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
let writes: Promise<void> = Promise.resolve();
async function open() {
  if (!database) database = (async () => {
    const db = await SQLite.openDatabaseAsync('food-diary.db');
    try {
      const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
      if (!cipher?.cipher_version) {
        throw new Error('This app needs its native development or TestFlight build for encrypted diary storage. Expo Go is not supported.');
      }
      let key = await SecureStore.getItemAsync('food-diary-encryption-key');
      if (!key) {
        key = Array.from(await Crypto.getRandomBytesAsync(32), x => x.toString(16).padStart(2, '0')).join('');
        await SecureStore.setItemAsync('food-diary-encryption-key', key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      }
      if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('The diary encryption key could not be read.');
      await db.execAsync(`PRAGMA key = "x'${key}'"; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS diary (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL);`);
      return db;
    } catch (error) {
      try { await db.closeAsync(); } catch { /* Preserve the original initialization error. */ }
      throw error;
    }
  })().catch(error => { database = undefined; throw error; });
  return database;
}

export async function loadDiary(): Promise<SavedDiary> {
  await writes;
  const db = await open();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM diary WHERE id = 1');
  return row ? parseDiary(row.value) : emptyDiary();
}

export async function saveDiary(state: SavedDiary) {
  const snapshot = JSON.stringify(state);
  const write = writes.then(async () => {
    const db = await open();
    await db.runAsync('INSERT INTO diary (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value', snapshot);
  });
  writes = write.catch(() => {});
  await write;
}
