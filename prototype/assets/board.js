/* Chess King board renderer.
   <div class="vb" data-fen="FEN" data-orient="w|b" data-set="california|staunty|maestro|alpha"
        data-hl="e2,e4" data-sel="e4" data-focus="f7" data-dots="e5,f6" data-check="e1"
        data-marks="e4:blunder,f3:best" data-arrows="g1f3,d8h4:alt,b1d2:ai" data-coords data-interactive></div>
   Arrow kinds: (none)=primary green, alt=clay/red (threat), ai=violet (coach suggestion).
   Piece set defaults to the user's choice in Settings (localStorage 'ck-set'), else california.
   Emits 'board:move' {from,to} on the element when an interactive board moves (no legality check). */
(function () {
  const F = 'abcdefgh';
  const GLYPH = { brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '✓', book: 'B', inaccuracy: '?!', mistake: '?', miss: '×', blunder: '??' };
  const list = v => (v || '').split(/[\s,]+/).filter(Boolean);
  let uid = 0;
  const pref = () => { try { return localStorage.getItem('ck-set'); } catch { return null; } };

  function parse(fen) {
    const m = {};
    (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').split(' ')[0].split('/').forEach((row, ri) => {
      let fi = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { fi += +ch; continue; }
        m[F[fi] + (8 - ri)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        fi++;
      }
    });
    return m;
  }
  const center = (sq, flip) => { const f = F.indexOf(sq[0]), r = +sq[1]; return flip ? [7 - f + .5, r - .5] : [f + .5, 8 - r + .5]; };

  function render(el) {
    const id = el.dataset.vbid || (el.dataset.vbid = 'vb' + (++uid));
    const set = el.dataset.set || pref() || 'california';
    const base = el.dataset.base || 'assets/pieces/';
    const flip = el.dataset.orient === 'b';
    const p = parse(el.dataset.fen);
    const hl = new Set(list(el.dataset.hl)), sel = new Set(list(el.dataset.sel)), fo = new Set(list(el.dataset.focus)), dots = new Set(list(el.dataset.dots));
    const marks = Object.fromEntries(list(el.dataset.marks).map(m => m.split(':')));
    const coords = el.hasAttribute('data-coords');
    let h = '';
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const file = flip ? F[7 - f] : F[f], rank = flip ? r + 1 : 8 - r, sq = file + rank;
      const light = (F.indexOf(file) + rank) % 2 === 1;
      const cls = ['vb-sq', light ? 'l' : 'd'];
      if (hl.has(sq)) cls.push('hl');
      if (sel.has(sq)) cls.push('sel');
      if (fo.has(sq)) cls.push('fo');
      if (el.dataset.check === sq) cls.push('ck');
      if (dots.has(sq)) cls.push(p[sq] ? 'cap' : 'dot');
      h += `<div class="${cls.join(' ')}" data-sq="${sq}">`
        + (coords && f === 0 ? `<span class="vb-c r">${rank}</span>` : '')
        + (coords && r === 7 ? `<span class="vb-c f">${file}</span>` : '')
        + (p[sq] ? `<img class="vb-p" src="${base}${set}/${p[sq]}.svg" alt="" draggable="false">` : '')
        + (marks[sq] ? `<span class="vb-m q-${marks[sq]}">${GLYPH[marks[sq]] || ''}</span>` : '')
        + `</div>`;
    }
    const arrows = list(el.dataset.arrows);
    if (arrows.length) {
      h += `<svg class="vb-arrows" viewBox="0 0 8 8" aria-hidden="true"><defs>`
        + ['', 'alt', 'ai'].map(k => `<marker id="${id}-m${k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0L10,5L0,10z" class="vb-head ${k}"/></marker>`).join('')
        + `</defs>` + arrows.map(a => {
          const [mv, kind = ''] = a.split(':');
          const [x1, y1] = center(mv.slice(0, 2), flip), [x2, y2] = center(mv.slice(2, 4), flip);
          const len = Math.hypot(x2 - x1, y2 - y1), k = (len - .4) / len;
          return `<line class="vb-arrow ${kind}" x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * k}" y2="${y1 + (y2 - y1) * k}" marker-end="url(#${id}-m${kind})"/>`;
        }).join('') + `</svg>`;
    }
    el.innerHTML = h;
    el.setAttribute('role', 'img');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Chess board');
    if (el.hasAttribute('data-interactive') && !el._wired) wire(el);
  }

  function wire(el) {
    el._wired = true;
    el.removeAttribute('role');
    let from = null;
    el.addEventListener('click', e => {
      const sqEl = e.target.closest('.vb-sq'); if (!sqEl) return;
      const sq = sqEl.dataset.sq, pc = sqEl.querySelector('.vb-p');
      const clear = c => el.querySelectorAll('.' + c).forEach(n => n.classList.remove(c));
      if (!from) { if (!pc) return; from = sq; clear('sel'); sqEl.classList.add('sel'); return; }
      if (from === sq) { sqEl.classList.remove('sel'); from = null; return; }
      const fromEl = el.querySelector(`[data-sq="${from}"]`), moving = fromEl.querySelector('.vb-p');
      if (pc && moving && pc.src.split('/').pop()[0] === moving.src.split('/').pop()[0]) { clear('sel'); sqEl.classList.add('sel'); from = sq; return; }
      pc?.remove();
      ['hl', 'sel', 'ck', 'dot', 'cap', 'fo'].forEach(clear);
      el.querySelector('.vb-arrows')?.remove();
      el.querySelectorAll('.vb-m').forEach(m => m.remove());
      sqEl.appendChild(moving);
      fromEl.classList.add('hl'); sqEl.classList.add('hl');
      el.dispatchEvent(new CustomEvent('board:move', { bubbles: true, detail: { from, to: sq } }));
      from = null;
    });
  }

  const css = `
    .vb{position:relative;display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;width:100%;overflow:hidden;container-type:inline-size;user-select:none;border-radius:inherit}
    .vb-sq{position:relative;display:grid;place-items:center}
    .vb-sq.l{background:var(--vb-light)} .vb-sq.d{background:var(--vb-dark)}
    .vb-sq.hl::before,.vb-sq.sel::before{content:"";position:absolute;inset:0}
    .vb-sq.hl::before{background:var(--vb-hl)} .vb-sq.sel::before{background:var(--vb-sel)}
    .vb-sq.ck::before{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(220,40,30,.9) 0%,rgba(220,40,30,.45) 40%,transparent 72%)}
    .vb-sq.fo::after{content:"";position:absolute;inset:5%;border-radius:50%;box-shadow:inset 0 0 0 3px var(--vb-focus)}
    .vb-sq.dot::after{content:"";position:absolute;width:28%;height:28%;border-radius:50%;background:rgba(20,30,20,.22)}
    .vb-sq.cap::after{content:"";position:absolute;inset:4%;border-radius:50%;box-shadow:inset 0 0 0 5px rgba(20,30,20,.22)}
    .vb-p{position:relative;z-index:1;width:92%;height:92%;pointer-events:none}
    .vb[data-interactive] .vb-sq{cursor:pointer}
    .vb-c{position:absolute;z-index:1;font:600 clamp(7px,2.4cqi,12px)/1 Inter,sans-serif;opacity:.8;pointer-events:none}
    .vb-c.r{top:5%;left:6%} .vb-c.f{bottom:5%;right:7%}
    .vb-sq.l .vb-c{color:var(--vb-dark)} .vb-sq.d .vb-c{color:var(--vb-light)}
    .vb-m{position:absolute;z-index:3;top:-4%;right:-4%;width:40%;height:40%;max-width:28px;max-height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;font:800 clamp(7px,2.3cqi,13px)/1 Inter,sans-serif;box-shadow:0 2px 4px rgba(0,0,0,.3)}
    .vb-arrows{position:absolute;inset:0;z-index:2;pointer-events:none}
    .vb-arrow{stroke:var(--vb-arrow);stroke-width:.17;stroke-linecap:round}
    .vb-arrow.alt{stroke:var(--vb-arrow-alt)} .vb-arrow.ai{stroke:var(--vb-arrow-ai)}
    .vb-head{fill:var(--vb-arrow)} .vb-head.alt{fill:var(--vb-arrow-alt)} .vb-head.ai{fill:var(--vb-arrow-ai)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const boot = () => document.querySelectorAll('.vb').forEach(render);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
  window.VB = { render, parse, renderAll: boot };
})();
