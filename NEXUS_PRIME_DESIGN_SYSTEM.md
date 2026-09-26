# NEXUS PRIME (PVT) LTD — CORPORATE DESIGN SYSTEM SPECIFICATION
**Domain:** `nexusp.online`  
**Classification:** Enterprise Design Tokens & UI Architecture  
**Version:** 1.0.0-PROD  
**Status:** Approved Master Design System  

---

## 1. Brand Positioning & Visual Identity

Nexus Prime (PVT) Ltd is an enterprise-grade digital e-commerce and multi-tier network distribution platform. The visual identity embodies:
* **Professional & Trustworthy:** Clean contrast ratios, calm corporate dark slate foundation, and zero aggressive sales pressure.
* **Modern & Technology-Driven:** High-precision typography, subtle radial gradients, and responsive glassmorphic accents.
* **Global & Scalable:** Deterministic design system tokens engineered in CSS custom properties for effortless theme swapping and branding agility.
* **Anti-Pattern Rejection:** Deliberately avoids cheap MLM clichés (such as neon rainbow gradients, casino-style bling, fake income counters, and flashy ticker animations). Trust is established first.

---

## 2. Color System & Design Tokens

All colors are controlled via CSS custom properties in [`assets/nexus/nexus-style.css`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/assets/nexus/nexus-style.css):

```css
:root {
    /* Core Brand Tokens */
    --primary:          #0B192C;   /* Deep Navy / Midnight Surface */
    --primary-dark:     #060D17;   /* Ultra-Deep Canvas */
    --primary-light:    #1E293B;   /* Slate Accent Surface */
    --secondary:        #334155;   /* Dark Slate Border / Detail */
    --accent:           #008DDA;   /* Electric / Premium Blue */
    --accent-hover:     #38BDF8;   /* Vibrant Sky Blue */
    --accent-dark:      #0284C7;   /* Deep Blue Shade */
    --background:       #080E18;   /* Global Canvas Background */
    --surface:          #0F1B2E;   /* Elevated Component Surface */
    --surface-card:     rgba(16, 29, 49, 0.88); /* Translucent Card */
    --surface-hover:    rgba(22, 40, 68, 0.95); /* Interactive Card Hover */
    
    /* Typography Colors */
    --text:             #F8FAFC;   /* Crisp White (90%+ contrast) */
    --text-muted:       #94A3B8;   /* Soft Slate Gray */
    --text-dark:        #060D17;   /* Dark on Gold/Light surfaces */
    
    /* Borders & Glows */
    --border:           rgba(255, 255, 255, 0.08); /* Subtle Structural Line */
    --border-accent:    rgba(0, 141, 218, 0.28);  /* Primary Themed Stroke */
    --border-focus:     #008DDA;                  /* Accessibility Focus Ring */
    
    /* Semantic Status Indicators */
    --success:          #10B981;   /* Emerald Green (Active / Paid) */
    --warning:          #F59E0B;   /* Amber (Pending Review / Notice) */
    --error:            #EF4444;   /* Crimson Red (Error / Suspended) */
    --info:             #3B82F6;   /* Cobalt (Informational Alert) */
}
```

---

## 3. Typography Hierarchy

The platform utilizes a unified sans-serif font stack (`Plus Jakarta Sans` for display headings, `Inter` for data density and body copy, and fallback `Poppins`):

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| **Display H1** | `clamp(32px, 5vw, 56px)` | 800 | 1.15 | `-0.03em` | Hero Headings (`nexus_index.html`) |
| **Page H2** | `clamp(24px, 3.5vw, 36px)` | 700 | 1.25 | `-0.02em` | Section Titles, Auth Hero |
| **Section H3** | `18px - 22px` | 700 | 1.35 | `-0.01em` | Card Titles, Modal Headers |
| **Subhead H4** | `15px - 17px` | 600 | 1.4 | `0` | Subsection Headers, Feature Titles |
| **Body Regular** | `14px - 15px` | 400 | 1.65 | `0` | Primary Copy, Paragraphs, Explanations |
| **Body Small** | `13px - 13.5px` | 400 | 1.6 | `0` | Form Descriptions, Table Data |
| **Caption / Meta**| `11px - 12px` | 600 | 1.4 | `+0.04em` | Timestamps, Invariant IDs, Badges |
| **Button Text** | `13.5px - 14px` | 700 | 1.0 | `+0.02em` | Interactive CTA Labels |

*Sinhala & Number Support:* The typography stack cleanly handles Sri Lankan Unicode Sinhala characters, English corporate text, and monospaced financial currency values without font clipping.

---

## 4. Spacing Scale & Border Radii

### Spacing Scale
* `--space-1`: `4px` (Tight padding, badge insets)
* `--space-2`: `8px` (Icon gaps, input margins)
* `--space-3`: `12px` (Card gaps, button padding Y)
* `--space-4`: `16px` (Standard gutters, input padding X)
* `--space-5`: `20px` (Container gutters, card margins)
* `--space-6`: `24px` (Standard card padding, section gaps)
* `--space-8`: `32px` (Major component padding)
* `--space-10`: `40px` (Grid gaps, modal insets)
* `--space-12`: `48px` (Section padding mobile)
* `--space-16`: `64px` (Section padding desktop)

