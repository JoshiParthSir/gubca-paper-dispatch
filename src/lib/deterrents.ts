// Casual-use deterrents: block the context menu and the common developer-tools
// / view-source / save-page shortcuts. These only discourage casual users; the
// real protection is on the server (row-level security, exam-window checks,
// private storage with short-lived signed URLs). Enabled in production only.

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function isBlockedShortcut(e: KeyboardEvent) {
  if (e.key === 'F12') return true;
  const ctrlOrCmd = e.ctrlKey || e.metaKey;
  // Use e.code: on macOS, Option changes e.key to special characters
  const letter = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : '';
  // Ctrl+Shift+I/J/C/K (Chrome, Edge, Firefox dev tools and console)
  if (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c', 'k'].includes(letter)) return true;
  // Cmd+Option+I/J/C/U (macOS dev tools, console, inspector, view source)
  if (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(letter)) return true;
  // Ctrl+U (view source) and Ctrl+S (save page)
  if (ctrlOrCmd && !e.shiftKey && !e.altKey && ['u', 's'].includes(letter)) return true;
  return false;
}

export function installInspectDeterrents() {
  document.addEventListener('contextmenu', (e) => {
    // Keep right-click in text fields so people can paste
    if (!isEditable(e.target)) e.preventDefault();
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (isBlockedShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  // Stop dragging images and the logo out of the page
  document.addEventListener('dragstart', (e) => {
    if (e.target instanceof HTMLImageElement || e.target instanceof SVGElement) e.preventDefault();
  });

  // Warn anyone who opens the console anyway (guards against "paste this
  // code" social-engineering scams)
  const title = 'color:#003366;font-size:28px;font-weight:800;';
  const body = 'color:#334155;font-size:14px;';
  console.log('%cStop!', title);
  console.log(
    '%cThis is a browser feature intended for developers. If someone told you to copy and paste something here, it is a scam and could give them access to your Paper Dispatch account. All activity is logged.',
    body,
  );
}
