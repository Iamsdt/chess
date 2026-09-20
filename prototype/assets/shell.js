/* Chess King app shell: sidebar, mobile bottom nav, Sage chat panel, shared interactions.
   Page contract:
     <body data-nav="home" [data-layout="board"] [data-chat="open|closed|none"]
           data-chat-context="what Sage can see" [data-chat-attach="Current position"]
           [data-chat-note="banner text"] [data-chat-state="nokey"] data-chat-quick="q1|q2|q3">
       <template id="chat-seed">
         <div data-divider>Today, 7:42 PM</div>
         <div data-sage data-time="7:42 PM" data-replies="Yes, show me|Not now" data-cta="0">Text or HTML (auto-wrapped in a bubble)</div>
         <div data-sage data-time="7:43 PM"><p class="bubble">…</p><div class="chat-card">…board…</div></div>
         <div data-me data-time="7:43 PM">User message</div>
       </template>
       <main> …page content… </main>
       <dialog class="modal" id="x">…</dialog>
     </body>
   Interactions: [data-open=id] [data-close] [data-toast="msg" data-toast-icon] [data-ask="question"]
   [data-action=theme|chat] [data-tab=x data-group=g] + [data-panel=x data-group=g]
   .seg > * and [data-options] > .option and [data-chips] > * single-select; [data-toggle] toggles .is-active
   .clock[data-tick=seconds] counts down. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  const NAV = [
    { id: 'home', label: 'Today', icon: 'sun', href: 'index.html' },
    { id: 'play', label: 'Play', icon: 'swords', href: 'play-setup.html' },
    { id: 'puzzles', label: 'Puzzles', icon: 'puzzle', href: 'puzzles.html' },
    { id: 'learn', label: 'Learn', icon: 'sprout', href: 'learn.html' },
    { id: 'mistakes', label: 'Mistakes', icon: 'rotate-ccw', href: 'mistakes.html', count: 7 },
    { group: 'Library' },
    { id: 'games', label: 'My games', icon: 'library', href: 'games.html' },
    { id: 'analysis', label: 'Analysis', icon: 'microscope', href: 'analysis.html' },
    { id: 'openings', label: 'Openings', icon: 'book-open', href: 'openings.html' },
    { group: 'You' },
    { id: 'friends', label: 'Friends', icon: 'users', href: 'friends.html', dot: true },
    { id: 'progress', label: 'Growth', icon: 'leaf', href: 'progress.html' },
  ];
  const BOTTOM = ['home', 'play', 'puzzles', 'learn'];

  const shellCss = `
    .ck-app{display:grid;grid-template-columns:232px minmax(0,1fr) 368px;height:100dvh}
    body[data-chat=closed] .ck-app,body[data-chat=none] .ck-app{grid-template-columns:232px minmax(0,1fr)}
    body[data-chat=closed] .ck-chat,body[data-chat=none] .ck-chat{display:none}
    .ck-main{min-height:0;overflow:auto;position:relative}
    .ck-fab{display:none} body[data-chat=closed] .ck-fab{display:inline-flex}
    .ck-bottom{display:none}
    .ck-scrim{display:none}
    .ck-compact .ck-app{grid-template-columns:76px minmax(0,1fr) 368px}
    
    .ck-compact body[data-chat=closed] .ck-app,.ck-compact body[data-chat=none] .ck-app{grid-template-columns:76px minmax(0,1fr)}
    .ck-compact .ck-lbl,.ck-compact .ck-group,.ck-compact .ck-garden,.ck-compact .ck-count{display:none!important}
    .ck-compact .ck-side{padding-left:12px;padding-right:12px}
    .ck-compact .nav-item{justify-content:center;padding:0}
    .ck-compact .ck-brand{justify-content:center;padding-left:0;padding-right:0}
    .ck-compact .ck-foot{flex-direction:column}
    @media (max-width:1280px){
      .ck-app,body[data-chat] .ck-app{grid-template-columns:232px minmax(0,1fr)!important}
      .ck-compact .ck-app{grid-template-columns:76px minmax(0,1fr)!important}
      body[data-chat=open] .ck-chat{display:flex;position:fixed;right:0;top:0;bottom:0;width:min(400px,100vw);z-index:60;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      body[data-chat=open] .ck-scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:55}
      body[data-chat=open] .ck-fab{display:none}
      
    }
    @media (max-height:760px){.ck-garden{display:none!important}}
    @media (max-width:900px){
      .ck-app,body[data-chat] .ck-app,.ck-compact .ck-app{grid-template-columns:minmax(0,1fr)!important}
      .ck-side{display:none!important}
      .ck-bottom{display:grid}
      .ck-main{padding-bottom:76px}
      .ck-fab{bottom:88px!important}
    }`;

  function sidebar(active) {
    const el = document.createElement('aside');
    el.className = 'ck-side flex min-h-0 flex-col bg-sidebar px-3 py-4';
    el.setAttribute('aria-label', 'Main navigation');
    el.innerHTML = `
      <a href="index.html" class="ck-brand flex items-center gap-2.5 px-2 pb-5" aria-label="Chess King home">
        <span class="grid size-9 -rotate-6 place-items-center rounded-xl bg-primary text-reward shadow-sm"><i data-lucide="crown" class="size-5"></i></span>
        <span class="ck-lbl font-display text-lg font-bold tracking-tight">Chess King</span>
      </a>
      <nav class="flex-1 space-y-1 overflow-auto">
        ${NAV.map(n => n.group
          ? `<div class="ck-group label px-3 pb-1 pt-4">${n.group}</div>`
          : `<a class="nav-item relative" href="${n.href}" title="${n.label}" ${n.id === active ? 'aria-current="page"' : ''}>
               <i data-lucide="${n.icon}"></i><span class="ck-lbl">${n.label}</span>
               ${n.count ? `<span class="ck-count ml-auto grid size-5 place-items-center rounded-full bg-cta text-[10px] font-bold text-white">${n.count}</span>` : ''}
               ${n.dot ? `<span class="ml-auto size-2 rounded-full bg-cta"></span>` : ''}
             </a>`).join('')}
      </nav>
      <a href="progress.html" class="ck-garden card card-hover mt-3 block overflow-hidden p-4">
        <div class="flex items-center justify-between"><span class="label">Your chess garden</span><span class="badge badge-soft">Lv 4</span></div>
        <svg viewBox="0 0 180 70" class="mt-2 h-14 w-full" aria-hidden="true">
          <path d="M0 62 Q90 54 180 62 L180 70 L0 70Z" fill="var(--accent)"/>
          <path d="M90 62 C90 48 90 38 91 26" stroke="#5f8b6c" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M91 40 C80 36 72 30 70 20 C82 20 90 28 91 40Z" fill="#8fb88f"/>
          <path d="M91 32 C101 28 110 22 112 12 C100 12 92 20 91 32Z" fill="#6c9d73"/>
          <circle cx="91" cy="22" r="5" fill="var(--reward)"/>
        </svg>
        <p class="text-sm font-medium">Sapling · 12-day streak</p>
        <p class="text-xs text-muted-foreground">3 more days to bloom · 1 freeze saved</p>
      </a>
      <div class="ck-foot mt-3 flex items-center gap-1">
        <a href="settings.html" class="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 hover:bg-card" title="Profile & settings">
          <span class="avatar size-8 bg-primary text-primary-foreground">SK</span>
          <span class="ck-lbl min-w-0 leading-tight"><span class="block truncate text-sm font-medium">Shudipto</span><span class="block text-xs text-muted-foreground">Local profile</span></span>
        </a>
        <a href="settings.html" class="btn btn-ghost btn-icon btn-sm ${active === 'settings' ? 'bg-card ring-1 ring-border' : ''}" title="Settings" aria-label="Settings"><i data-lucide="settings"></i></a>
        <button class="btn btn-ghost btn-icon btn-sm" data-action="theme" title="Toggle dark mode" aria-label="Toggle dark mode"><i data-lucide="moon"></i></button>
      </div>`;
    return el;
  }

  function bottomNav(active) {
    const el = document.createElement('nav');
    el.className = 'ck-bottom fixed inset-x-0 bottom-0 z-40 grid-cols-5 border-t bg-card/95 px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur';
    el.setAttribute('aria-label', 'Main');
    el.innerHTML = BOTTOM.map(id => NAV.find(n => n.id === id)).map(n =>
      `<a href="${n.href}" class="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${n.id === active ? 'text-primary' : 'text-muted-foreground'}"><i data-lucide="${n.icon}" class="size-5"></i>${n.label}</a>`).join('')
      + `<button data-action="chat" class="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-cta"><i data-lucide="message-circle" class="size-5"></i>Sage</button>`;
    return el;
  }

  /* ---------- chat ---------- */
  const SAGE_AV = '<div class="sage-av"><i data-lucide="brain" class="size-3.5"></i></div>';
  const esc = t => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  function sageMsg(inner, time, replies = [], cta = -1) {
    const body = /class="(bubble|chat-card)/.test(inner) ? inner : `<div class="bubble">${inner}</div>`;
    return `<div class="flex gap-2.5 rise">${SAGE_AV}<div class="min-w-0 space-y-1.5">${body}
      ${replies.length ? `<div class="flex flex-wrap gap-1.5 pt-0.5">${replies.map((r, i) => `<button class="reply ${i === cta ? 'reply-cta' : ''}" data-ask="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
      ${time ? `<div class="msg-time">${time}</div>` : ''}</div></div>`;
  }
  function meMsg(text, time) {
    return `<div class="flex justify-end rise"><div class="max-w-[82%] space-y-1.5 text-right"><div class="bubble-me">${text}</div>${time ? `<div class="msg-time">${time} · Read</div>` : ''}</div></div>`;
  }
  function divider(t) { return `<div class="flex items-center gap-3 text-[11px] font-medium text-muted-foreground"><span class="h-px flex-1 bg-border"></span>${t}<span class="h-px flex-1 bg-border"></span></div>`; }

  function seedHtml() {
    const t = $('#chat-seed');
    if (!t) return divider('Today') + sageMsg('Hi! I can see what you\'re working on. Ask me <b>why</b>, not just what. That\'s how it sticks.', now());
    return [...t.content.children].map(n => {
      if (n.hasAttribute('data-divider')) return divider(n.innerHTML);
      if (n.hasAttribute('data-me')) return meMsg(n.innerHTML, n.dataset.time);
      if (n.hasAttribute('data-sage')) return sageMsg(n.innerHTML, n.dataset.time, (n.dataset.replies || '').split('|').filter(Boolean), n.dataset.cta ? +n.dataset.cta : -1);
      return n.outerHTML;
    }).join('');
  }

  function chatPanel(b) {
    const noKey = b.dataset.chatState === 'nokey';
    const el = document.createElement('aside');
    el.className = 'ck-chat flex min-h-0 flex-col border-l bg-card';
    el.setAttribute('aria-label', 'Chat with Sage');
    const quick = (b.dataset.chatQuick || '').split('|').filter(Boolean);
    el.innerHTML = `
      <header class="flex items-center gap-3 border-b px-4 py-3">
        <div class="relative grid size-10 place-items-center rounded-2xl bg-primary text-reward"><i data-lucide="brain" class="size-5"></i><span class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${noKey ? 'bg-muted-foreground' : 'bg-[#6fcf8e]'}"></span></div>
        <div class="min-w-0 flex-1 leading-tight"><div class="font-display text-base font-bold">Sage</div><div class="truncate text-xs text-muted-foreground">${noKey ? 'Needs your API key' : 'Online · your Gemini key'}</div></div>
        <a class="btn btn-ghost btn-icon btn-sm" href="settings.html#coach" title="Coach settings" aria-label="Coach settings"><i data-lucide="sliders-horizontal"></i></a>
        <button class="btn btn-ghost btn-icon btn-sm" data-action="new-chat" title="New chat" aria-label="New chat"><i data-lucide="square-pen"></i></button>
        <button class="btn btn-ghost btn-icon btn-sm" data-action="chat" title="Close chat" aria-label="Close chat"><i data-lucide="panel-right-close"></i></button>
      </header>
      ${b.dataset.chatContext ? `<div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground"><i data-lucide="eye" class="size-3.5"></i><span class="truncate">Sage sees: ${b.dataset.chatContext}</span></div>` : ''}
      ${b.dataset.chatNote ? `<div class="m-3 mb-0 flex gap-2 rounded-xl border border-reward/40 bg-reward-soft px-3 py-2.5 text-xs text-reward-ink"><i data-lucide="info" class="mt-px size-3.5"></i><span>${b.dataset.chatNote}</span></div>` : ''}
      <div class="ck-thread min-h-0 flex-1 space-y-5 overflow-auto px-4 py-5" aria-live="polite">
        ${noKey ? `<div class="rounded-2xl border border-dashed p-4 text-sm">
            <div class="flex items-center gap-2 font-semibold"><i data-lucide="key-round" class="text-cta"></i>Bring your own key</div>
            <p class="mt-1.5 text-muted-foreground">Sage runs on your Gemini, OpenAI or Anthropic key. It's encrypted in this browser and only sent to the provider.</p>
            <a href="settings.html#coach" class="btn btn-default btn-sm mt-3"><i data-lucide="plus"></i>Add API key</a>
            <p class="mt-2 text-xs text-muted-foreground">Everything else in Chess King works without it.</p></div>` : seedHtml()}
      </div>
      <div class="border-t p-3">
        ${quick.length ? `<div class="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">${quick.map(q => `<button class="reply shrink-0 whitespace-nowrap" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
        <form class="ck-form rounded-2xl border bg-background focus-within:ring-[3px] focus-within:ring-ring/40">
          ${b.dataset.chatAttach ? `<div class="flex items-center gap-1.5 px-3 pt-2.5"><span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><i data-lucide="layout-grid" class="size-3"></i>Attached: ${b.dataset.chatAttach}<button type="button" class="ml-0.5 hover:text-foreground" aria-label="Remove attachment" onclick="this.parentElement.remove()"><i data-lucide="x" class="size-3"></i></button></span></div>` : ''}
          <textarea rows="2" class="block w-full resize-none bg-transparent px-3 pt-2 text-sm outline-none placeholder:text-muted-foreground" placeholder="Message Sage…" aria-label="Message Sage" ${noKey ? 'disabled' : ''}></textarea>
          <div class="flex items-center gap-0.5 p-1.5">
            <button type="button" class="btn btn-ghost btn-icon btn-sm" title="Attach position or game" aria-label="Attach position or game"><i data-lucide="paperclip"></i></button>
            <button type="button" class="btn btn-ghost btn-sm text-primary" data-toggle title="Sage won't reveal puzzle answers"><i data-lucide="eye-off" class="size-3.5"></i>No spoilers</button>
            <button type="button" class="btn btn-ghost btn-sm text-muted-foreground" data-toggle title="Let Sage read engine lines"><i data-lucide="cpu" class="size-3.5"></i>Engine</button>
            <button type="submit" class="btn btn-default btn-icon btn-sm ml-auto rounded-full" aria-label="Send" ${noKey ? 'disabled' : ''}><i data-lucide="arrow-up"></i></button>
          </div>
        </form>
        <p class="mt-2 text-center text-[11px] text-muted-foreground">Enter to send · key stays encrypted in this browser</p>
      </div>`;
    return el;
  }

  const CANNED = [
    'Good question. The short answer: <b>look at every check and capture first</b>, for both sides. Most of your lost games this week turned on a move you never considered because it looked "quiet".',
    'I won\'t give it away. <b>Hint:</b> which of your pieces is doing nothing right now? Start there.',
    'Here\'s the idea in plain words: trade when you\'re ahead, <b>keep pieces when you\'re behind</b>. Your position is better, so simplifying helps you.',
    'You\'re closer than you think. That plan is exactly what a 1600 player would try here. The only fix is the move order: castle first, <b>then</b> push the f-pawn.',
  ];
  let ci = 0;
  function ask(text) {
    const th = $('.ck-thread'); if (!th) return;
    setChat('open');
    th.insertAdjacentHTML('beforeend', meMsg(esc(text), now()));
    th.insertAdjacentHTML('beforeend', `<div class="ck-typing flex items-center gap-2.5">${SAGE_AV}<div class="flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted px-4 py-3"><span class="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"></span><span class="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:.15s]"></span><span class="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:.3s]"></span></div></div>`);
    icons(); th.scrollTop = th.scrollHeight;
    setTimeout(() => {
      $('.ck-typing', th)?.remove();
      th.insertAdjacentHTML('beforeend', sageMsg(CANNED[ci++ % CANNED.length], now()));
      icons(); th.scrollTop = th.scrollHeight;
    }, 1000);
  }

  function setChat(state) {
    const b = document.body;
    if (b.dataset.chat === 'none') return;
    b.dataset.chat = state;
    if (innerWidth > 1280) store.set('ck-chat', state);
  }

  function compact() {
    const w = innerWidth, board = document.body.dataset.layout === 'board';
    root.classList.toggle('ck-compact', (board && w < 1600 && w > 900) || (w <= 1100 && w > 900));
  }

  function toast(msg, icon = 'check') {
    let box = $('.ck-toasts');
    if (!box) { box = document.createElement('div'); box.className = 'ck-toasts pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'rise flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg';
    t.innerHTML = `<i data-lucide="${icon}"></i><span></span>`;
    t.querySelector('span').textContent = msg;
    box.appendChild(t); icons();
    setTimeout(() => t.remove(), 2800);
  }
  function icons() { window.lucide?.createIcons(); }
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function boot() {
    const b = document.body;
    const st = document.createElement('style'); st.textContent = shellCss; document.head.appendChild(st);
    const main = $('body > main');
    if (main && b.dataset.nav !== undefined) {
      main.classList.add('ck-main');
      const app = document.createElement('div');
      app.className = 'ck-app';
      b.insertBefore(app, main);
      app.append(sidebar(b.dataset.nav), main);
      if (b.dataset.chat !== 'none') {
        app.append(chatPanel(b));
        const fab = document.createElement('button');
        fab.className = 'ck-fab fixed bottom-6 right-6 z-40 items-center gap-2 rounded-full bg-primary py-2 pl-2 pr-4 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90';
        fab.dataset.action = 'chat';
        fab.innerHTML = '<span class="grid size-8 place-items-center rounded-full bg-primary-foreground/15 text-reward"><i data-lucide="brain" class="size-4"></i></span>Ask Sage';
        const scrim = document.createElement('div'); scrim.className = 'ck-scrim'; scrim.dataset.action = 'chat';
        b.append(fab, scrim);
        const saved = store.get('ck-chat', null);
        b.dataset.chat = innerWidth <= 1280 ? 'closed' : (b.dataset.chat === 'closed' ? 'closed' : (saved || 'open'));
      }
      b.append(bottomNav(b.dataset.nav));
      compact(); addEventListener('resize', compact);
      const th = $('.ck-thread'); if (th) th.scrollTop = th.scrollHeight;
    }

    document.addEventListener('click', e => {
      const t = e.target.closest('[data-action],[data-open],[data-close],[data-toast],[data-ask],[data-tab],[data-toggle],.seg > *,[data-options] > .option,[data-chips] > *');
      if (!t) return;
      const a = t.dataset.action;
      if (a === 'chat') setChat(b.dataset.chat === 'open' ? 'closed' : 'open');
      if (a === 'theme') { root.classList.toggle('dark'); store.set('ck-theme', root.classList.contains('dark') ? 'dark' : 'light'); }
      if (a === 'new-chat') { $('.ck-thread').innerHTML = divider('New chat') + sageMsg('Fresh start. What are we working on?', now()); icons(); }
      if (t.dataset.open) document.getElementById(t.dataset.open)?.showModal();
      if (t.hasAttribute('data-close')) t.closest('dialog')?.close();
      if (t.dataset.toast) toast(t.dataset.toast, t.dataset.toastIcon);
      if (t.dataset.ask) ask(t.dataset.ask);
      if (t.hasAttribute('data-toggle')) t.classList.toggle('is-active');
      if (t.dataset.tab) {
        const g = t.dataset.group || 'default';
        $$('[data-tab]').filter(x => (x.dataset.group || 'default') === g).forEach(x => x.classList.toggle('is-active', x === t));
        $$('[data-panel]').filter(p => (p.dataset.group || 'default') === g).forEach(p => { p.hidden = p.dataset.panel !== t.dataset.tab; });
      }
      if (t.matches('.seg > *, [data-options] > .option, [data-chips] > *') && !t.dataset.tab) {
        [...t.parentElement.children].forEach(c => c.classList.toggle('is-active', c === t));
      }
    });
    $$('dialog.modal').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

    const form = $('.ck-form');
    if (form) {
      const ta = $('textarea', form);
      form.addEventListener('submit', e => { e.preventDefault(); const v = ta.value.trim(); if (v) { ta.value = ''; ask(v); } });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    }
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { const ta = $('.ck-form textarea'); if (ta) { e.preventDefault(); setChat('open'); ta.focus(); } }
      if (e.key === 'Escape' && b.dataset.chat === 'open' && innerWidth <= 1280) setChat('closed');
    });
    $$('.clock[data-tick]').forEach(c => { let s = +c.dataset.tick; setInterval(() => { if (s > 0) s--; c.textContent = fmt(s); c.classList.toggle('is-low', s < 20); }, 1000); });
    icons();
  }

  window.CK = { toast, ask, setChat, icons, store };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