### Border Radii Scale
* `--radius-sm`: `6px` (Form inputs, table rows, button corners)
* `--radius-md`: `10px` (Cards, banners, stat widgets)
* `--radius-lg`: `16px` (Master cards, modals, hero containers)
* `--radius-full`: `9999px` (Pills, badges, circular avatars)

---

## 5. Component Library & Architecture

### A. Reusable Logo Component
The logo component is encapsulated in a dedicated HTML/CSS structure to allow asset swapping without altering page markup:
```html
<a href="/" class="nexus-logo-wrapper" aria-label="Nexus Prime Home">
    <div class="nexus-logo-mark">NP</div>
    <div class="nexus-logo-text">
        <div class="nexus-logo-name">NEXUS <span>PRIME</span></div>
        <div class="nexus-logo-corp">Nexus Prime (PVT) Ltd</div>
    </div>
</a>
```

### B. Buttons (`.nexus-btn`)
* `.nexus-btn-primary`: Electric Blue gradient with subtle glow (`background: linear-gradient(135deg, var(--accent), var(--accent-dark))`).
* `.nexus-btn-outline`: Translucent background with thin slate/accent stroke.
* `.nexus-btn-sm`: Compact padding (`7px 14px`) for tables and topbars.
* `:focus-visible`: `2px solid var(--accent); outline-offset: 2px;`.

### C. Forms & Inputs
* High-contrast inputs (`background: rgba(8, 17, 30, 0.95); border: 1px solid var(--border)`).
* Password Visibility Toggle: Built-in eye toggle (`.nexus-password-toggle`) for error-free mobile credentials.
* Floating accessible labels (`.nexus-label`) linked via explicit `for` attributes.

### D. Progressive Step Wizard (`.nexus-wizard-steps`)
* Numbered step circles connected by a horizontal status line.
* Active state: High-contrast electric blue with cyan halo.
* Completed state: Emerald green with checkmark feedback.

### E. Abstract Network Hierarchy Diagram (`.nexus-network-diagram`)
* Explanatory visualization: Platform Root $\rightarrow$ Direct Members $\rightarrow$ Team $\rightarrow$ Extended Network.
* Styled via `.nexus-network-pill` and `.nexus-network-connector-line`. Zero fake member data.

### F. Cards & Containers
* `.nexus-card`: Glassmorphic dark surface with `backdrop-filter: blur(10px)`.
* `.nexus-package-card`: Standardized tier cards supporting price, features, preview status, and CTA.
* `.nexus-product-card`: Digital curriculum cards with preview thumbnail and lesson metadata.

### G. Status Badges (`.nexus-badge`)
* `.nexus-badge-active`: Green tint (`#10B981`) for verified status.
* `.nexus-badge-pending`: Amber tint (`#F59E0B`) for pending slips/review.
* `.nexus-badge-member`: Electric blue tint (`#008DDA`) for standard rank.
* `.nexus-badge-founder`: Gold tint (`#FFD700`) for founder/root accounts.

### H. Toast Notifications (`.nexus-toast`)
* Fixed at viewport bottom-right (`z-index: 3000`).
* Automatic self-dismissal with smooth slide-in and fade-out animations.

---

## 6. Responsive Breakpoints & Mobile Architecture

| Breakpoint | Target Screen | Layout Adaptations |
|---|---|---|
| **Desktop (> 900px)** | Laptops, Monitors | Sticky horizontal header, 2-column split auth, fixed 260px app sidebar |
| **Tablet (600px - 900px)** | iPads, Tablets | Header links collapse to mobile toggle, auth switches to 1-column, grids scale to 2-column |
| **Mobile (< 600px)** | Smartphones | Full off-canvas slide-out drawer (`#mobileDrawer`), 1-column cards, horizontally scrollable data tables, touch-friendly tap targets ($\ge 44\text{px}$) |

---

## 7. Accessibility & Performance Standards

1. **Contrast Compliance:** All text colors meet WCAG 2.1 AA contrast requirements ($\ge 4.5:1$ against dark surfaces).
2. **Keyboard Traversal:** Logical tab order preserved across all 5 steps of the registration wizard and modal dialogs.
3. **Reduced Motion:** Animations are restricted to short durations ($\le 0.25\text{s}$) with subtle translation ($2\text{px}-4\text{px}$).
4. **Zero Layout Shift (CLS):** Explicit width/height on SVG icons and card boundaries.
5. **No Heavy Framework Overhead:** 100% vanilla CSS and ES6+ JavaScript. Fast initial load under 50KB total asset transfer.

---

*Document approved for Nexus Prime (PVT) Ltd (`nexusp.online`). All design tokens are implemented in `assets/nexus/nexus-style.css`.*
