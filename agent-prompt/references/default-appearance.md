# Default appearance

Use this fallback only when the destination has no established visual system and the user has supplied no visual direction. Existing project tokens and components take precedence. Keep the recognition, brevity, accessibility, and copy-behavior rules in the main skill regardless of appearance.

## Starting treatment

Use Geist when already available or when adding a font fits the project. Otherwise use the existing system sans-serif stack. If distributing Geist, retain its OFL notice. Use neutral light and dark surfaces, a subtle border, modest corner radius, compact spacing, and a visible focus ring. Preserve full-color product artwork. Keep readable names beside marks and use at least 44px control heights.

The [stylesheet](../assets/agent-prompt.css) supplies scoped tokens and layout for a single handoff. Copy it into the target project's normal styling location when useful; adapt token values to the host. It includes no JavaScript, font download, logo artwork, or launch-link integration.

```html
<section class="agent-prompt" aria-label="Build with your agent">
  <div class="agent-prompt__choices" role="group" aria-label="Agent">
    <button class="agent-prompt__choice" type="button" aria-pressed="true">
      <img class="agent-prompt__mark" src="/brands/codex.svg" alt="" width="24" height="24">
      <span>Codex</span>
    </button>
  </div>
  <button class="agent-prompt__action" type="button">Copy for Codex</button>
  <p class="agent-prompt__status" role="status" aria-live="polite"></p>
</section>
```

This is a structural example. Supply a verified product asset and implement selection, payload resolution, clipboard feedback, and manual recovery before shipping. Add only agents actually supported by the task. For an agent-independent payload, a shared copy action and adjacent named logo group avoid an unnecessary picker.

## Theme integration

The stylesheet follows the OS preference unless `data-theme="light"` or `data-theme="dark"` is set on the component. If the host uses a theme class, provider, or other tokens, map to that instead of introducing a second preference. Use `data-monochrome` on an image only when its actual artwork is monochrome; the fallback inverts those marks on dark surfaces. Full-color marks keep their palette.

Check actual Dark Reader transformation separately from the native dark theme. The stylesheet recognizes its dark-scheme attribute and inverts only images explicitly marked `data-monochrome`. For other surface transformations, use a scoped monochrome inversion or an authentic white variant only on that surface. Keep treatment switches separate from payload generation.
