// ══════════════════════════════════════════════
//  THE GOTED — Neo-Brutalism Second Brain
//  CONFIG — fill these in
// ══════════════════════════════════════════════
const SUPABASE_URL = 'https://txnvlqwffqqfclgjrmjz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnZscXdmZnFxZmNsZ2pybWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTI2NTAsImV4cCI6MjA4NzMyODY1MH0.yatl3EHdm5pApKofUw9vUzCjsXFE0sFaEwRJ-88rGSc';
// ══════════════════════════════════════════════

let sb, items = [], user = null, current = null, filterCat = 'all', q = '', dirtyEntry = false;
const STATUS = { ACTIVE: 'active', ARCHIVED: 'archived', DELETED: 'deleted' };
let calYear = 2026, calMonth = 1; // 0-indexed: Jan=0, Feb=1

// ─── INIT ─────────────────────────────────────
window.onload = async () => {
  if (SUPABASE_URL.includes('YOUR_')) {
    const login = document.getElementById('login');
    login.innerHTML = `
      <div class="p-8 bg-white border-4 border-black shadow-neo rounded-2xl max-w-sm text-center">
        <h2 class="text-2xl font-black mb-4 uppercase">Configuration Required</h2>
        <p class="font-mono text-sm leading-relaxed border-2 border-dashed border-black p-4 bg-yellow-50">
          Open <b class="bg-primary px-1">app.js</b> and set<br/>
          <b>SUPABASE_URL</b> and <b>SUPABASE_KEY</b>
        </p>
      </div>`;
    login.classList.remove('hidden');
    login.classList.add('flex');
    return;
  }

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Check session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    boot(session.user);
  } else {
    show('login');
  }

  // Auth changes
  sb.auth.onAuthStateChange((event, session) => {
    if (session) {
      boot(session.user);
    } else {
      user = null;
      show('login');
    }
  });
};

async function boot(u) {
  if (!u) return;
  user = u;
  show('app');
  switchView('dashboard');
  await load();
  initCollab();
}

