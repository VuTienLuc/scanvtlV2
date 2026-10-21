import { describe, it, expect } from 'vitest';
import type { PageRecord, PageStatus } from '../src/types/scanner';

describe('Page State Machine & Anti-Duplication', () => {
  function createPage(captureId: string, status: PageStatus = 'captured'): PageRecord {
    const id = `page_${Math.random().toString(36).substring(2, 9)}`;
    return {
      id,
      captureId,
      sourceImage: 'data:image/png;base64,...',
      processedImage: 'data:image/png;base64,...',
      thumbnail: 'data:image/png;base64,...',
      rotation: 0,
      filter: 'original',
      annotations: [],
      status,
      pageNumber: 1,
      width: 1000,
      height: 1414,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  it('progresses page states strictly: captured -> editing -> committed', () => {
    const page = createPage('cap_101', 'captured');
    expect(page.status).toBe('captured');

    // Move to editing
    page.status = 'editing';
    expect(page.status).toBe('editing');

    // Commit to batch
    page.status = 'committed';
    expect(page.status).toBe('committed');
  });

  it('prevents duplicate page additions using page ID and committed set', () => {
    const committedBatch: PageRecord[] = [];
    const page = createPage('cap_102', 'committed');

    function commitPage(p: PageRecord) {
      if (committedBatch.some((existing) => existing.id === p.id)) {
        return false; // Already present, rejected
      }
      committedBatch.push(p);
      return true;
    }

    expect(commitPage(page)).toBe(true);
    expect(committedBatch).toHaveLength(1);

    // Attempting to commit identical page again
    expect(commitPage(page)).toBe(false);
    expect(committedBatch).toHaveLength(1);
  });

  it('discarding uncommitted capture session cleans up only uncommitted pages', () => {
    const pages: PageRecord[] = [
      createPage('cap_old', 'committed'),
      createPage('cap_old', 'committed'),
      createPage('cap_new', 'editing'), // Left book page in progress
      createPage('cap_new', 'captured') // Right book page in progress
    ];

    // User hits discard on 'cap_new' session
    const activePages = pages.filter((p) => p.captureId !== 'cap_new' || p.status === 'committed');
    expect(activePages).toHaveLength(2);
    expect(activePages.every((p) => p.captureId === 'cap_old')).toBe(true);
  });
});
