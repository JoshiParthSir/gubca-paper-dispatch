const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Ease-in-out cubic: gentle start, confident middle, soft landing
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let activeFrame = 0;

/** Animated scroll to a y position. Duration scales with distance (450–1000ms). */
export function smoothScrollTo(targetY: number) {
  const startY = window.scrollY;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const endY = Math.max(0, Math.min(targetY, maxY));
  const distance = endY - startY;

  if (prefersReducedMotion() || Math.abs(distance) < 2) {
    window.scrollTo(0, endY);
    return;
  }

  cancelAnimationFrame(activeFrame);
  const duration = Math.min(1000, Math.max(450, Math.abs(distance) * 0.45));
  const start = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, startY + distance * ease(t));
    if (t < 1) activeFrame = requestAnimationFrame(step);
  };
  activeFrame = requestAnimationFrame(step);

  // Let the user take over: any wheel/touch input cancels the animation
  const cancel = () => cancelAnimationFrame(activeFrame);
  window.addEventListener('wheel', cancel, { once: true, passive: true });
  window.addEventListener('touchstart', cancel, { once: true, passive: true });
}

/** Scroll so `id` sits just below a fixed header, then briefly highlight it. */
export function scrollToSection(id: string, headerOffset = 80) {
  if (id === 'top' || id === '') {
    smoothScrollTo(0);
    history.replaceState(null, '', window.location.pathname);
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - headerOffset);
  history.replaceState(null, '', `#${id}`);

  if (!prefersReducedMotion()) {
    el.classList.remove('section-arrive');
    // Restart the animation even when clicking the same link twice
    void el.offsetWidth;
    el.classList.add('section-arrive');
    window.setTimeout(() => el.classList.remove('section-arrive'), 1600);
  }
}

/** onClick handler for in-page links like <a href="#features">. */
export function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, onDone?: () => void) {
  const href = e.currentTarget.getAttribute('href') ?? '';
  if (!href.startsWith('#')) return;
  e.preventDefault();
  onDone?.();
  // Wait one frame so a closing mobile menu doesn't shift the target position
  requestAnimationFrame(() => scrollToSection(href.slice(1)));
}
