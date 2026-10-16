/**
 * Applies a Homefilter plan to the playing title: the jump past a skipped span
 * and the mute inside the playing part of a word span.
 *
 * Mirrors MediaSegmentManager's shape (a PlaybackSubscriber bound to the
 * playback manager) but reads Homefilter spans, not media segments, and has no
 * one-second floor and no per-type setting.
 */

import type { PlaybackManager } from 'components/playback/playbackmanager';
import type { PlayerState } from 'types/playbackStopInfo';
import type { Event } from 'utils/events';

import { PlaybackSubscriber } from 'apps/legacy/features/playback/utils/playbackSubscriber';

import { buildPlan, rangeAt, type PlaybackPlan } from './plan';
import { fetchTitleSpans, readSelection } from './source';

/** How often the mute clock looks at the playhead. `timeupdate` alone fires about four times a second, too slow for a word. */
const MUTE_CLOCK_MS = 40;

/** The plan for the title now playing, read by the subtitle hook. */
let activePlan: PlaybackPlan | null = null;

export function getActivePlan(): PlaybackPlan | null {
    return activePlan;
}

class HomefilterManager extends PlaybackSubscriber {
    private itemId: string | null = null;
    private plan: PlaybackPlan | null = null;
    private clock: ReturnType<typeof setInterval> | null = null;
    /** True while the silence is one Homefilter started. A mute the viewer set is left alone. */
    private ownsMute = false;

    onPlayerPlaybackStart(_e: Event, state: PlayerState) {
        this.reset();
        const itemId = state.NowPlayingItem?.Id;
        if (!itemId) return;
        this.itemId = itemId;

        void fetchTitleSpans(itemId).then(spans => {
            // Playback moved on while the spans were loading
            if (this.itemId !== itemId) return;
            if (!spans) {
                console.info('[Homefilter] title has no spans; playing unfiltered', itemId);
                return;
            }
            this.plan = buildPlan(spans, readSelection(itemId));
            activePlan = this.plan;
            console.info('[Homefilter] plan', this.plan);
            this.startClock();
        });
    }

    onPlayerPlaybackStop() {
        this.reset();
    }

    onPlayerTimeUpdate() {
        this.tick();
    }

    private startClock() {
        this.stopClock();
        this.clock = setInterval(() => this.tick(), MUTE_CLOCK_MS);
    }

    private stopClock() {
        if (this.clock) clearInterval(this.clock);
        this.clock = null;
    }

    private reset() {
        this.stopClock();
        if (this.ownsMute) {
            this.playbackManager.setMute(false, this.player);
            this.ownsMute = false;
        }
        this.itemId = null;
        this.plan = null;
        activePlan = null;
    }

    /** The playhead in seconds. Reads the media element when the HTML video player is active, because the manager's own time is only as fresh as the last `timeupdate`. */
    private currentSeconds(): number {
        const element = document.querySelector<HTMLMediaElement>('video.htmlvideoplayer');
        if (element) return element.currentTime;
        return this.playbackManager.currentTime(this.player) / 1000;
    }

    private tick() {
        const plan = this.plan;
        if (!plan) return;
        const time = this.currentSeconds();

        const jump = rangeAt(plan.jumps, time);
        if (jump) {
            console.debug('[Homefilter] skip %s -> %s', time.toFixed(2), jump.end);
            this.playbackManager.seekMs(jump.end * 1000, this.player);
            return;
        }

        const mute = rangeAt(plan.mutes, time);
        const playerMuted = this.playbackManager.isMuted(this.player);

        if (mute && !this.ownsMute && !playerMuted) {
            console.debug('[Homefilter] mute %s -> %s', mute.start, mute.end);
            this.playbackManager.setMute(true, this.player);
            this.ownsMute = true;
        } else if (!mute && this.ownsMute) {
            // Unmute only a silence Homefilter started. If the viewer unmuted inside it, the viewer wins.
            if (playerMuted) {
                console.debug('[Homefilter] unmute at %s', time.toFixed(2));
                this.playbackManager.setMute(false, this.player);
            }
            this.ownsMute = false;
        }
    }
}

export const bindHomefilterManager = (playbackManager: PlaybackManager) => new HomefilterManager(playbackManager);
