/**
 * Homefilter playback plan.
 *
 * Pure functions. Given a title's stored spans, the server Default, and the
 * viewer's Selection, decide which jumps the player makes and which word spans
 * it mutes. Vocabulary follows the Homefilter GLOSSARY: span, flag, skip, mute,
 * default, selection, hole.
 */

/** A mark on a flag in the Default. */
export type DefaultMark = 'hard' | 'soft' | 'off';

/** One visual span: a time range carrying at most one sex-and-nudity flag and at most one violence flag. */
export interface VisualSpan {
    /** Seconds from the start of the title. */
    start: number
    end: number
    flags: string[]
}

/** One word span: the full spoken time of a watch-list word. */
export interface WordSpan {
    start: number
    end: number
    word: string
}

/** The span list for one title, as the analysis container stores it. */
export interface TitleSpans {
    itemId: string
    audioOnly?: boolean
    visual: VisualSpan[]
    words: WordSpan[]
    /** The server Default: a mark on each flag detected on this title. */
    default: Record<string, DefaultMark>
}

/** The viewer's Selection for a title: a flag is on or off. Flags absent fall back to the Default. */
export type Selection = Record<string, boolean>;

export interface TimeRange {
    start: number
    end: number
}

/** What the player does during one play of a title. */
export interface PlaybackPlan {
    /** Jumps, in order. Entering one seeks to its end. */
    jumps: TimeRange[]
    /** The parts of muted word spans that actually play. Entering one silences the mix. */
    mutes: TimeRange[]
    /** Every word that is muted, for the subtitle rewrite. */
    mutedWords: string[]
}

/** A hole of this length or less between two spans the viewer is skipping is inside one jump (ADR-0010). */
export const JOIN_HOLE_SECONDS = 2;

/** Whether a flag is on, from the Selection first and the Default second. */
export function isFlagOn(flag: string, defaults: Record<string, DefaultMark>, selection: Selection): boolean {
    if (flag in selection) return selection[flag];
    const mark = defaults[flag];
    return mark === 'hard' || mark === 'soft';
}

/** The visual spans the viewer is skipping, each range clipped to ascending order. */
function skippedRanges(spans: TitleSpans, selection: Selection): TimeRange[] {
    return spans.visual
        .filter(span => span.flags.some(flag => isFlagOn(flag, spans.default, selection)))
        .map(span => ({ start: span.start, end: span.end }))
        .sort((a, b) => a.start - b.start);
}

/** Merge ranges that overlap or sit within `hole` seconds of each other. */
export function joinRanges(ranges: TimeRange[], hole: number): TimeRange[] {
    const joined: TimeRange[] = [];
    for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
        const last = joined[joined.length - 1];
        if (last && range.start - last.end <= hole) {
            last.end = Math.max(last.end, range.end);
        } else {
            joined.push({ start: range.start, end: range.end });
        }
    }
    return joined;
}

/** The parts of `range` that lie outside every range in `cuts`. */
export function subtractRanges(range: TimeRange, cuts: TimeRange[]): TimeRange[] {
    let remaining: TimeRange[] = [{ ...range }];
    for (const cut of cuts) {
        const next: TimeRange[] = [];
        for (const part of remaining) {
            if (cut.end <= part.start || cut.start >= part.end) {
                next.push(part);
                continue;
            }
            if (cut.start > part.start) next.push({ start: part.start, end: cut.start });
            if (cut.end < part.end) next.push({ start: cut.end, end: part.end });
        }
        remaining = next;
    }
    return remaining;
}

/**
 * Build the plan for one play.
 *
 * Jumps: the skipped visual spans, with a hole of two seconds or less between
 * two of them inside one jump, including when the flags differ.
 *
 * Mutes: each muted word span minus the jumps. A word whose whole span lies
 * inside a jump needs no mute. A word that sticks out is muted only on the part
 * that plays. The stored word span is never changed.
 */
export function buildPlan(spans: TitleSpans, selection: Selection): PlaybackPlan {
    const jumps = joinRanges(skippedRanges(spans, selection), JOIN_HOLE_SECONDS);

    const mutedWordSet = new Set<string>();
    const mutes: TimeRange[] = [];
    for (const word of spans.words) {
        if (!isFlagOn(word.word, spans.default, selection)) continue;
        mutedWordSet.add(word.word);
        for (const part of subtractRanges({ start: word.start, end: word.end }, jumps)) {
            mutes.push(part);
        }
    }

    return {
        jumps,
        mutes: joinRanges(mutes, 0),
        mutedWords: [...mutedWordSet]
    };
}

/** The range in `ranges` that contains `time`, if any. A range contains its start and not its end. */
export function rangeAt(ranges: TimeRange[], time: number): TimeRange | undefined {
    return ranges.find(range => time >= range.start && time < range.end);
}

const INFLECTION_ENDINGS = "(?:s|es|ed|ing|er|'s)?";

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A pattern matching a watch-list word or any of its inflections, as a whole
 * word, without regard to case. A phrase matches across any whitespace. A
 * compound that contains the word does not match, because `\b` requires the
 * word to end there.
 */
export function wordPattern(word: string): RegExp {
    const body = word.trim().split(/\s+/).map(escapeRegExp).join('\\s+');
    return new RegExp(`\\b${body}${INFLECTION_ENDINGS}\\b`, 'gi');
}

/** Show each muted word in a subtitle cue as `[...]`. Everything else in the cue is kept. */
export function rewriteCueText(text: string, mutedWords: string[]): string {
    let result = text;
    // Longer entries first so "oh my God" wins over "God" when both are on the list.
    for (const word of [...mutedWords].sort((a, b) => b.length - a.length)) {
        result = result.replace(wordPattern(word), '[...]');
    }
    return result;
}