function switchView(view) {
  // Auto-close sidebar when switching views
  closeSidebarIfOpen();

  // Hide all views
  document.querySelectorAll('.app-view').forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('flex');
  });
  // Show target view
  const target = document.getElementById(`view-${view}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('flex');
  }

  // Update nav icons
  document.querySelectorAll('.nav-icon').forEach(btn => {
    btn.classList.remove('bg-primary', 'shadow-neo-lg');
    btn.classList.add('bg-white', 'dark:bg-gray-800', 'shadow-neo-sm');
  });

  // Find the button and set it active (would be better with data attributes, but we'll use title for now or specific selection)
  const navBtn = document.querySelector(`.nav-icon[onclick*="${view}"]`);
  if (navBtn) {
    navBtn.classList.remove('bg-white', 'dark:bg-gray-800', 'shadow-neo-sm');
    navBtn.classList.add('bg-primary', 'shadow-neo-lg');
  }

  // Render content if needed
  if (view === 'dashboard') render();
  if (view === 'gallery') renderGallery();
  if (view === 'flashcards') initFlashcards();
  if (view === 'braindump') {
    document.getElementById('braindump-input').focus();
    initBrainDump();
  }
  if (view === 'mindmap') renderMindMap();
  if (view === 'calendar') renderCalendar();
  if (view === 'trash') {
    renderArchive();
    renderTrash();
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const f = filtered();

  const typeColors = {
    note: 'bg-neo-green',
    link: 'bg-neo-purple',
    code: 'bg-neo-blue',
    idea: 'bg-neo-yellow',
    file: 'bg-neo-pink'
  };

  if (!f.length) {
    grid.innerHTML = '<div class="col-span-full text-center p-10 font-bold opacity-50">EMPTY VAULT</div>';
    return;
  }

  grid.innerHTML = f.map(i => {
    const type = i.type || 'note';
    const colorClass = typeColors[type] || 'bg-white';

    return `
    <div class="break-inside-avoid mb-6 relative flex flex-col rounded-xl border-3 border-black dark:border-white ${colorClass} p-0 shadow-neo transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer"
         onclick="selectAndOpen('${i.id}')">
      <div class="flex items-center justify-between border-b-3 border-black dark:border-white p-3">
        <div class="flex items-center gap-2">
           <span class="material-icons-outlined text-sm font-bold">${type === 'link' ? 'link' : (type === 'code' ? 'code' : 'description')}</span>
           <span class="font-bold text-[10px] uppercase">${type}</span>
        </div>
      </div>
      <div class="p-4">
        <h3 class="text-lg font-bold leading-tight text-black">${esc(i.title || 'UNTITLED')}</h3>
        ${i.content ? `<div class="mt-3 text-xs opacity-80 line-clamp-4 font-mono text-black">${esc(i.content)}</div>` : ''}
        <div class="mt-4 flex flex-wrap gap-1">
          ${(i.tags || []).map(t => `<span class="bg-white/50 border border-black/20 rounded px-1.5 py-0.5 text-[9px] font-bold text-black">#${t}</span>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderArchive() {
  const grid = document.getElementById('archive-grid');
  const arch = items.filter(i => i.status === STATUS.ARCHIVED);

  if (!arch.length) {
    grid.innerHTML = '<div class="col-span-full text-center p-10 font-bold opacity-30 border-2 border-dashed border-black">VAULT IS EMPTY</div>';
    return;
  }

  grid.innerHTML = arch.map(i => `
    <div class="bg-white dark:bg-gray-800 border-3 border-black dark:border-white p-4 shadow-neo-sm relative group">
      <h3 class="font-bold text-lg mb-2">${esc(i.title)}</h3>
      <div class="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="setStatus('${i.id}', '${STATUS.ACTIVE}')" class="bg-success text-black border-2 border-black px-3 py-1 font-bold text-xs uppercase shadow-neo-sm active:translate-y-0.5 active:shadow-none">Restore</button>
        <button onclick="setStatus('${i.id}', '${STATUS.DELETED}')" class="bg-neo-pink text-black border-2 border-black px-3 py-1 font-bold text-xs uppercase shadow-neo-sm active:translate-y-0.5 active:shadow-none">Trash</button>
      </div>
    </div>
  `).join('');
}

function renderTrash() {
  const grid = document.getElementById('trash-grid');
  const del = items.filter(i => i.status === STATUS.DELETED);

  if (!del.length) {
    grid.innerHTML = '<div class="col-span-full text-center p-10 font-bold opacity-30 border-2 border-dashed border-black">INCINERATOR IS COLD</div>';
    return;
  }

  grid.innerHTML = del.map(i => `
    <div class="bg-white border-3 border-black p-4 shadow-neo-sm relative group transform hover:rotate-0 rotate-${Math.floor(Math.random() * 4) - 2}">
      <div class="absolute -top-3 -right-3 bg-black text-white text-[9px] font-bold px-2 py-1 border-2 border-white shadow-sm rotate-12">29 DAYS LEFT</div>
      <h3 class="font-bold text-sm mb-2">${esc(i.title)}</h3>
      <div class="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="setStatus('${i.id}', '${STATUS.ACTIVE}')" class="bg-success text-black border-2 border-black px-2 py-1 font-bold text-[10px] uppercase shadow-neo-sm active:translate-y-0.5 active:shadow-none">Rescue</button>
        <button onclick="deleteForever('${i.id}')" class="bg-black text-white border-2 border-white px-2 py-1 font-bold text-[10px] uppercase shadow-neo-sm active:translate-y-0.5 active:shadow-none">Burn</button>
      </div>
    </div>
  `).join('');
}

async function setStatus(id, status) {
  const { error } = await sb.from('items').update({ status }).eq('id', id);
  if (error) alert(error.message);
  else {
    await load();
    if (document.getElementById('view-trash').classList.contains('hidden')) render();
    else { renderArchive(); renderTrash(); }
  }
}

async function archiveItem() {
  if (!current) return;
  await setStatus(current.id, STATUS.ARCHIVED);
  current = null;
  document.getElementById('editor-form').classList.add('hidden');
  document.getElementById('editor-empty').classList.remove('hidden');
}

async function deleteForever(id) {
  if (!confirm('PERMANENTLY INCINERATE THIS DATA?')) return;
  const { error } = await sb.from('items').delete().eq('id', id);
  if (error) alert(error.message);
  else {
    await load();
    renderArchive();
    renderTrash();
  }
}

function initBrainDump() {
  const input = document.getElementById('braindump-input');
  const count = document.getElementById('braindump-wordcount');
  input.addEventListener('input', () => {
    const words = input.value.trim() ? input.value.trim().split(/\s+/).length : 0;
    count.innerText = `${words} WORDS`;
  });
}

async function lockInBrainDump() {
  const text = document.getElementById('braindump-input').value.trim();
  if (!text) return;

  const statusEl = document.getElementById('braindump-sync');
  statusEl.innerHTML = '<div class="w-1.5 h-1.5 bg-primary rounded-full animate-spin"></div><span class="text-[9px] font-bold uppercase">Processing...</span>';

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const newItems = lines.map(line => ({
    title: line.substring(0, 40) + (line.length > 40 ? '...' : ''),
    content: line,
    type: 'note',
    category: 'Dump',
    status: STATUS.ACTIVE,
    user_id: user.id
  }));

  let finalItems = newItems;
  const { data, error } = await sb.from('items').insert(newItems).select();

  if (error) {
    if (user && user.email === 'dev@goted.com') {
      console.warn("Supabase insert failed. Using local mock data.", error);
      finalItems = newItems.map((item, idx) => ({
        id: 'mock-' + Date.now() + '-' + idx,
        ...item,
        created_at: new Date().toISOString(),
        status: 'active'
      }));
      // Simulate realtime event for Collab Feed
      if (typeof handleRealtimeEvent === 'function') {
        finalItems.forEach(item => handleRealtimeEvent({ eventType: 'INSERT', new: item }));
      }
    } else {
      alert(error.message);
      statusEl.innerHTML = '<div class="w-1.5 h-1.5 bg-red-500 rounded-full"></div><span class="text-[9px] font-bold uppercase">Error</span>';
      return;
    }
  } else if (data) {
    finalItems = data;
  }

  document.getElementById('braindump-input').value = '';
  statusEl.innerHTML = '<div class="w-1.5 h-1.5 bg-success rounded-full"></div><span class="text-[9px] font-bold uppercase">Crystallized!</span>';

  items.unshift(...finalItems);
  render();
  renderCalendar();
  if (typeof updateFilterCounts === 'function') updateFilterCounts();
  status('CAPTURED ✓');

  setTimeout(() => {
    switchView('dashboard');
  }, 1000);
}

function openSerendipity() {
  document.getElementById('modal-serendipity').classList.remove('hidden');
  document.getElementById('serendipity-display').classList.add('hidden');
}

function closeSerendipity() {
  document.getElementById('modal-serendipity').classList.add('hidden');
}

function surpriseMe() {
  const display = document.getElementById('serendipity-display');
  const activeItems = items.filter(i => (i.status || STATUS.ACTIVE) === STATUS.ACTIVE);

  if (!activeItems.length) {
    alert("YOUR VAULT IS TRULY EMPTY.");
    return;
  }

  const random = activeItems[Math.floor(Math.random() * activeItems.length)];

  document.getElementById('serendipity-title').innerText = random.title || 'UNTITLED';
  document.getElementById('serendipity-content').innerText = random.content || '';
  document.getElementById('serendipity-tags').innerHTML = (random.tags || []).map(t => `<span class="bg-black text-white px-2 py-0.5 text-[9px] font-bold">#${t}</span>`).join('');

  display.classList.remove('hidden');
  display.classList.add('animate-neo-pop');
}

let studySession = [], currentCardIndex = 0;

function initFlashcards() {
  document.getElementById('flashcard').classList.add('hidden');
  document.getElementById('flashcard-empty').classList.remove('hidden');
  document.getElementById('study-actions').classList.add('invisible');
  document.getElementById('study-progress').innerText = '0 / 0';
  document.getElementById('fc-progress-bar').style.width = '0%';
}

function startStudySession() {
  studySession = items.filter(i => (i.status || STATUS.ACTIVE) === STATUS.ACTIVE).sort(() => Math.random() - 0.5).slice(0, 10);
  if (!studySession.length) return alert("VAULT IS EMPTY.");

  currentCardIndex = 0;
  document.getElementById('flashcard-empty').classList.add('hidden');
  document.getElementById('flashcard').classList.remove('hidden');
  document.getElementById('study-actions').classList.remove('invisible');
  const fc = document.getElementById('flashcard');

  showCard();
}

function showCard() {
  const card = studySession[currentCardIndex];
  const fc = document.getElementById('flashcard');
  fc.children[0].classList.remove('rotate-y-180');

  document.getElementById('fc-front-text').innerText = card.title || 'UNTITLED';
  document.getElementById('fc-back-text').innerText = card.content || '';
  document.getElementById('study-progress').innerText = `${currentCardIndex + 1} / ${studySession.length}`;
  const pct = ((currentCardIndex + 1) / studySession.length * 100).toFixed(0);
  document.getElementById('fc-progress-bar').style.width = pct + '%';
}

function prevFlashcard() {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    showCard();
  }
}

function nextFlashcard(success) {
  currentCardIndex++;
  if (currentCardIndex >= studySession.length) {
    alert("SESSION COMPLETE. BRAIN REFRESHED.");
    initFlashcards();
  } else {
    showCard();
  }
}

function renderMindMap() {
  const container = document.getElementById('mindmap-nodes');
  const count = document.getElementById('mindmap-nodecount');
  const active = items.filter(i => (i.status || STATUS.ACTIVE) === STATUS.ACTIVE);

  count.innerText = `${active.length} NODES`;
  if (!active.length) return;

  container.innerHTML = active.slice(0, 30).map((i, idx) => {
    const angle = (idx / Math.min(active.length, 30)) * Math.PI * 2;
    const r = 200 + Math.random() * 50;
    const x = 50 + (Math.cos(angle) * r / 8);
    const y = 50 + (Math.sin(angle) * r / 8);

    return `
      <div class="absolute group cursor-pointer transition-all hover:scale-125 z-10" 
           style="left: ${x}%; top: ${y}%; transform: translate(-50%, -50%)"
           onclick="selectAndOpen('${i.id}')">
        <div class="size-4 bg-primary border-2 border-black rounded-full shadow-neo-sm group-hover:bg-neo-yellow transition-colors"></div>
        <div class="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black text-white text-[9px] font-bold px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          ${esc(i.title)}
        </div>
      </div>
    `;
  }).join('');
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const monthLabel = document.getElementById('cal-month');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  if (monthLabel) monthLabel.innerText = `${months[calMonth]} ${calYear}`;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = days.map(d => `<div class="text-[10px] font-black opacity-50 p-2 text-center bg-white dark:bg-gray-800 border-2 border-black">${d}</div>`).join('');

  // Empty cells before first day  
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="aspect-square bg-white dark:bg-gray-800 border-2 border-black"></div>`;
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;

  // Seed-based pseudo-random for consistent yellow placement (~20%)
  const seed = calYear * 100 + calMonth;

  // First filter out actual activities
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = isCurrentMonth && today.getDate() === i;
    const hasActivity = items.some(item => {
      // Parse UTC string securely to user's local timezone
      const d = new Date(item.created_at);
      return d.getDate() === i && d.getMonth() === calMonth && d.getFullYear() === calYear;
    });

    // Deterministic "random" for solid yellow boxes
    const hash = ((seed * 31 + i * 17) % 100);
    const isYellow = hash < 20;

    // Actual user activity overrides random yellows to show clear dots
    const color = (hasActivity || isYellow) ? 'bg-primary' : 'bg-white dark:bg-gray-700';
    const todayRing = isToday ? 'ring-4 ring-primary ring-offset-1 z-10' : '';

    // Distinguish active items with a larger dot / bounce effect
    const hasDot = hasActivity || isYellow;
    const dotAnim = hasActivity ? 'animate-bounce w-2 h-2' : 'w-1.5 h-1.5';

    html += `
      <div class="aspect-square border-2 border-black ${color} relative cursor-pointer group hover:translate-y-[-2px] hover:shadow-neo-sm transition-all ${todayRing} ${hasActivity ? 'shadow-[2px_2px_0px_#000]' : ''}" onclick="showDayLog(${i})">
        <span class="absolute top-1 left-2 text-[10px] font-bold font-mono ${(hasActivity || isYellow) ? 'text-black' : 'opacity-30'}">${i}</span>
        ${hasDot ? `<div class="absolute bottom-1.5 right-2 ${dotAnim} bg-black rounded-full shadow-neo-sm"></div>` : ''}
        ${isToday ? `<div class="absolute bottom-1 left-2 text-[8px] font-black text-black tracking-wider">TODAY</div>` : ''}
      </div>
    `;
  }

  grid.innerHTML = html;
}

function prevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function nextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function showDayLog(day) {
  const list = document.getElementById('day-notes-list');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const relevant = items.filter(i => {
    const d = new Date(i.created_at);
    return d.getDate() === day && d.getMonth() === calMonth && d.getFullYear() === calYear;
  });

  list.innerHTML = `
    <div class="text-xs font-black mb-2 opacity-50 tracking-widest">${months[calMonth]} ${day}, ${calYear}</div>
    ${relevant.length ? relevant.map(i => `
      <div class="bg-white/80 dark:bg-gray-800 border-2 border-black p-3 text-xs font-bold shadow-neo-sm hover:translate-x-1 transition-all cursor-pointer rounded-lg" onclick="selectAndOpen('${i.id}')">
        ${esc(i.title || 'Untitled')}
      </div>
    `).join('') : '<div class="text-xs font-mono text-gray-400 mt-2">No entries for this day</div>'}
  `;
}

function openClipper() {
  document.getElementById('modal-clipper').classList.remove('hidden');
}

function closeClipper() {
  document.getElementById('modal-clipper').classList.add('hidden');
}

async function saveClipper() {
  const url = document.getElementById('clipper-url').value.trim();
  const note = document.getElementById('clipper-note').value.trim();
  if (!url) return;

  const payload = {
    title: `Clip: ${url.substring(0, 30)}`,
    content: note ? `${note}\n\nSource: ${url}` : url,
    type: 'link',
    category: 'Links',
    tags: ['web'],
    user_id: user.id
  };

  const { data, error } = await sb.from('items').insert(payload).select().single();

  let finalData = data;
  if (error) {
    if (user && user.email === 'dev@goted.com') {
      console.warn("Supabase insert failed. Using local mock data.", error);
      finalData = {
        id: 'mock-' + Date.now(),
        ...payload,
        created_at: new Date().toISOString(),
        status: 'active'
      };
      // Simulate realtime event for Collab Feed
      if (typeof handleRealtimeEvent === 'function') {
        handleRealtimeEvent({ eventType: 'INSERT', new: finalData });
      }
    } else {
      status('ERROR: ' + error.message);
      return;
    }
  }

  items.unshift(finalData);
  render();
  renderCalendar();
  if (typeof updateFilterCounts === 'function') updateFilterCounts();
  status('CLIP SAVED ✓');
  closeClipper();
  document.getElementById('clipper-url').value = '';
  document.getElementById('clipper-note').value = '';
}

function selectAndOpen(id) {
  switchView('dashboard');
  select(id);
}

function show(s) {
  const login = document.getElementById('login');
  const app = document.getElementById('app');
  if (s === 'login') {
    login.classList.remove('hidden');
    login.classList.add('flex');
    app.classList.add('hidden');
    app.classList.remove('flex');
  } else {
    login.classList.add('hidden');
    login.classList.remove('flex');
    app.classList.remove('hidden');
    app.classList.add('flex');
  }
}

// ─── AUTH ──────────────────────────────────────
async function checkUser() {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    user = session.user;
    boot();
  } else {
    document.getElementById('login').style.display = 'flex';
  }
}

async function doLogin(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('em').value.trim();
  const password = document.getElementById('pw').value.trim();
  const err = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    if (err) {
      err.textContent = "EMAIL AND PASSWORD ARE REQUIRED.";
      err.style.display = 'block';
    }
    return;
  }

  if (err) err.style.display = 'none';
  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.textContent = 'LOGGING IN...';

  try {
    if (!sb) sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;
    console.log("Login successful:", data.user.email);

  } catch (error) {
    console.error("Login Error:", error);
    if (err) {
      err.textContent = (error.message || "Invalid credentials").toUpperCase();
      err.style.display = 'block';
    }
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function sendMagicLink(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('em').value.trim();
  const err = document.getElementById('login-error');
  const btn = document.getElementById('magic-btn');
  const msg = document.getElementById('magic-msg');

  if (!email) {
    if (err) {
      err.textContent = "PLEASE ENTER AN EMAIL ADDRESS FIRST.";
      err.style.display = 'block';
    }
    document.getElementById('em').focus();
    return;
  }

  if (err) err.style.display = 'none';
  if (msg) msg.classList.add('hidden');

  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.textContent = 'SENDING...';

  try {
    if (!sb) sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const { error } = await sb.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });

    if (error) throw error;

    btn.innerHTML = 'LINK SENT ✓';
    if (msg) msg.classList.remove('hidden');

  } catch (error) {
    console.error("Magic Link Error:", error);
    if (err) {
      err.textContent = (error.message || "Failed to send link").toUpperCase();
      err.style.display = 'block';
    }
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function doLogout() {
  await sb.auth.signOut();
  location.reload();
}

// ─── DATA ─────────────────────────────────────
async function load() {
  const { data } = await sb.from('items').select('*').order('created_at', { ascending: false });
  items = data || [];
  render();
  renderCalendar();
}

function filtered() {
  return items.filter(i => {
    const catOk = filterCat === 'all' || i.category === filterCat;
    const qLow = q.toLowerCase();
    const qOk = !q ||
      (i.title || '').toLowerCase().includes(qLow) ||
      (i.content || '').toLowerCase().includes(qLow) ||
      (i.tags || []).some(t => t.toLowerCase().includes(qLow));
    return catOk && qOk;
  });
}

function render() {
  const list = document.getElementById('list-panel');
  const f = filtered().filter(i => (i.status || STATUS.ACTIVE) === STATUS.ACTIVE);

  const typeColors = {
    note: 'bg-neo-green',
    link: 'bg-neo-purple',
    code: 'bg-neo-blue',
    idea: 'bg-neo-yellow',
    file: 'bg-neo-pink'
  };

  const typeIcons = {
    note: 'description',
    link: 'link',
    code: 'code',
    idea: 'lightbulb',
    file: 'insert_drive_file'
  };

  if (!f.length) {
    list.innerHTML = `
      <div class="bg-white dark:bg-gray-800 border-3 border-black dark:border-white rounded-xl p-8 text-center shadow-neo">
        <div class="mb-2"><img src="icons/mailbox.png" alt="empty" class="w-12 h-12 mx-auto" /></div>
        <div class="font-bold uppercase tracking-widest text-gray-400 text-xs">Nothing in the vault</div>
      </div>`;
    return;
  }

  list.innerHTML = f.map(i => {
    const type = i.type || 'note';
    const colorClass = typeColors[type] || 'bg-white';
    const icon = typeIcons[type] || 'description';
    const isActive = current?.id === i.id;

    // Tag formatting
    let tagsHtml = '';
    if (Array.isArray(i.tags) && i.tags.length > 0) {
      tagsHtml = `<div class="mt-3 flex flex-wrap gap-1">` +
        i.tags.slice(0, 3).map(t => `<span class="bg-black/10 border border-black/20 rounded px-1.5 py-0.5 text-[9px] font-bold text-black uppercase tracking-wider"># ${t}</span>`).join('') +
        `</div>`;
    }

    return `
    <div class="${colorClass} rounded-xl border-3 border-black dark:border-white ${isActive ? 'shadow-neo-lg -translate-y-1' : 'shadow-neo'} relative group hover:-translate-y-1 transition-all duration-200 cursor-pointer" 
         onclick="select('${i.id}')">
      <div class="absolute -top-3 -right-3 bg-white dark:bg-gray-800 border-3 border-black dark:border-white rounded-full p-1 z-10">
        <span class="material-icons-outlined text-lg block text-black dark:text-white">${icon}</span>
      </div>
      <div class="p-5">
        <div class="bg-white dark:bg-gray-800 border-2 border-black dark:border-white rounded px-2 py-0.5 inline-block text-[10px] font-bold mb-3 uppercase tracking-wider text-black dark:text-white">
          ${type}
        </div>
        <h2 class="text-lg font-bold leading-tight text-black flex items-center justify-between">
          <span class="truncate pr-4">${esc(i.title || 'UNTITLED')}</span>
        </h2>
        
        <div class="mt-2 text-xs font-mono font-bold text-black/60 truncate">
          ${esc((i.content || '').substring(0, 60)) || 'No content preview...'}
        </div>
        
        ${tagsHtml}
        
        <div class="mt-4 flex justify-between items-center text-[10px] font-bold text-black border-t-2 border-dashed border-black/20 dark:border-white/20 pt-2">
           <span class="uppercase">${i.category || 'NO CATEGORY'}</span>
           <span>${new Date(i.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  if (typeof updateFilterCounts === 'function') updateFilterCounts();
}
function renderTags() {
  const container = document.getElementById('e-tags-list');
  container.innerHTML = '';

  const tags = current?.tags || [];
  tags.forEach((tag, idx) => {
    const chip = document.createElement('div');
    chip.className = 'flex items-center gap-2 bg-accent px-3 py-1 border-3 border-black rounded-lg font-bold shadow-neo-sm text-black text-xs';
    chip.innerHTML = `
      <span># ${tag.toUpperCase()}</span>
      <button class="hover:bg-black hover:text-white rounded-full p-0.5 transition-colors" onclick="removeTag(${idx})">
        <span class="material-icons-outlined text-[10px] block">close</span>
      </button>`;
    container.appendChild(chip);
  });
}

function handleTagKey(e) {
  if (e.key === 'Enter') {
    const val = e.target.value.trim().toLowerCase();
    if (val && current && !current.tags.includes(val)) {
      current.tags.push(val);
      e.target.value = '';
      renderTags();
      dirty();
    }
  }
}

function removeTag(idx) {
  if (current && current.tags) {
    current.tags.splice(idx, 1);
    renderTags();
    dirty();
  }
}

// ─── SELECT ────────────────────────────────────
function select(id) {
  current = items.find(i => i.id === id);
  if (!current) return;
  openEntryView();
}

function selectAndOpen(id) {
  select(id);
}

function openEntryView() {
  if (!current) return;
  const el = document.getElementById('view-entry-overlay');
  if (!el) return;

  const typeBadge = document.getElementById('v-type-badge');
  typeBadge.textContent = current.type || 'Note';
  typeBadge.className = 'border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase text-black tracking-wider ' +
    (current.type === 'note' ? 'bg-neo-green' : current.type === 'link' ? 'bg-neo-purple' : current.type === 'code' ? 'bg-neo-blue' : current.type === 'idea' ? 'bg-neo-yellow' : 'bg-white');

  document.getElementById('v-cat-badge').textContent = current.category || 'NO CATEGORY';
  document.getElementById('v-title').textContent = current.title || 'UNTITLED';
  document.getElementById('v-content').textContent = current.content || '';
  document.getElementById('v-date').textContent = current.created_at ? new Date(current.created_at).toLocaleDateString() : 'UNKNOWN DATE';

  const tagsHtml = (current.tags || []).map(t => `<span class="bg-black/10 border border-black/20 rounded px-1.5 py-0.5 text-[9px] font-bold text-black uppercase tracking-wider"># ${t}</span>`).join('');
  document.getElementById('v-tags').innerHTML = tagsHtml;

  el.classList.remove('hidden');
  el.classList.add('flex');
}

