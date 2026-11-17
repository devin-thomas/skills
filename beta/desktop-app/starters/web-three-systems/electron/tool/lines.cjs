// Splits a byte stream into lines without ever holding more than one capped
// line. No Electron and no child process in here: it is fed buffers and calls
// back. Lifts out unchanged for any tool that speaks one JSON object per line.
//
// Bounds:
//   - a line longer than `maxLineBytes` is reported once through `onOverflow('line')`
//     and its bytes are dropped until the next newline;
//   - after `maxTotalBytes` the reader reports `onOverflow('total')` and stops
//     calling `onLine`.
// In both cases `push` keeps accepting data, so the caller can go on draining
// the pipe and the tool never blocks on a full buffer.
'use strict';

const NEWLINE = 0x0a;
const RETURN = 0x0d;

/**
 * @param {{
 *   maxLineBytes: number,
 *   maxTotalBytes: number,
 *   onLine: (line: string) => void,
 *   onOverflow: (kind: 'line' | 'total', info: { bytes: number }) => void,
 * }} options
 */
function createLineReader(options) {
  const { maxLineBytes, maxTotalBytes, onLine, onOverflow } = options;
  /** @type {Buffer[]} */
  let parts = [];
  let held = 0;
  let skipping = false; // inside a line that already passed the cap
  let stopped = false; // total cap passed, or the caller asked to stop
  let totalReported = false;
  const stats = { bytesSeen: 0, lines: 0, maxHeld: 0, longLines: 0 };

  function emit(buffer) {
    let end = buffer.length;
    if (end > 0 && buffer[end - 1] === RETURN) end -= 1; // tolerate \r\n
    stats.lines += 1;
    onLine(buffer.toString('utf8', 0, end));
  }

  function take(piece) {
    if (skipping) return;
    if (held + piece.length > maxLineBytes) {
      parts = [];
      held = 0;
      skipping = true;
      stats.longLines += 1;
      onOverflow('line', { bytes: maxLineBytes });
      return;
    }
    parts.push(piece);
    held += piece.length;
    if (held > stats.maxHeld) stats.maxHeld = held;
  }

  /** @param {Buffer} chunk */
  function push(chunk) {
    stats.bytesSeen += chunk.length;
    if (!totalReported && stats.bytesSeen > maxTotalBytes) {
      totalReported = true;
      stopped = true;
      parts = [];
      held = 0;
      onOverflow('total', { bytes: maxTotalBytes });
    }
    if (stopped) return;
    let from = 0;
    while (from < chunk.length && !stopped) {
      const at = chunk.indexOf(NEWLINE, from);
      if (at === -1) {
        take(chunk.subarray(from));
        return;
      }
      if (skipping) {
        skipping = false;
      } else {
        take(chunk.subarray(from, at));
        if (skipping) {
          skipping = false; // the cap was passed by this last piece; the line ends here
        } else {
          const line = parts.length === 1 ? parts[0] : Buffer.concat(parts, held);
          parts = [];
          held = 0;
          emit(line);
        }
      }
      from = at + 1;
    }
  }

  /** Bytes left without a final newline. A complete stream leaves none. */
  function end() {
    const left = held;
    parts = [];
    held = 0;
    return { leftover: left, skipping };
  }

  /** Stop calling onLine; later data is counted and dropped. */
  function stop() {
    stopped = true;
    parts = [];
    held = 0;
  }

  return { push, end, stop, stats };
}

module.exports = { createLineReader };
