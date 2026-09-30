// Preserve keyboard focus and text selection when a widget's view is patched.
export function captureFocus(root) {
  const element = document.activeElement;
  if (!root.contains(element)) return null;
  const path = [];
  let node = element;
  while (node !== root) {
    path.unshift([...node.parentElement.children].indexOf(node));
    node = node.parentElement;
  }
  return {
    path, task: element.dataset.task, start: element.selectionStart, end: element.selectionEnd, direction: element.selectionDirection
  };
}
export function restoreFocus(root, saved) {
  if (!saved) return;
  const element = saved.task ? root.querySelector(`[data-task="${saved.task}"]`) : saved.path.reduce((node, index) => node?.children[index], root);
  element?.focus({
    preventScroll: true
  });
  if (element?.setSelectionRange && saved.start != null) {
    try {
      element.setSelectionRange(saved.start, saved.end, saved.direction);
    }
    catch {
      /* Number inputs have no text selection. */
    }
  }
}
