/**
 * Toast notification system — no external library.
 * Uses a simple module-level queue + DOM injection to show toasts.
 *
 * Usage (anywhere in the app):
 *   import toast from '../components/Toast';
 *   toast.success('Habit checked in!');
 *   toast.error('Something went wrong');
 *   toast.info('Copied invite code');
 */

let container = null;

const getContainer = () => {
  if (!container) {
    container = document.createElement('div');
    container.style.cssText =
      'position:fixed;top:1.25rem;right:1.25rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
    document.body.appendChild(container);
  }
  return container;
};

const show = (message, type = 'success', duration = 3500) => {
  const c = getContainer();

  const el = document.createElement('div');
  const colors = {
    success: 'border-emerald-500/40 bg-emerald-950/80 text-emerald-300',
    error:   'border-rose-500/40 bg-rose-950/80 text-rose-300',
    info:    'border-violet-500/40 bg-violet-950/80 text-violet-300',
    warning: 'border-amber-500/40 bg-amber-950/80 text-amber-300',
  };
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

  el.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-xl transition-all duration-300 translate-x-2 opacity-0 ${colors[type] || colors.info}`;
  el.innerHTML = `<span class="text-base">${icons[type] || icons.info}</span><span>${message}</span>`;

  c.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
  });

  // Animate out + remove
  setTimeout(() => {
    el.style.transform = 'translateX(8px)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, duration);
};

const toast = {
  success: (msg, d) => show(msg, 'success', d),
  error:   (msg, d) => show(msg, 'error', d),
  info:    (msg, d) => show(msg, 'info', d),
  warning: (msg, d) => show(msg, 'warning', d),
};

export default toast;
