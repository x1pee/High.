// A single, non-blocking entrance per app session. Navigation never replays it.
export function welcomeEntrance(root) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const play = () => {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', play);
    if (reduced.matches || document.documentElement.classList.contains('reduce-motion')) return;
    const entrance = root.animate([
      { opacity: 0.65, transform: 'translateY(6px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' });
    const logo = root.querySelector('.brand img');
    const greeting = logo?.animate([
      { transform: 'scale(.92)', filter: 'drop-shadow(0 0 0 transparent)' },
      { offset: .45, transform: 'scale(1)', filter: 'drop-shadow(0 0 6px var(--accent))' },
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 transparent)' },
    ], { duration: 520, easing: 'ease-out' });
    const stop = () => { entrance.cancel(); greeting?.cancel(); };
    reduced.addEventListener('change', stop, { once: true });
    entrance.finished.catch(() => {}).finally(() => reduced.removeEventListener('change', stop));
  };
  if (document.hidden) document.addEventListener('visibilitychange', play);
  else play();
}
