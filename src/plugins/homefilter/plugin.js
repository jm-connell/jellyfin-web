/**
 * Homefilter: the Player half of the Homefilter companion.
 *
 * Loaded from config.json like every other web plugin. Binding the manager is
 * the only thing the plugin does at load; the subtitle hook and the title-page
 * button are the two other places upstream code calls into this directory.
 */

import { playbackManager } from 'components/playback/playbackmanager';

import { bindHomefilterManager } from './manager';

class HomefilterPlugin {
    constructor() {
        this.name = 'Homefilter';
        this.id = 'homefilter';
        this.type = 'homefilter';
        bindHomefilterManager(playbackManager);
    }
}

export default HomefilterPlugin;