function closeEntryView() {
  const el = document.getElementById('view-entry-overlay');
  if (el) {
    el.classList.add('hidden');
    el.classList.remove('flex');
  }
}

// ─── SAVE ──────────────────────────────────────
async function saveItem() {
  // Save is disabled since editor is removed.
}

// ─── DELETE ────────────────────────────────────
function askDelete() {
  const el = document.getElementById('del-overlay');
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function closeDelete() {
  const el = document.getElementById('del-overlay');
  el.classList.add('hidden');
  el.classList.remove('flex');
}

async function confirmDelete() {
  if (!current) return;
  await setStatus(current.id, STATUS.DELETED);
  current = null;
  closeDelete();
  closeEntryView();
  status('DELETED');
  render();
}

// ─── ADD MODAL ─────────────────────────────────
function openAdd() {
  const el = document.getElementById('add-overlay');
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function closeAdd() {
  const el = document.getElementById('add-overlay');
  el.classList.add('hidden');
  el.classList.remove('flex');
  ['m-title', 'm-tags', 'm-content'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-type').value = 'note';
  document.getElementById('m-cat').value = '';
}

async function submitAdd() {
  const title = document.getElementById('m-title').value.trim();
  if (!title) {
    document.getElementById('m-title').focus();
    return;
  }

  const payload = {
    title,
    type: document.getElementById('m-type').value,
    category: document.getElementById('m-cat').value || null,
    content: document.getElementById('m-content').value.trim() || null,
    tags: document.getElementById('m-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
    user_id: user.id
  };

  const { data, error } = await sb.from('items').insert(payload).select().single();

  let finalData = data;
  if (error) {
    if (user && user.email === 'dev@goted.com') {
      console.warn("Supabase insert failed. Using local mock data.", error);
      finalData = {
        id: 'mock-' + Date.now(),
        ...payload,
        created_at: new Date().toISOString(),
        status: 'active'
      };
      // Simulate realtime event for Collab Feed
      if (typeof handleRealtimeEvent === 'function') {
        handleRealtimeEvent({ eventType: 'INSERT', new: finalData });
      }
    } else {
      alert('Failed to save to Vault: ' + error.message);
      return;
    }
  }

  items.unshift(finalData);
  closeAdd();
  render();
  renderCalendar();
  if (typeof updateFilterCounts === 'function') updateFilterCounts();
  select(finalData.id);
  status('CAPTURED ✓');
}

// ─── FILTER / SEARCH ───────────────────────────
function setFilter(cat) {
  filterCat = cat;
  document.querySelectorAll('button[data-cat]').forEach(el => {
    const isCat = el.dataset.cat === cat;
    if (isCat) {
      el.setAttribute('data-active', 'true');
    } else {
      el.removeAttribute('data-active');
    }
  });
  render();
  updateFilterCounts();
}

function updateFilterCounts() {
  const active = items.filter(i => (i.status || 'active') === 'active');
  const counts = { all: active.length };
  active.forEach(i => {
    if (i.category) counts[i.category] = (counts[i.category] || 0) + 1;
  });
  // The new UI doesn't have count badges out of the box on the sidebar yet,
  // but if we add them, we can target them here. 
}

function doSearch(val) {
  q = val;
  render();
}

// ─── UTILS ─────────────────────────────────────
function dirty() {
  status('UNSAVED *');
}

function status(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── SIDEBAR TOGGLE ────────────────────────────
let sidebarExpanded = true; // starts expanded

function toggleSidebar() {
  const sidebar = document.getElementById('master-sidebar');
  const content = document.getElementById('content-wrapper');
  const nav = document.getElementById('top-nav');
  const labels = document.querySelectorAll('.sidebar-label');
  if (!sidebar) return;

  sidebarExpanded = !sidebarExpanded;

  if (sidebarExpanded) {
    // Expand: wide with labels
    sidebar.style.width = '14rem'; // w-56
    if (content) content.style.marginLeft = '14rem';
    if (nav) nav.style.left = '14rem';
    labels.forEach(el => {
      el.style.display = '';
      el.style.opacity = '1';
    });
  } else {
    // Collapse: narrow icons only
    sidebar.style.width = '4.5rem'; // ~w-18, enough for icon + padding
    if (content) content.style.marginLeft = '4.5rem';
    if (nav) nav.style.left = '4.5rem';
    labels.forEach(el => {
      el.style.opacity = '0';
      el.style.display = 'none';
    });
  }
}

function closeSidebarIfOpen() {
  // No-op: sidebar is always visible now
}

// ─── KEYBOARD SHORTCUTS ────────────────────────
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveItem();
  }
  if (e.key === 'Escape') {
    closeAdd();
    closeDelete();
    closeSerendipity();
    closeClipper();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('search').focus();
  }
  // ─── Flashcard shortcuts ───
  const fcView = document.getElementById('view-flashcards');
  if (fcView && !fcView.classList.contains('hidden') && studySession.length > 0) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      const fc = document.getElementById('flashcard');
      if (fc && !fc.classList.contains('hidden')) fc.children[0].classList.toggle('rotate-y-180');
    }
    if (e.key === 'ArrowRight') nextFlashcard(true);
    if (e.key === 'ArrowLeft') prevFlashcard();
  }
});

