/* Theme before first paint: the reader's stored choice, else the system's. A file and not an inline
   script because the CSP allows no inline script. src/ui/theme.ts takes over once the app loads and
   uses the same key and colours. */
(function () {
  var d = document.documentElement, t, chosen;
  try { t = localStorage.getItem('pezkuwi-explorer:theme'); } catch { t = null; }
  chosen = t === 'light' || t === 'dark';
  if (!chosen) t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  d.setAttribute('data-theme', t);
  // The browser's own bar: on Auto each meta keeps its scheme's colour; after a choice both take it.
  if (chosen) {
    var bar = t === 'light' ? '#F4F5EF' : '#08090E', m = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < m.length; i++) m[i].setAttribute('content', bar);
  }
})();
