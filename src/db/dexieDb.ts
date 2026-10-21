import Dexie, { type Table } from 'dexie';
import type { PageRecord, DocumentSession } from '../types/scanner';

export interface AppSetting {
  key: string;
  value: any;
}

export class ScannerDatabase extends Dexie {
  pages!: Table<PageRecord, string>;
  sessions!: Table<DocumentSession, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('ScannerProEduDB');
    this.version(1).stores({
      pages: 'id, captureId, documentId, status, pageNumber, createdAt',
      sessions: 'id, title, createdAt, updatedAt',
      settings: 'key'
    });
  }
}

export const db = new ScannerDatabase();

export async function saveDraftPage(page: PageRecord): Promise<void> {
  await db.pages.put(page);
}

export async function getCommittedPages(): Promise<PageRecord[]> {
  const pages = await db.pages.where('status').equals('committed').sortBy('pageNumber');
  return pages;
}

export async function getAllPages(): Promise<PageRecord[]> {
  return await db.pages.orderBy('pageNumber').toArray();
}

export async function deletePageById(id: string): Promise<void> {
  await db.pages.delete(id);
}

export async function clearAllPages(): Promise<void> {
  await db.pages.clear();
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const record = await db.settings.get(key);
  return record ? (record.value as T) : defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
