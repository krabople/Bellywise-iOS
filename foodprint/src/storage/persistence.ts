import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { emptyDiary, parseDiary, type SavedDiary } from './schema';
import { initializeCipherConnection } from './cipherSetup';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
let writes: Promise<void> = Promise.resolve();
const ACTIVE_DIARY_KEY = 'food-diary-active-database';
const legacyDatabase = { name: 'food-diary.db', keyName: 'food-diary-encryption-key' };
const randomHex = async (bytes: number) => Array.from(await Crypto.getRandomBytesAsync(bytes), x => x.toString(16).padStart(2, '0')).join('');

async function openEncryptedDatabase(name: string, keyName: string) {
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    key = await randomHex(32);
    await SecureStore.setItemAsync(keyName, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await initializeCipherConnection(db, key);
    return db;
  } catch (error) {
    try { await db.closeAsync(); } catch { /* Preserve the original initialization error. */ }
    throw error;
  }
}

async function open() {
  if (!database) database = (async () => {
    const active = await SecureStore.getItemAsync(ACTIVE_DIARY_KEY);
    const target = active && /^[0-9a-f]{16}$/.test(active)
      ? { name: `food-diary-${active}.db`, keyName: `food-diary-encryption-key-${active}` }
      : legacyDatabase;
    return openEncryptedDatabase(target.name, target.keyName);
  })().catch(error => { database = undefined; throw error; });
  return database;
}

/** Start a separate diary without deleting or overwriting the unreadable database. */
export async function startFreshDiary(): Promise<SavedDiary> {
  await writes;
  const id = await randomHex(8);
  const target = { name: `food-diary-${id}.db`, keyName: `food-diary-encryption-key-${id}` };
  const db = await openEncryptedDatabase(target.name, target.keyName);
  try {
    await SecureStore.setItemAsync(ACTIVE_DIARY_KEY, id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
  database = Promise.resolve(db);
  return emptyDiary();
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
