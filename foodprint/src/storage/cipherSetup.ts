import type * as SQLite from 'expo-sqlite';

export async function initializeCipherConnection(db: Pick<SQLite.SQLiteDatabase, 'execAsync' | 'getFirstAsync'>, key: string) {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('The diary encryption key could not be read.');
  // Keying must be the first SQLite operation, including before capability checks.
  await db.execAsync(`PRAGMA key = "x'${key}'"`);
  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) {
    throw new Error('This app needs its native development or TestFlight build for encrypted diary storage. Expo Go is not supported.');
  }
  await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS diary (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL);');
}
