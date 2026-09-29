import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeCipherConnection } from '../src/storage/cipherSetup';

const key = 'a'.repeat(64);

test('a fresh encrypted database is keyed before any SQLite read or table creation', async () => {
  const calls: string[] = [];
  const db = {
    execAsync: async (sql: string) => { calls.push(sql); },
    getFirstAsync: async (sql: string) => { calls.push(sql); return { cipher_version: '4.0.0' }; },
  };
  await initializeCipherConnection(db as never, key);
  assert.deepEqual(calls, [
    `PRAGMA key = "x'${key}'"`,
    'PRAGMA cipher_version',
    'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS diary (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL);',
  ]);
});

test('a build without SQLCipher never creates an unencrypted diary table', async () => {
  const calls: string[] = [];
  const db = {
    execAsync: async (sql: string) => { calls.push(sql); },
    getFirstAsync: async (sql: string) => { calls.push(sql); return null; },
  };
  await assert.rejects(initializeCipherConnection(db as never, key), /Expo Go is not supported/);
  assert.deepEqual(calls, [`PRAGMA key = "x'${key}'"`, 'PRAGMA cipher_version']);
});