// ─── COLLAB REALTIME ───────────────────────────
let collabChannel = null;
let activeUsers = {};
let liveFeed = [];

function initCollab() {
  if (!user || collabChannel) return;

  collabChannel = sb.channel('vault-collab', {
    config: { presence: { key: user.id } }
  });

  collabChannel.on('presence', { event: 'sync' }, () => {
    activeUsers = collabChannel.presenceState();
    renderCollabUsers();
  });

  collabChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
    handleRealtimeEvent(payload);
  });

  collabChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await collabChannel.track({
        email: user.email,
        joined_at: new Date().toISOString()
      });
    }
  });
}

function renderCollabUsers() {
  const container = document.getElementById('collab-users-list');
  if (!container) return;

  const users = Object.values(activeUsers).map(u => u[0]); // Get first presence per user

  if (users.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-10">No active hunters</div>';
    return;
  }

  container.innerHTML = users.map(u => {
    const isMe = u.email === user?.email;
    const name = u.email ? u.email.split('@')[0] : 'Unknown';
    return `
      <div class="flex items-center gap-4 p-3 border-3 border-black rounded-xl bg-white shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all">
        <div class="w-12 h-12 rounded-full border-3 border-black bg-neo-yellow flex items-center justify-center font-bold text-xl select-none">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-black truncate flex items-center gap-2">
            ${name}
            ${isMe ? '<span class="px-2 py-0.5 bg-neo-pink text-[10px] uppercase font-black tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] rounded">YOU</span>' : ''}
          </div>
          <div class="text-xs font-mono font-bold text-gray-500 truncate mt-0.5">Online</div>
        </div>
        <div class="w-4 h-4 bg-success rounded-full border-2 border-black animate-pulse shadow-sm"></div>
      </div>
    `;
  }).join('');
}

