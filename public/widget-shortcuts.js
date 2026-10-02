const selectors = {
  spotify: '.spotify-form input[name="spotifyUrl"]',
  tasks: '.add-task input[name="task"]',
  note: '.note-document',
  calendar: '.event-form input[name="event"]',
  focus: '[data-start]',
  habits: '.habit-form input[name="name"]',
  links: '.link-form input[name="name"]',
  journal: '.journal-input',
  goal: '[data-goal-step="1"]',
  dates: '.dates-form input[name="name"]'
};
const noteSelections = new Map();
const visitedFields = new WeakSet();

function cards() {
  return [...document.querySelectorAll('#desk .widget')].filter(card => card.offsetParent !== null);
}

function selectionPoint(node, offset, editor) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  let content = element?.closest('[data-block-input]');
  if (!content && node === editor) {
    const blocks = [...editor.querySelectorAll(':scope > .note-block [data-block-input]')];
    if (!blocks.length) return null;
    content = blocks[Math.min(offset, blocks.length - 1)];
    return { block: content.dataset.blockInput, offset: offset >= blocks.length ? content.textContent.length : 0 };
  }
  if (!content) {
    const block = element?.closest('.note-block');
    content = block?.querySelector('[data-block-input]');
    if (content && editor.contains(content)) {
      const after = node === block && offset > [...block.childNodes].indexOf(content);
      return { block: content.dataset.blockInput, offset: after ? content.textContent.length : 0 };
    }
  }
  if (!content || !editor.contains(content)) return null;
  const range = document.createRange();
  range.selectNodeContents(content);
  range.setEnd(node, offset);
  return { block: content.dataset.blockInput, offset: range.toString().length };
}

function rememberNoteSelection() {
  const selection = getSelection();
  if (!selection?.rangeCount) return;
  const node = selection.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const editor = element?.closest('.note-document');
  const card = editor?.closest('#desk .widget');
  if (!card || document.activeElement !== editor) return;
  const anchor = selectionPoint(selection.anchorNode, selection.anchorOffset, editor);
  const focus = selectionPoint(selection.focusNode, selection.focusOffset, editor);
  if (anchor && focus) noteSelections.set(card.dataset.id, { anchor, focus });
}

function resolvePoint(editor, point) {
  const content = [...editor.querySelectorAll('[data-block-input]')].find(node => node.dataset.blockInput === point.block);
  if (!content) return null;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let remaining = point.offset, node;
  while ((node = walker.nextNode())) {
    if (remaining <= node.length) return { node, offset: remaining };
    remaining -= node.length;
  }
  return { node: content, offset: content.childNodes.length };
}

function focusNote(card, editor) {
  const saved = noteSelections.get(card.dataset.id);
  const anchor = saved && resolvePoint(editor, saved.anchor);
  const focus = saved && resolvePoint(editor, saved.focus);
  editor.focus({ preventScroll: true });
  const selection = getSelection();
  if (anchor && focus) {
    selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
  } else {
    const content = [...editor.querySelectorAll('[data-block-input]')].at(-1) || editor;
    const range = document.createRange();
    range.selectNodeContents(content);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function refreshWidgetShortcuts() {
  cards().forEach((card, index) => {
    if (index >= 10) {
      card.removeAttribute('aria-keyshortcuts');
      card.querySelector('.widget-head')?.removeAttribute('title');
      return;
    }
    const shortcut = `Alt+${(index + 1) % 10}`;
    card.setAttribute('aria-keyshortcuts', shortcut);
    const head = card.querySelector('.widget-head');
    if (head) head.title = `${shortcut} · Widget'a geç`;
  });
}

export function installWidgetShortcuts(getWidgetType) {
  document.addEventListener('selectionchange', rememberNoteSelection);
  document.addEventListener('focusin', event => {
    if (event.target.matches('input,textarea')) visitedFields.add(event.target);
  });
  document.addEventListener('keydown', event => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.repeat || event.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;
    const digit = event.code.match(/^(?:Digit|Numpad)([0-9])$/)?.[1] || (/^[0-9]$/.test(event.key) ? event.key : null);
    if (digit === null) return;
    const card = cards()[digit === '0' ? 9 : Number(digit) - 1];
    if (!card) return;
    const target = card.querySelector(selectors[getWidgetType(card.dataset.id)] || '.widget-head') || card.querySelector('.widget-head');
    if (!target) return;
    event.preventDefault();
    rememberNoteSelection();
    if (target.matches('.note-document')) focusNote(card, target);
    else {
      const firstVisit = !visitedFields.has(target);
      target.focus({ preventScroll: true });
      if (firstVisit && target.matches('textarea')) target.setSelectionRange(target.value.length, target.value.length);
    }
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  });
}
