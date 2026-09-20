/* Chess King · Grove Bloom design system (Tailwind v4 browser + shadcn/ui token contract).
   Load SYNCHRONOUSLY in <head> BEFORE the Tailwind browser script:
     <script src="assets/theme.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
   It injects the <style type="text/tailwindcss"> block below and applies the saved theme. */
(function () {
  const css = String.raw`
:root{
  --background:#f7f3ec; --foreground:#1b2620;
  --card:#ffffff; --card-foreground:#1b2620;
  --popover:#ffffff; --popover-foreground:#1b2620;
  --primary:#24463a; --primary-foreground:#f7f3ec;
  --secondary:#f0ebe1; --secondary-foreground:#24463a;
  --muted:#f0ebe1; --muted-foreground:#6a7068;
  --accent:#e4efe3; --accent-foreground:#24463a;
  --destructive:#c2412d; --destructive-soft:#fbe6e1;
  --border:#e8e1d4; --input:#e2dacb; --ring:#5f8b6c;
  --cta:#e0673c; --cta-strong:#b24f2b; --cta-soft:#fdf0ea; --cta-foreground:#ffffff;
  --reward:#f2c24e; --reward-soft:#fdf3d8; --reward-ink:#7a5710;
  --sky:#dcebf3; --sky-ink:#2d5a78; --lilac:#ece7fb; --lilac-ink:#5a48b0;
  --success:#3f7a4a; --sidebar:#f7f3ec; --radius:1rem;
  /* move quality */
  --q-brilliant:#1fb89a; --q-great:#5b8fc9; --q-best:#5f8b6c; --q-excellent:#7da35f; --q-good:#9aa88f; --q-book:#a8845c;
  --q-inaccuracy:#e9b949; --q-mistake:#e58a3c; --q-miss:#e46a55; --q-blunder:#cf3b2c;
  /* board */
  --vb-light:#f5eedf; --vb-dark:#a3b89b; --vb-hl:rgba(242,194,78,.55); --vb-sel:rgba(36,70,58,.35);
  --vb-arrow:rgba(36,70,58,.85); --vb-arrow-alt:rgba(224,103,60,.92); --vb-arrow-ai:rgba(90,72,176,.85); --vb-focus:#e0673c;
}
.dark{
  --background:#0e1311; --foreground:#e9eee8;
  --card:#151b17; --card-foreground:#e9eee8; --popover:#151b17; --popover-foreground:#e9eee8;
  --primary:#b5d3a8; --primary-foreground:#0f1a10;
  --secondary:#1b231f; --secondary-foreground:#dfe8da;
  --muted:#1d2621; --muted-foreground:#8f9a92;
  --accent:#1f2b24; --accent-foreground:#cfe3c6;
  --destructive:#f07a64; --destructive-soft:rgba(240,122,100,.12);
  --border:#26322b; --input:#2c3a32; --ring:#7fa07a;
  --cta:#ec7d4f; --cta-strong:#b55a33; --cta-soft:rgba(236,125,79,.12); --cta-foreground:#1b0b03;
  --reward:#f2c867; --reward-soft:rgba(242,200,103,.12); --reward-ink:#f2c867;
  --sky:rgba(143,184,212,.14); --sky-ink:#9cc4de; --lilac:rgba(165,148,255,.13); --lilac-ink:#b9adff;
  --success:#8fcf95; --sidebar:#0e1311;
  --vb-light:#dfe2d4; --vb-dark:#7d977b; --vb-arrow:rgba(181,211,168,.95); --vb-arrow-ai:rgba(185,173,255,.9);
}
[data-board="walnut"]{--vb-light:#f0d9b5;--vb-dark:#b58863}
[data-board="slate"]{--vb-light:#dee3e6;--vb-dark:#8ca2ad}
[data-board="dusk"]{--vb-light:#dde3ec;--vb-dark:#8190ad}
[data-board="sand"]{--vb-light:#f3e4cf;--vb-dark:#d19a78}

@theme inline{
  --color-background:var(--background); --color-foreground:var(--foreground);
  --color-card:var(--card); --color-card-foreground:var(--card-foreground);
  --color-popover:var(--popover); --color-popover-foreground:var(--popover-foreground);
  --color-primary:var(--primary); --color-primary-foreground:var(--primary-foreground);
  --color-secondary:var(--secondary); --color-secondary-foreground:var(--secondary-foreground);
  --color-muted:var(--muted); --color-muted-foreground:var(--muted-foreground);
  --color-accent:var(--accent); --color-accent-foreground:var(--accent-foreground);
  --color-destructive:var(--destructive); --color-destructive-soft:var(--destructive-soft);
  --color-border:var(--border); --color-input:var(--input); --color-ring:var(--ring);
  --color-cta:var(--cta); --color-cta-strong:var(--cta-strong); --color-cta-soft:var(--cta-soft); --color-cta-foreground:var(--cta-foreground);
  --color-reward:var(--reward); --color-reward-soft:var(--reward-soft); --color-reward-ink:var(--reward-ink);
  --color-sky:var(--sky); --color-sky-ink:var(--sky-ink); --color-lilac:var(--lilac); --color-lilac-ink:var(--lilac-ink);
  --color-success:var(--success); --color-sidebar:var(--sidebar);
  --color-q-brilliant:var(--q-brilliant); --color-q-great:var(--q-great); --color-q-best:var(--q-best); --color-q-excellent:var(--q-excellent); --color-q-good:var(--q-good); --color-q-book:var(--q-book); --color-q-inaccuracy:var(--q-inaccuracy); --color-q-mistake:var(--q-mistake); --color-q-miss:var(--q-miss); --color-q-blunder:var(--q-blunder);
  --radius-sm:calc(var(--radius) - 6px); --radius-md:calc(var(--radius) - 4px); --radius-lg:var(--radius); --radius-xl:calc(var(--radius) + 6px);
  --font-sans:'Inter',system-ui,sans-serif; --font-display:'Bricolage Grotesque',system-ui,sans-serif; --font-mono:'JetBrains Mono',ui-monospace,monospace;
}
@custom-variant dark (&:where(.dark, .dark *));

@layer base{
  *{@apply border-border outline-ring/50}
  html,body{@apply h-full}
  body{@apply bg-background text-foreground font-sans antialiased}
  [data-lucide]{@apply size-4 shrink-0}
  h1,h2,h3{@apply font-display tracking-tight}
  ::selection{@apply bg-accent}
}
@layer components{
  /* buttons */
  .btn{@apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 cursor-pointer outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50}
  .btn-default{@apply bg-primary text-primary-foreground hover:bg-primary/90}
  .btn-cta{@apply bg-cta text-cta-foreground font-semibold h-11 px-6 text-[15px] rounded-xl shadow-[0_4px_0_var(--cta-strong)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_var(--cta-strong)]}
  .btn-secondary{@apply bg-secondary text-secondary-foreground hover:bg-secondary/80}
  .btn-outline{@apply border bg-card hover:bg-accent hover:text-accent-foreground}
  .btn-ghost{@apply hover:bg-accent hover:text-accent-foreground}
  .btn-destructive{@apply bg-destructive-soft text-destructive hover:bg-destructive hover:text-white}
  .btn-sm{@apply h-8 px-3 text-xs rounded-md gap-1.5}
  .btn-lg{@apply h-11 px-6 text-[15px] rounded-xl}
  .btn-icon{@apply size-9 px-0}
  .btn-icon.btn-sm{@apply size-8}
  /* surfaces */
  .card{@apply bg-card text-card-foreground rounded-xl border shadow-[0_1px_2px_rgba(40,30,10,.04)]}
  .card-hover{@apply transition hover:-translate-y-0.5 hover:shadow-md}
  .badge{@apply inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap}
  .badge-soft{@apply border-transparent bg-accent text-accent-foreground}
  .badge-cta{@apply border-transparent bg-cta text-white}
  .badge-reward{@apply border-transparent bg-reward-soft text-reward-ink}
  .badge-danger{@apply border-destructive/30 text-destructive}
  .label{@apply text-xs font-medium text-muted-foreground}
  .eyebrow{@apply text-xs font-semibold uppercase tracking-wider text-muted-foreground}
  .kbd{@apply inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground}
  .san{@apply rounded bg-muted px-1 py-px font-mono text-[12.5px] font-medium text-foreground}
  .page{@apply mx-auto w-full max-w-[1100px] p-6 lg:p-8}
  .page-title{@apply font-display text-[32px] font-bold leading-tight tracking-tight}
  /* forms */
  .input{@apply flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:border-ring}
  .textarea{@apply w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40}
  .field-label{@apply text-sm font-medium}
  .help{@apply text-xs text-muted-foreground}
  .switch{@apply relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors has-[:checked]:bg-primary}
  .switch input{@apply sr-only}
  .switch span{@apply pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform}
  .switch:has(input:checked) span{@apply translate-x-[18px]}
  .switch:has(input:focus-visible){@apply ring-[3px] ring-ring/50}
  .seg{@apply inline-flex rounded-lg bg-muted p-1 text-sm}
  .seg > *{@apply rounded-md px-3 py-1.5 font-medium text-muted-foreground transition cursor-pointer}
  .seg > .is-active{@apply bg-card text-foreground shadow-sm}
  .tabs{@apply flex gap-1 border-b}
  .tab{@apply -mb-px border-b-2 border-transparent px-3 pb-2.5 pt-1 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer}
  .tab.is-active{@apply border-primary text-foreground}
  .option{@apply flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-ring/60}
  .option.is-active{@apply border-primary bg-accent/50 ring-2 ring-primary/20}
  .progress{@apply h-2 w-full overflow-hidden rounded-full bg-muted}
  .progress > span{@apply block h-full rounded-full bg-primary transition-[width] duration-500}
  .avatar{@apply grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold}
  /* nav */
  .nav-item{@apply flex items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium text-foreground/70 hover:bg-card hover:text-foreground transition-colors}
  .nav-item[aria-current]{@apply bg-card text-foreground shadow-[0_1px_2px_rgba(40,30,10,.06)] ring-1 ring-border}
  /* chat */
  .sage-av{@apply grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-reward}
  .bubble{@apply rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed}
  .bubble b{@apply font-semibold text-primary}
  .bubble-me{@apply rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-left text-sm leading-relaxed text-primary-foreground}
  .chat-card{@apply overflow-hidden rounded-2xl border bg-background}
  .reply{@apply rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-accent cursor-pointer}
  .reply-cta{@apply border-cta/40 bg-cta-soft text-cta hover:bg-cta hover:text-white}
  .msg-time{@apply text-[11px] text-muted-foreground}
  /* move quality glyph */
  .q{@apply inline-grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold leading-none text-white}
  .q-brilliant{@apply bg-q-brilliant} .q-great{@apply bg-q-great} .q-best{@apply bg-q-best} .q-excellent{@apply bg-q-excellent} .q-good{@apply bg-q-good} .q-book{@apply bg-q-book}
  .q-inaccuracy{@apply bg-q-inaccuracy text-[#3a2c00]} .q-mistake{@apply bg-q-mistake} .q-miss{@apply bg-q-miss} .q-blunder{@apply bg-q-blunder}
  /* move list */
  .mv{@apply inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[13px] font-medium hover:bg-muted cursor-pointer}
  .mv.is-current{@apply bg-accent text-accent-foreground ring-1 ring-primary/30}
  /* dialog */
  dialog.modal{@apply m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]}
  /* clocks */
  .clock{@apply ml-auto rounded-lg bg-muted px-3 py-1 font-mono text-lg font-semibold tabular-nums text-muted-foreground}
  .clock.is-running{@apply bg-primary text-primary-foreground}
  .clock.is-low{@apply bg-destructive text-white}
}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.rise{animation:rise .45s cubic-bezier(.2,.8,.2,1) both}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:1ms!important;transition-duration:1ms!important}}
`;
  const s = document.createElement('style');
  s.type = 'text/tailwindcss';
  s.textContent = css;
  document.head.appendChild(s);

  // fonts
  const f = document.createElement('link');
  f.rel = 'stylesheet';
  f.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';
  document.head.appendChild(f);

  // saved preferences (applied before paint)
  try {
    const t = localStorage.getItem('ck-theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
    const b = localStorage.getItem('ck-board');
    if (b) document.documentElement.dataset.board = b;
  } catch {}
})();
