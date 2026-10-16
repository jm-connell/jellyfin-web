import { describe, expect, it } from 'vitest';

import { buildPlan, joinRanges, rangeAt, rewriteCueText, subtractRanges, type TitleSpans } from './plan';

const spans: TitleSpans = {
    itemId: 'test',
    visual: [
        { start: 5, end: 8, flags: ['nudity'] },
        { start: 9.5, end: 12, flags: ['fighting'] },
        { start: 20, end: 22, flags: ['gore'] }
    ],
    words: [
        { start: 6.2, end: 6.7, word: 'bastard' },
        { start: 11.8, end: 12.4, word: 'damn' },
        { start: 30, end: 30.5, word: 'bastard' },
        { start: 31, end: 31.4, word: 'oh my God' }
    ],
    default: { nudity: 'soft', fighting: 'soft', gore: 'off', bastard: 'soft', damn: 'soft', 'oh my God': 'off' }
};

describe('buildPlan', () => {
    it('joins skipped spans across a hole of two seconds or less, including across flags', () => {
        const plan = buildPlan(spans, {});
        expect(plan.jumps).toEqual([{ start: 5, end: 12 }]);
    });

    it('leaves a span whose flag is off, and it keeps its neighbours apart', () => {
        const plan = buildPlan(spans, { fighting: false });
        expect(plan.jumps).toEqual([{ start: 5, end: 8 }]);
    });

    it('turns on a flag the default leaves off', () => {
        const plan = buildPlan(spans, { gore: true });
        expect(plan.jumps).toEqual([{ start: 5, end: 12 }, { start: 20, end: 22 }]);
    });

    it('needs no mute for a word wholly inside a jump', () => {
        const plan = buildPlan(spans, {});
        expect(plan.mutes.find(m => m.start === 6.2)).toBeUndefined();
    });

    it('mutes only the part of a word that plays when it sticks out of a jump', () => {
        const plan = buildPlan(spans, {});
        expect(plan.mutes).toContainEqual({ start: 12, end: 12.4 });
    });

    it('mutes the whole word when nothing is skipped', () => {
        const plan = buildPlan(spans, { nudity: false, fighting: false });
        expect(plan.mutes).toContainEqual({ start: 6.2, end: 6.7 });
    });

    it('lists each muted word once for the subtitle', () => {
        const plan = buildPlan(spans, {});
        expect([...plan.mutedWords].sort((a, b) => a.localeCompare(b))).toEqual(['bastard', 'damn']);
    });
});

describe('ranges', () => {
    it('joinRanges merges overlaps and small holes', () => {
        expect(joinRanges([{ start: 0, end: 1 }, { start: 2.5, end: 3 }, { start: 6, end: 7 }], 2))
            .toEqual([{ start: 0, end: 3 }, { start: 6, end: 7 }]);
    });

    it('subtractRanges splits around a cut', () => {
        expect(subtractRanges({ start: 0, end: 10 }, [{ start: 2, end: 4 }, { start: 9, end: 12 }]))
            .toEqual([{ start: 0, end: 2 }, { start: 4, end: 9 }]);
    });

    it('rangeAt contains the start and not the end', () => {
        const ranges = [{ start: 1, end: 2 }];
        expect(rangeAt(ranges, 1)).toEqual(ranges[0]);
        expect(rangeAt(ranges, 2)).toBeUndefined();
    });
});

describe('rewriteCueText', () => {
    it('shows a muted word as [...] and keeps the rest of the cue', () => {
        expect(rewriteCueText('You bastard!', ['bastard'])).toBe('You [...]!');
    });

    it('treats an inflection as the same word, without regard to case', () => {
        expect(rewriteCueText('Those Bastards again', ['bastard'])).toBe('Those [...] again');
    });

    it('leaves a compound alone', () => {
        expect(rewriteCueText('a damnable idea', ['damn'])).toBe('a damnable idea');
    });

    it('mutes a phrase as one [...] and does not also mute its inner word', () => {
        expect(rewriteCueText('Oh my God, no', ['God', 'oh my God'])).toBe('[...], no');
    });

    it('shows [...] twice for two muted words in one cue', () => {
        expect(rewriteCueText('Damn you, bastard', ['damn', 'bastard'])).toBe('[...] you, [...]');
    });
});
