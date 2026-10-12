---
name: branded-sign-in
description: Use when creating or editing authentication interfaces for account-based websites, apps and services, or reviewing provider/method buttons and logo rendering. Do not use for backend-only authentication work or public pages without account controls.
---

# Branded Sign-In

Treat authentication as part of the product's designed experience. Within an authorized build or auth UI task, include branding as a completion requirement rather than waiting for the user to request logos. Use the existing product design and approved identity assets; a shared identity service should make its own authority clear. Respect an explicit minimal, unbranded or alternative direction.

## 1. Establish identity and methods

- Establish the product or identity authority's approved name, mark and visual language from the repository. Use existing assets before inventing a logo. If no approved artwork exists, ship an intentional text lockup and identify the missing asset; do not fabricate a provider mark.
- Give each configured identity provider its recognizable official mark, using current approved artwork, colors, background, spacing and label treatment. Consult its authoritative brand guidance when choosing assets. Approved monochrome variants can be correct; applying the app accent to every provider is not. Distinguish an identity provider from its individual email or other services.
- Give email, passkey and other methods appropriate icons alongside clear labels. Decorative icons must not duplicate the accessible name; controls still need a readable, accurate name.
- Include branding on sign-in, registration, confirmation, recovery and linking surfaces that are in scope. Carry it through loading, disabled, error and success states without replacing icons or losing focus. Show only configured, available methods and preserve the current enrollment and permission rules.

Complete when the approved identity, configured methods and artwork sources are identified. This prevents polished controls from implying an unavailable sign-in option.

## 2. Preserve logo geometry

Original artwork owns its silhouette, proportions, clear space and transparency, including built-in rounded corners. Preserve it with proportional contain sizing. Default brand images to zero additional border radius, no clipping path, no mask and no cropping. Never apply avatar presets or rounded image-card presets to a logo. Check ancestors too: a rounded wrapper or hidden overflow must not clip the artwork. Container decoration may sit around a fully visible mark with sufficient space.

Use a distinct reusable logo component/class or an explicit original-artwork mode so generic image rules cannot silently reshape it. A circle, tile or alternate silhouette requires an approved separate asset or an explicitly authorized brand treatment; do not alter the source logo to compensate for repeated UI clipping. Provider-required button backgrounds should surround the mark without cropping it.

Complete when the reusable rendering path preserves the asset's full silhouette and proportions, including clipping ancestors. The artwork already defines its shape; styling it again distorts the brand.

## 3. Integrate without changing authentication

Reuse the existing authentication implementation and accessible primitives. Preserve action hooks, callbacks, consent, enrollment, linking constraints, security headers and credential handling. Choose local or existing hosted assets consistent with the application's content security policy; do not add external fonts, tracking, hosted auth widgets or a new identity vendor just for styling. Record asset provenance and usage constraints in the consuming project. This skill distributes guidance, not logos or rights to trademarks.

Complete when the branded controls retain the existing auth contract and permitted asset loading. Visual polish must not change who can sign in or how consent works.

## 4. Verify the rendered result

Review desktop and narrow mobile output, keyboard focus, touch target size, label contrast, reduced motion and meaningful operational states. Verify original logo components through computed styles (radius, clip path, mask, contain sizing and clipping ancestors) and compare rendered output with the source asset. Use a browser regression check when a reusable component or global style makes this defect likely; a selector-only test cannot prove the final appearance.

Use synthetic fixtures for presentation checks. Separate visual acceptance from real provider login, email delivery, physical-device acceptance and production deployment. Follow existing authorization for external actions. Finish with the working UI, source/provenance record and honest verification scope; identify missing artwork or blocked checks precisely.

Completion checklist:
- [ ] In-scope auth surfaces and operational states carry the approved identity and method artwork.
- [ ] Computed logo geometry and clipping ancestors preserve the original asset.
- [ ] Desktop/mobile and keyboard checks are recorded; gaps are explicit.
- [ ] Authentication behavior and security boundaries are preserved.
- [ ] Delivery claims match the actual local, deployed or provider evidence.
