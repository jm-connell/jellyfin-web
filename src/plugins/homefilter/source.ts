/**
 * Where the Player gets a title's spans and keeps the viewer's Selection.
 *
 * Vertical slice: spans are a static JSON file under the web root, and the
 * Selection lives in this browser's localStorage. The analysis container
 * replaces both when it exists; the Player's hook points do not change.
 */

import type { Selection, TitleSpans } from './plan';

/** Relative to the web root. The analysis container will serve this route instead. */
const SPANS_BASE_URL = 'homefilter/titles/';

const SELECTION_KEY_PREFIX = 'homefilter.selection.';

/** The span list for a title, or null when the title has none (not analyzed, excluded, or no spans). */
export async function fetchTitleSpans(itemId: string): Promise<TitleSpans | null> {
    try {
        const response = await fetch(`${SPANS_BASE_URL}${itemId}.json`, { cache: 'no-store' });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return await response.json() as TitleSpans;
    } catch (err) {
        console.warn('[Homefilter] no spans for title', itemId, err);
        return null;
    }
}

export function readSelection(itemId: string): Selection {
    try {
        const raw = localStorage.getItem(SELECTION_KEY_PREFIX + itemId);
        return raw ? JSON.parse(raw) as Selection : {};
    } catch {
        return {};
    }
}

export function writeSelection(itemId: string, selection: Selection): void {
    localStorage.setItem(SELECTION_KEY_PREFIX + itemId, JSON.stringify(selection));
}

export function clearSelection(itemId: string): void {
    localStorage.removeItem(SELECTION_KEY_PREFIX + itemId);
}

export function hasSelection(itemId: string): boolean {
    return localStorage.getItem(SELECTION_KEY_PREFIX + itemId) !== null;
}