function handleRealtimeEvent(payload) {
  const eventType = payload.eventType; // 'INSERT', 'UPDATE', 'DELETE'
  const record = payload.new || payload.old;
  if (!record) return;

  let icon = 'sync';
  let color = 'bg-neo-blue';
  let action = 'modified';

  if (eventType === 'INSERT') {
    icon = 'add_circle';
    color = 'bg-neo-green';
    action = 'created';
  } else if (eventType === 'DELETE') {
    icon = 'delete';
    color = 'bg-neo-pink';
    action = 'deleted';
  }

  const title = record.title || 'Untitled Entry';
  const type = record.type || 'item';

  liveFeed.unshift({
    id: record.id,
    title,
    type,
    action,
    icon,
    color,
    timestamp: new Date().toLocaleTimeString()
  });

  if (liveFeed.length > 50) liveFeed.pop(); // keep last 50 events
  renderCollabFeed();
}

function renderCollabFeed() {
  const container = document.getElementById('collab-feed');
  if (!container) return;

  if (liveFeed.length === 0) {
    container.innerHTML = `
      <div class="bg-white border-2 border-black rounded-lg p-4 shadow-sm opacity-50 flex items-center gap-4">
        <div class="bg-gray-200 w-10 h-10 rounded-full border border-black flex items-center justify-center">
          <span class="material-icons-outlined text-gray-500">history</span>
        </div>
        <div>
          <div class="font-bold text-sm">Listening for changes...</div>
          <div class="text-xs font-mono text-gray-500">Waiting for database events</div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = liveFeed.map(event => `
    <div class="bg-white border-3 border-black rounded-xl p-4 shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all flex items-center gap-4">
      <div class="${event.color} w-12 h-12 rounded-full border-2 border-black flex items-center justify-center flex-shrink-0">
        <span class="material-icons-outlined text-black">${event.icon}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-black truncate text-sm md:text-base">
          Someone ${event.action} a ${event.type}: <span class="text-neo-pink">"${event.title}"</span>
        </div>
        <div class="text-xs font-mono text-gray-500 mt-1 flex items-center gap-1">
          <span class="material-icons-outlined" style="font-size:12px">schedule</span>
          ${event.timestamp}
        </div>
      </div>
    </div>
  `).join('');
}