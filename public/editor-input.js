export const clipboardType = 'application/x-mono-note-blocks';
const types = new Set(['text', 'title', 'subtitle', 'bullet', 'check', 'number', 'quote']);
export function readClipboardBlocks(raw) {
  try {
    const blocks = JSON.parse(raw);
    if (!Array.isArray(blocks) || !blocks.length || blocks.length > 2000) return null;
    if (blocks.some(block => !types.has(block.type) || typeof block.text !== 'string')) return null;
    return blocks.map(block => ({
      type: block.type, text: block.text.slice(0, 100000), done: block.done === true, indent: Number.isInteger(block.indent) ? Math.max(0, Math.min(3, block.indent)) : 0
    }));
  }
  catch {
    return null;
  }
}
export function deletionBoundary(text, offset, forward, word = false) {
  const segments = [...new Intl.Segmenter('tr', {
    granularity: word ? 'word' : 'grapheme'
  }).segment(text)];
  if (forward) {
    const remaining = segments.filter(segment => segment.index + segment.segment.length > offset);
    if (!word) return remaining[0] ? remaining[0].index + remaining[0].segment.length : text.length;
    const target = remaining.find(segment => segment.isWordLike);
    return target ? target.index + target.segment.length : text.length;
  }
  const preceding = segments.filter(segment => segment.index < offset);
  if (!word) return preceding.at(-1)?.index ?? 0;
  return preceding.reverse().find(segment => segment.isWordLike)?.index ?? 0;
}
