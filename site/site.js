const status = document.querySelector('[role="status"]');
let messageTimer;
function announce(message) {
  status.textContent = message;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { status.textContent = ''; }, 5000);
}

const menu = document.querySelector('.mobile-menu');
const navigation = document.querySelector('#guide-navigation');
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  closeMenu();
  // Keep keyboard focus in the visible document after the mobile menu closes.
  const target = document.querySelector(link.hash);
  target?.focus({ preventScroll: true });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});

const sectionLinks = [...navigation.querySelectorAll('a')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    sectionLinks.forEach(link => {
      if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-15% 0px -45% 0px' });
  document.querySelectorAll('main > section[id]').forEach(section => observer.observe(section));
}

document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      announce(`${value} copied to clipboard.`);
    } catch {
      announce(`Copy this color: ${value}`);
    }
  });
});

document.querySelectorAll('[data-surface]').forEach(button => {
  button.addEventListener('click', () => {
    const dark = button.dataset.surface === 'dark';
    document.querySelectorAll('[data-surface]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    document.querySelectorAll('[data-logo-layout]').forEach(image => {
      const layout = image.dataset.logoLayout;
      const theme = dark ? 'gradient-dark' : 'gradient-light';
      image.src = `01-svg/${layout}/andhub-${layout}-${theme}.svg`;
      image.closest('.specimen-art').classList.toggle('dark', dark);
      const download = image.closest('.specimen').querySelector('a[download]');
      download.href = image.src;
      download.setAttribute('aria-label', `Download ${layout} SVG for ${dark ? 'dark' : 'light'} surfaces`);
    });
    announce(`Logo previews and downloads use ${dark ? 'dark' : 'light'} surface artwork.`);
  });
});
