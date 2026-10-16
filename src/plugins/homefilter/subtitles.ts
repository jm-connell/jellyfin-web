/**
 * The subtitle hook. Called by the HTML video player with the track events it
 * fetched, before any cue is drawn. Each muted word in a cue becomes `[...]`.
 * The subtitle file and the title file stay as they are.
 */

import { getActivePlan } from './manager';
import { rewriteCueText, type PlaybackPlan } from './plan';

interface TrackEvent {
    Text?: string | null
    StartPositionTicks?: number
    EndPositionTicks?: number
}

interface SubtitleData {
    TrackEvents?: TrackEvent[] | null
}

/** Rewrites the cue text in place. */
export function rewriteTrackEvents(data: SubtitleData, plan: PlaybackPlan | null = getActivePlan()): void {
    if (!plan || !plan.mutedWords.length || !data.TrackEvents) return;
    for (const event of data.TrackEvents) {
        if (event.Text) event.Text = rewriteCueText(event.Text, plan.mutedWords);
    }
}
