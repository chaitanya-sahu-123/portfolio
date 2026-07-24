# Chaitanya Sahu - Portfolio

A single-page portfolio site styled as a systems dashboard: service cards for
projects, a Kafka-style topic list for the stack, a log stream for experience,
and a live-animated "projects" panel in the hero as the signature piece.

No build step, no framework. Plain HTML/CSS/JS. Open `index.html` in a
browser and it works.

## Structure

```
index.html           all markup, in section order (hero → services → stack →
                     experience → research → contact)
css/style.css        design tokens (:root), then component styles
js/main.js           uptime clock, canvas particle stream, animated counters,
                     topic-list renderer, scroll-reveal observer
assets/
  resume.pdf         current resume
```

## Accessibility / quality notes already handled

- Respects `prefers-reduced-motion` (disables the canvas animation and
  counters, shows static end-states instead).
- Visible keyboard focus states on all links and buttons.
- Responsive down to small mobile widths (nav collapses, grids stack).
