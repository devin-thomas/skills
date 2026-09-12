/** Browser-context probes: pass either exported function to page.evaluate. */
export async function waitForAssets({ timeoutMs = 10000, scope = 'html' } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid asset deadline');
  const root = document.querySelector(scope);
  if (!root) throw new Error(`Missing asset scope: ${scope}`);
  const images = [...root.querySelectorAll('img')];
  if (root instanceof HTMLImageElement) images.unshift(root);
  let timer;
  try {
    return await Promise.race([
      (async () => {
        await document.fonts.ready;
        return await Promise.all(images.map(async (img) => {
          await img.decode();
          if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
            throw new Error(`Broken image: ${img.currentSrc || img.getAttribute('src')}`);
          }
          return { src: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight };
        }));
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Asset readiness timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function inspectGeometry({ tolerance = 1, contain = [], separate = [], inViewport = [] } = {}) {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('Invalid geometry tolerance');
  const issues = [];
  const rect = (element) => {
    const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
    return { left, right, top, bottom, width, height };
  };
  const visible = (element) => {
    const style = getComputedStyle(element);
    const bounds = rect(element);
    return style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
      bounds.width > 0 && bounds.height > 0 && element.getClientRects().length > 0;
  };
  const required = (selector, root = document) => {
    const elements = [...root.querySelectorAll(selector)].filter(visible);
    if (!elements.length) issues.push({ kind: 'missing-or-hidden', selector });
    return elements;
  };
  for (const { parent, child } of contain) {
    for (const element of required(parent)) {
      const outer = rect(element);
      for (const descendant of required(child, element)) {
        const inner = rect(descendant);
        if (inner.left < outer.left - tolerance || inner.right > outer.right + tolerance ||
            inner.top < outer.top - tolerance || inner.bottom > outer.bottom + tolerance) {
          issues.push({ kind: 'outside-parent', parent, child, outer, inner });
        }
      }
    }
  }
  for (const { a, b } of separate) {
    const first = required(a);
    const second = required(b);
    for (const left of first) for (const right of second) {
      const one = rect(left);
      const two = rect(right);
      if (Math.min(one.right, two.right) - Math.max(one.left, two.left) > tolerance &&
          Math.min(one.bottom, two.bottom) - Math.max(one.top, two.top) > tolerance) {
        issues.push({ kind: 'overlap', a, b, one, two });
      }
    }
  }
  const viewport = {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
  for (const selector of inViewport) for (const element of required(selector)) {
    const bounds = rect(element);
    if (bounds.left < -tolerance || bounds.top < -tolerance ||
        bounds.right > viewport.width + tolerance || bounds.bottom > viewport.height + tolerance) {
      issues.push({ kind: 'outside-viewport', selector, bounds });
    }
  }
  return {
    viewport,
    documentOverflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - viewport.width,
    issues,
  };
}
