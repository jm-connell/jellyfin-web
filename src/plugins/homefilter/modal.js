/**
 * The filter modal on a title's page. Lists the flags actually detected on the
 * title, under the three groups, with the Default and the Selection applied.
 * Saving writes a Selection; "Return to default" clears it. Both take effect on
 * the next start of the title.
 */

import escapeHtml from 'escape-html';

import dialogHelper from 'components/dialogHelper/dialogHelper';
import globalize from 'lib/globalize';

import 'elements/emby-checkbox/emby-checkbox';
import 'elements/emby-button/emby-button';
import 'elements/emby-button/paper-icon-button-light';
import 'components/formdialog.scss';

import { isFlagOn } from './plan';
import { clearSelection, fetchTitleSpans, hasSelection, readSelection, writeSelection } from './source';
import template from './modal.template.html';

const SEX_AND_NUDITY = ['immodest clothing', 'nudity', 'implied sex', 'sex without nudity', 'sex with nudity'];
const VIOLENCE = ['fighting', 'graphic violence', 'gore', 'sexual violence'];

function unique(values) {
    return [...new Set(values)];
}

function groupsFor(spans) {
    const visualFlags = unique(spans.visual.flatMap(span => span.flags));
    const words = unique(spans.words.map(word => word.word));
    const groups = [];
    if (!spans.audioOnly) {
        groups.push({ name: 'Sex and nudity', flags: SEX_AND_NUDITY.filter(flag => visualFlags.includes(flag)) });
        groups.push({ name: 'Violence', flags: VIOLENCE.filter(flag => visualFlags.includes(flag)) });
    }
    groups.push({ name: 'Language', flags: [...words].sort((a, b) => a.localeCompare(b)) });
    return groups.filter(group => group.flags.length);
}

function renderGroups(container, spans, selection) {
    let html = '';
    for (const group of groupsFor(spans)) {
        html += `<h3 class="checkboxListLabel" style="margin-top:1em;">${escapeHtml(group.name)}</h3>`;
        html += '<div class="checkboxList paperList checkboxList-paperList">';
        for (const flag of group.flags) {
            const on = isFlagOn(flag, spans.default, selection);
            const mark = spans.default[flag] || 'off';
            const hint = mark === 'hard' ? ' (hard)' : '';
            html += '<label class="checkboxContainer">'
                + `<input is="emby-checkbox" type="checkbox" data-flag="${escapeHtml(flag)}"${on ? ' checked' : ''} />`
                + `<span>${escapeHtml(flag)}${hint}</span>`
                + '</label>';
        }
        html += '</div>';
    }
    container.innerHTML = html;
}

function statusFor(spans, itemId) {
    const nothing = !spans.visual.length && !spans.words.length;
    const parts = [];
    if (spans.audioOnly) parts.push('Audio-only title.');
    if (nothing) parts.push('Nothing found to filter.');
    else parts.push('Checked flags are skipped or muted on the next start.');
    if (hasSelection(itemId)) parts.push('This title has been customized.');
    return parts.join(' ');
}

export async function show(item) {
    const spans = await fetchTitleSpans(item.Id);

    const dlg = dialogHelper.createDialog({ removeOnClose: true, size: 'small' });
    dlg.classList.add('formDialog');
    dlg.innerHTML = globalize.translateHtml(template);

    const status = dlg.querySelector('.homefilterStatus');
    const groups = dlg.querySelector('.homefilterGroups');

    if (!spans) {
        status.textContent = 'Not analyzed yet.';
        dlg.querySelector('.formDialogFooter').classList.add('hide');
    } else {
        status.textContent = statusFor(spans, item.Id);
        renderGroups(groups, spans, readSelection(item.Id));
    }

    dialogHelper.open(dlg);

    dlg.querySelector('.btnCancel').addEventListener('click', () => dialogHelper.close(dlg));
    dlg.querySelector('.btnReturnToDefault').addEventListener('click', () => {
        clearSelection(item.Id);
        dialogHelper.close(dlg);
    });
    dlg.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        const selection = {};
        for (const input of dlg.querySelectorAll('input[data-flag]')) {
            selection[input.dataset.flag] = input.checked;
        }
        writeSelection(item.Id, selection);
        dialogHelper.close(dlg);
        return false;
    });
}

export default { show };
