/* Tiny board renderer shared by the home-page variations.
   <div class="vb" data-fen="…" data-set="maestro" data-hl="e2,e4" data-focus="f7" data-arrows="g1f3,d1h5:alt" data-coords></div>
   Square colours come from CSS vars on the element or ancestors: --vb-light, --vb-dark, --vb-hl, --vb-arrow, --vb-arrow-alt, --vb-focus. */
(function () {
  const F = 'abcdefgh';
  const list = v => (v || '').split(/[\s,]+/).filter(Boolean);
  function parse(fen) {
    const m = {};
    fen.split(' ')[0].split('/').forEach((row, ri) => {
      let fi = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { fi += +ch; continue; }
        m[F[fi] + (8 - ri)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        fi++;
      }
    });
    return m;
  }
  function c(sq, flip) { const f = F.indexOf(sq[0]), r = +sq[1]; return flip ? [7 - f + .5, r - .5] : [f + .5, 8 - r + .5]; }
  function render(el) {
    const set = el.dataset.set || 'maestro';
    const base = el.dataset.base || 'pieces/';
    const flip = el.dataset.orient === 'b';
    const p = parse(el.dataset.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    const hl = new Set(list(el.dataset.hl)), fo = new Set(list(el.dataset.focus));
    const coords = el.hasAttribute('data-coords');
    let h = '';
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const file = flip ? F[7 - f] : F[f], rank = flip ? r + 1 : 8 - r, sq = file + rank;
      const light = (F.indexOf(file) + rank) % 2 === 1;
      h += `<div class="vb-sq ${light ? 'l' : 'd'}${hl.has(sq) ? ' hl' : ''}${fo.has(sq) ? ' fo' : ''}">`
        + (coords && f === 0 ? `<span class="vb-c r">${rank}</span>` : '')
        + (coords && r === 7 ? `<span class="vb-c f">${file}</span>` : '')
        + (p[sq] ? `<img class="vb-p" src="${base}${set}/${p[sq]}.svg" alt="" draggable="false">` : '')
        + `</div>`;
    }
    const arrows = list(el.dataset.arrows);
    if (arrows.length) {
      h += `<svg class="vb-arrows" viewBox="0 0 8 8" aria-hidden="true"><defs>
        <marker id="m-${el.dataset.id || 'a'}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0L10,5L0,10z" fill="context-stroke"/></marker></defs>`
        + arrows.map(a => {
          const [mv, kind] = a.split(':');
          const [x1, y1] = c(mv.slice(0, 2), flip), [x2, y2] = c(mv.slice(2, 4), flip);
          const len = Math.hypot(x2 - x1, y2 - y1), k = (len - .4) / len;
          return `<line class="vb-arrow ${kind || ''}" x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * k}" y2="${y1 + (y2 - y1) * k}" marker-end="url(#m-${el.dataset.id || 'a'})"/>`;
        }).join('') + `</svg>`;
    }
    el.innerHTML = h;
    el.setAttribute('role', 'img');
  }
  const css = `
    .vb{position:relative;display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;width:100%;overflow:hidden;container-type:inline-size;user-select:none}
    .vb-sq{position:relative;display:grid;place-items:center}
    .vb-sq.l{background:var(--vb-light,#eee)} .vb-sq.d{background:var(--vb-dark,#888)}
    .vb-sq.hl::before{content:"";position:absolute;inset:0;background:var(--vb-hl,rgba(255,220,0,.35))}
    .vb-sq.fo::after{content:"";position:absolute;inset:6%;border-radius:50%;box-shadow:inset 0 0 0 3px var(--vb-focus,#fff)}
    .vb-p{position:relative;z-index:1;width:92%;height:92%}
    .vb-c{position:absolute;font-size:clamp(7px,2.4cqi,12px);font-weight:600;line-height:1;opacity:.75;z-index:1}
    .vb-c.r{top:5%;left:6%} .vb-c.f{bottom:5%;right:7%}
    .vb-sq.l .vb-c{color:var(--vb-dark,#888)} .vb-sq.d .vb-c{color:var(--vb-light,#eee)}
    .vb-arrows{position:absolute;inset:0;z-index:2;pointer-events:none}
    .vb-arrow{stroke:var(--vb-arrow,rgba(255,170,0,.85));stroke-width:.17;stroke-linecap:round}
    .vb-arrow.alt{stroke:var(--vb-arrow-alt,rgba(220,60,60,.85))}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  const boot = () => document.querySelectorAll('.vb').forEach(render);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
  window.VB = { render };
})();
