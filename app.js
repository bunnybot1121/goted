// ══════════════════════════════════════════════
//  THE GOTED — Neo-Brutalism Second Brain
//  CONFIG — fill these in
// ══════════════════════════════════════════════
const SUPABASE_URL = 'https://txnvlqwffqqfclgjrmjz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnZscXdmZnFxZmNsZ2pybWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTI2NTAsImV4cCI6MjA4NzMyODY1MH0.yatl3EHdm5pApKofUw9vUzCjsXFE0sFaEwRJ-88rGSc';
// ══════════════════════════════════════════════

let sb, items = [], user = null, current = null, filterCat = 'all', q = '', dirtyEntry = false;
let collabGrantedUser = null; // user whose items we are currently peeking
const STATUS = { ACTIVE: 'active', ARCHIVED: 'archived', DELETED: 'deleted' };
let calYear = 2026, calMonth = 1; // 0-indexed: Jan=0, Feb=1

// ─── INIT ─────────────────────────────────────

// ─── TOAST NOTIFICATIONS ───────────────────────
function showToast(message, type = 'info') {
  const colors = {
    info: 'bg-neo-blue',
    success: 'bg-success',
    error: 'bg-neo-pink',
    warning: 'bg-neo-yellow',
  };
  const icons = { info: 'info', success: 'check_circle', error: 'error', warning: 'warning' };
  const container = document.getElementById('toast-container');
  if (!container) { console.warn(message); return; }

  const el = document.createElement('div');
  el.className = `${colors[type] || colors.info} border-3 border-black rounded-xl shadow-neo px-4 py-3 flex items-start gap-3 pointer-events-auto translate-x-0 transition-all duration-300`;
  el.innerHTML = `
    <span class="material-icons-outlined text-black text-base flex-shrink-0 mt-0.5">${icons[type]}</span>
    <span class="font-bold text-black text-sm leading-snug flex-1">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-black/60 hover:text-black font-bold text-lg leading-none flex-shrink-0">×</button>
  `;
  container.appendChild(el);
  // auto-remove after 4s
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(120%)'; setTimeout(() => el.remove(), 300); }, 4000);
}
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

let currentUserProfile = null;

async function loadUserProfile() {
  if (!sb || !user) return;
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (data) {
    currentUserProfile = data;
    globalProfiles[user.id] = data;
    const headerUsername = document.getElementById('header-username');
    const headerAvatar = document.getElementById('header-avatar');
    if (headerUsername) headerUsername.innerText = data.username || data.display_name || 'anon';
    if (headerAvatar && data.avatar_url) headerAvatar.src = `assets/avatars/${data.avatar_url}`;
  }
}

async function boot(u) {
  if (!u) return;
  user = u;
  show('app');
  switchView('dashboard');

  await loadUserProfile();

  await load();
  renderDashboardMindMaps();
  claimPendingRequests();
  await initCollab(); // Make sure profiles finish loading

  if (currentUserProfile && (!currentUserProfile.username || !currentUserProfile.avatar_url)) {
    openSettings();
  } else {
    setTimeout(() => {
      if (typeof initTutorial === 'function') initTutorial();
    }, 500);
  }
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
  if (view === 'dashboard') { render(); renderDashboardMindMaps(); }
  if (view === 'gallery') renderGallery();
  if (view === 'flashcards') initFlashcards();
  if (view === 'braindump') {
    document.getElementById('braindump-input').focus();
    initBrainDump();
  }
  if (view === 'mindmap') renderMindMap();
  if (view === 'calendar') renderCalendar();
  if (view === 'collab') {
    // Always re-fetch fresh data from Supabase before rendering
    refreshCollabRequests().then(() => {
      renderIncomingRequests();
      renderApprovedPeeks();
      renderFriendsList();
    });
  }
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
        <button onclick="event.stopPropagation(); openShareItemModal('${i.id}', '${esc(i.title || 'UNTITLED').replace(/'/g, "\\'")}', '${(i.shared_with || []).join(',')}')" class="w-6 h-6 flex items-center justify-center bg-white border-2 border-black rounded-full shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all ml-auto relative group z-10">
          <span class="material-icons-outlined text-[14px] text-black">share</span>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-black text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none after:content-[''] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:border-2 after:border-t-black after:border-r-transparent after:border-b-transparent after:border-l-transparent">Share Item</div>
        </button>
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
let fcScore = 0, fcSkipped = 0;
let fcSelectedCategory = 'all';
let fcSessionSize = 10;

function initFlashcards() {
  // Show config, hide session
  document.getElementById('fc-config').classList.remove('hidden');
  document.getElementById('fc-session').classList.add('hidden');
  updateFcAvailableCount();
}

function updateFcAvailableCount() {
  const available = getFilteredFcItems();
  const el = document.getElementById('fc-available-count');
  if (el) el.innerText = `${available.length} card${available.length !== 1 ? 's' : ''} available`;
}

function getFilteredFcItems() {
  return items.filter(i => {
    if ((i.status || 'active') !== 'active') return false;
    if (fcSelectedCategory !== 'all') {
      return (i.category || '').toLowerCase() === fcSelectedCategory;
    }
    return true;
  });
}

function toggleFcFilter(btn, category) {
  fcSelectedCategory = category;
  // Update button styles
  document.querySelectorAll('.fc-filter-btn').forEach(b => {
    b.classList.remove('bg-primary', 'text-black');
    b.classList.add('bg-white', 'dark:bg-gray-700', 'text-black', 'dark:text-white');
  });
  btn.classList.remove('bg-white', 'dark:bg-gray-700', 'dark:text-white');
  btn.classList.add('bg-primary', 'text-black');
  updateFcAvailableCount();
}

function setFcSize(btn, size) {
  fcSessionSize = size;
  document.querySelectorAll('.fc-size-btn').forEach(b => {
    b.classList.remove('bg-primary');
    b.classList.add('bg-white', 'dark:bg-gray-700');
  });
  btn.classList.remove('bg-white', 'dark:bg-gray-700');
  btn.classList.add('bg-primary');
}

function startStudySession() {
  let pool = getFilteredFcItems();
  if (!pool.length) {
    showToast('No cards available for this filter!', 'error');
    return;
  }

  // Shuffle if enabled
  const shuffle = document.getElementById('fc-shuffle');
  if (shuffle && shuffle.checked) {
    pool = pool.sort(() => Math.random() - 0.5);
  }

  // Limit to session size
  studySession = pool.slice(0, fcSessionSize);
  currentCardIndex = 0;
  fcScore = 0;
  fcSkipped = 0;

  // Switch to session view
  document.getElementById('fc-config').classList.add('hidden');
  document.getElementById('fc-session').classList.remove('hidden');
  document.getElementById('fc-session').classList.add('flex');

  showCard();
  updateScoreDisplay();

  // Add keyboard listener
  document.addEventListener('keydown', fcKeyHandler);
}

function fcKeyHandler(e) {
  // Only handle if flashcards view is visible
  const session = document.getElementById('fc-session');
  if (!session || session.classList.contains('hidden')) return;

  if (e.key === 'ArrowLeft') { e.preventDefault(); prevFlashcard(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); nextFlashcard(false); }
  else if (e.key === ' ') {
    e.preventDefault();
    const fc = document.getElementById('flashcard');
    if (fc) fc.children[0].classList.toggle('rotate-y-180');
  }
  else if (e.key === 'g' || e.key === 'G') { nextFlashcard(true); }
  else if (e.key === 's' || e.key === 'S') { nextFlashcard(false); }
}

function showCard() {
  const card = studySession[currentCardIndex];
  const fc = document.getElementById('flashcard');
  // Reset flip
  fc.children[0].classList.remove('rotate-y-180');

  document.getElementById('fc-front-text').innerText = card.title || 'UNTITLED';
  document.getElementById('fc-back-text').innerText = card.content || '(no content)';
  document.getElementById('study-progress').innerText = `${currentCardIndex + 1} / ${studySession.length}`;

  // Type badge
  const badge = document.getElementById('fc-type-badge');
  if (badge) {
    const type = (card.type || 'note').toUpperCase();
    badge.innerText = type;
    const colors = { NOTE: 'bg-green-200', CODE: 'bg-orange-200', IDEA: 'bg-pink-200', LINK: 'bg-blue-200' };
    badge.className = `absolute top-4 left-4 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-black/20 ${colors[type] || 'bg-gray-200'} text-gray-700`;
  }

  // Progress bar
  const pct = ((currentCardIndex + 1) / studySession.length * 100).toFixed(0);
  document.getElementById('fc-progress-bar').style.width = pct + '%';
}

function updateScoreDisplay() {
  const el = document.getElementById('fc-score-display');
  if (el) el.innerText = `✓ ${fcScore}   ✗ ${fcSkipped}`;
}

function prevFlashcard() {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    showCard();
  }
}

function nextFlashcard(success) {
  if (success) fcScore++;
  else fcSkipped++;
  updateScoreDisplay();

  currentCardIndex++;
  if (currentCardIndex >= studySession.length) {
    endStudySession();
  } else {
    showCard();
  }
}

function endStudySession() {
  // Remove keyboard listener
  document.removeEventListener('keydown', fcKeyHandler);

  const total = studySession.length;
  const pct = total > 0 ? Math.round((fcScore / total) * 100) : 0;

  // Pick emoji based on score
  let emoji = '🎉';
  if (pct < 30) emoji = '😅';
  else if (pct < 60) emoji = '🤔';
  else if (pct < 80) emoji = '😊';
  else if (pct < 100) emoji = '🔥';

  document.getElementById('fc-results-emoji').innerText = emoji;
  document.getElementById('fc-results-score').innerText = pct + '%';
  document.getElementById('fc-results-got').innerText = fcScore;
  document.getElementById('fc-results-skipped').innerText = fcSkipped;
  document.getElementById('fc-results-total').innerText = total;

  // Show results overlay
  document.getElementById('fc-results').classList.remove('hidden');
}

function closeResults() {
  document.getElementById('fc-results').classList.add('hidden');
  initFlashcards();
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
  // Only fetch THIS user's items — per-user workspace isolation
  const { data } = await sb.from('items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  let allItems = data || [];

  // Also fetch mindmaps
  if (sb && user) {
    const { data: mindmapData } = await sb.from('mindmaps')
      .select('id, name, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (mindmapData) {
      const mmaps = mindmapData.map(m => ({
        id: 'mm_' + m.id,
        title: m.name,
        type: 'mindmap',
        category: 'Mind Map',
        created_at: m.updated_at,
        status: STATUS.ACTIVE,
        isMindMap: true,
        content: 'Mind map visualization'
      }));
      allItems = [...allItems, ...mmaps];
      allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }

  items = allItems;
  render();
  renderCalendar();
}

async function renderDashboardMindMaps() {
  const container = document.getElementById('dashboard-mindmaps');
  if (!container || !sb || !user) return;

  const { data } = await sb.from('mindmaps')
    .select('name, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(6);

  const maps = data || [];

  if (maps.length === 0) {
    container.innerHTML = '<div class="text-[10px] font-mono text-black/50 dark:text-white/50 bg-gray-100 dark:bg-gray-700/50 border-2 border-dashed border-black/20 dark:border-white/20 rounded-lg p-3 text-center">No saved maps yet</div>';
    return;
  }

  container.innerHTML = maps.map(m => `
    <button onclick="switchView('mindmap'); setTimeout(() => loadMindMap('${m.name.replace(/'/g, "\\'")}'), 300)"
      class="w-full text-left flex items-center gap-2 px-3 py-2 border-2 border-black dark:border-white rounded-lg bg-neo-yellow/40 hover:bg-primary hover:shadow-neo-sm font-bold text-[11px] text-black dark:text-black transition-all group">
      <span class="material-icons-outlined text-sm flex-shrink-0">account_tree</span>
      <span class="truncate">${esc(m.name)}</span>
    </button>
  `).join('');
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
    file: 'bg-neo-pink',
    mindmap: 'bg-primary'
  };

  const typeIcons = {
    note: 'description',
    link: 'link',
    code: 'code',
    idea: 'lightbulb',
    file: 'insert_drive_file',
    mindmap: 'account_tree'
  };

  if (!f.length) {
    list.innerHTML = `
      <div class="col-span-full bg-white dark:bg-gray-800 border-3 border-black dark:border-white rounded-xl p-8 text-center shadow-neo">
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
    // Specific click handler depending on mind map or entry
    const clickHandler = i.isMindMap ? `switchView('mindmap'); setTimeout(() => loadMindMap('${esc(i.title).replace(/'/g, "\\\\\\'")}'), 300)` : `selectAndOpen('${i.id}')`;

    // Tag formatting
    let tagsHtml = '';
    if (Array.isArray(i.tags) && i.tags.length > 0) {
      tagsHtml = `<div class="mt-3 flex flex-wrap gap-1">` +
        i.tags.slice(0, 3).map(t => `<span class="bg-black/10 border border-black/20 rounded px-1.5 py-0.5 text-[9px] font-bold text-black uppercase tracking-wider"># ${t}</span>`).join('') +
        `</div>`;
    }

    return `
    <div class="flex flex-col h-full ${colorClass} rounded-xl border-3 border-black dark:border-white ${isActive ? 'shadow-neo-lg -translate-y-1' : 'shadow-neo'} relative group hover:-translate-y-1 transition-all duration-200 cursor-pointer" 
         onclick="${clickHandler}">
      <div class="absolute -top-3 -right-3 bg-white dark:bg-gray-800 border-3 border-black dark:border-white rounded-full p-1 z-10 transition-transform group-hover:scale-110">
        <span class="material-icons-outlined text-lg block text-black dark:text-white">${icon}</span>
      </div>
      <div class="p-5 flex flex-col flex-1">
        <div class="bg-white dark:bg-gray-800 border-2 border-black dark:border-white rounded px-2 py-0.5 self-start text-[10px] font-bold mb-3 uppercase tracking-wider text-black dark:text-white">
          ${type}
        </div>
        <h2 class="text-lg font-bold leading-tight text-black break-words pr-4 line-clamp-2">
          ${esc(i.title || 'UNTITLED')}
        </h2>
        
        <div class="mt-2 text-xs font-mono font-bold text-black/60 break-words whitespace-pre-wrap flex-1 line-clamp-4">
          ${esc((i.content || '').substring(0, 150)) || 'No content preview...'}
        </div>
        
        ${tagsHtml}
        
        <div class="mt-4 flex justify-between items-center text-[10px] font-bold text-black border-t-2 border-dashed border-black/20 dark:border-white/20 pt-2 shrink-0">
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
let sidebarExpanded = window.innerWidth >= 768; // Start expanded on desktop, collapsed on mobile

function toggleSidebar() {
  const sidebar = document.getElementById('master-sidebar');
  const content = document.getElementById('content-wrapper');
  const nav = document.getElementById('top-nav');
  const labels = document.querySelectorAll('.sidebar-label');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  sidebarExpanded = !sidebarExpanded;
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    if (sidebarExpanded) {
      sidebar.classList.remove('-translate-x-full');
      if (backdrop) backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      if (backdrop) backdrop.classList.add('hidden');
    }
    // Ensure width and labels are visible when sidebar is open on mobile
    sidebar.style.width = '14rem';
    labels.forEach(el => {
      el.style.display = '';
      el.style.opacity = '1';
    });
  } else {
    // Desktop behavior
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
}

function closeSidebarIfOpen() {
  if (window.innerWidth < 768 && sidebarExpanded) {
    toggleSidebar();
  }
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
    closeCollabPeek();
    if (typeof closeSaveMapModal === 'function') closeSaveMapModal();
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

// ─── AVATAR SELECTION ─────────────────────────────
async function selectAvatar(filename) {
  const { error } = await sb.from('profiles').update({ avatar_url: filename }).eq('id', user.id);
  if (error) {
    showToast('Could not save avatar: ' + error.message, 'error');
    return;
  }

  const modal = document.getElementById('avatar-modal');
  const content = document.getElementById('avatar-modal-content');
  if (content) {
    content.classList.remove('translate-y-0', 'opacity-100');
    content.classList.add('translate-y-8', 'opacity-0');
  }
  setTimeout(() => {
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }, 300);

  showToast('Avatar updated! Looking good.', 'success');

  await refreshProfiles();

  // Re-render views if they are open
  renderCollabUsers();
  renderFriendsList();
  renderIncomingRequests();
  renderApprovedPeeks();
}

// ─── COLLAB REALTIME ───────────────────────────
let collabChannel = null;
let activeUsers = {};
let liveFeed = [];
let incomingRequests = [];  // collab_requests where target_id = me, status = pending
let outgoingRequests = {};  // map: target_id -> status ('pending'|'accepted'|'denied')
let approvedPeeks = [];     // collab_requests where requester_id = me, status = accepted

let globalProfiles = {};
async function refreshProfiles() {
  const { data } = await sb.from('profiles').select('id, email, avatar_url, display_name, username');
  if (data) {
    data.forEach(p => {
      globalProfiles[p.id] = p;
      globalProfiles[p.email] = p;
    });
  }
}

function getAvatarHtml(key, sizeClass = 'w-10 h-10', textClass = 'text-lg') {
  const p = globalProfiles[key];
  if (p && p.avatar_url) {
    return `<img src="assets/avatars/${p.avatar_url}" class="${sizeClass} rounded-full border-3 border-black object-cover flex-shrink-0 bg-white">`;
  }
  const name = p?.username || p?.display_name || (typeof key === 'string' && key.includes('@') ? key.split('@')[0] : 'U');
  const colors = ['bg-neo-yellow', 'bg-neo-pink', 'bg-neo-blue', 'bg-neo-green', 'bg-neo-purple'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return `<div class="${sizeClass} flex-shrink-0 rounded-full border-3 border-black ${color} flex items-center justify-center font-bold ${textClass} select-none text-black">
    ${name.charAt(0).toUpperCase()}
  </div>`;
}

// ─── SETTINGS MODAL ────────────────────────────
const SETTINGS_AVATARS = [
  'artist.png', 'hacker.png', 'ninja.png', 'robot.png', 'gotared_1.png',
  'avatar_1.jpg', 'avatar_2.jpg', 'avatar_3.jpg', 'avatar_4.jpg',
  'avatar_5.jpg', 'avatar_6.jpg', 'avatar_7.jpg', 'avatar_8.jpg',
  'avatar_9.jpg', 'avatar_10.jpg', 'avatar_11.jpg', 'avatar_12.jpg',
  'avatar_13.jpg', 'avatar_14.jpg'
];

function openSettings() {
  const modal = document.getElementById('settings-overlay');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  if (currentUserProfile) {
    document.getElementById('settings-username').value = currentUserProfile.username || '';
  }

  const container = document.getElementById('settings-avatars');
  if (container) {
    const currentAvatar = currentUserProfile?.avatar_url || '';
    if (currentAvatar) document.getElementById('settings-selected-avatar').value = currentAvatar;

    container.innerHTML = SETTINGS_AVATARS.map(avatar => `
      <div onclick="settingsSelectAvatar('${avatar}')" class="cursor-pointer border-4 rounded-xl overflow-hidden transition-all ${currentAvatar === avatar ? 'border-primary shadow-neo scale-105' : 'border-transparent hover:border-black/20'}">
        <img src="assets/avatars/${avatar}" class="w-full aspect-square object-cover bg-white" alt="Avatar">
      </div>
    `).join('');
  }
}

function closeSettings() {
  const modal = document.getElementById('settings-overlay');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  document.getElementById('settings-error').classList.add('hidden');
  if (typeof initTutorial === 'function') initTutorial();
}

function settingsSelectAvatar(avatar) {
  document.getElementById('settings-selected-avatar').value = avatar;
  const container = document.getElementById('settings-avatars');
  const items = container.querySelectorAll('div');
  items.forEach((item, index) => {
    if (SETTINGS_AVATARS[index] === avatar) {
      item.className = 'cursor-pointer border-4 rounded-xl overflow-hidden transition-all border-primary shadow-neo scale-105';
    } else {
      item.className = 'cursor-pointer border-4 rounded-xl overflow-hidden transition-all border-transparent hover:border-black/20';
    }
  });
}

async function saveSettings() {
  if (!sb || !user) return;
  const username = document.getElementById('settings-username').value.trim();
  const avatar_url = document.getElementById('settings-selected-avatar').value;
  const errEl = document.getElementById('settings-error');
  const btn = document.getElementById('settings-save-btn');

  errEl.classList.add('hidden');

  if (!username) {
    errEl.textContent = 'USERNAME IS REQUIRED.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.innerText = 'SAVING...';
  btn.disabled = true;

  const { data, error } = await sb.from('profiles').update({
    username: username,
    avatar_url: avatar_url || null,
    display_name: username
  }).eq('id', user.id);

  btn.innerText = 'SAVE SETTINGS';
  btn.disabled = false;

  if (error) {
    if (error.code === '23505' || error.message.includes('unique constraint')) {
      errEl.textContent = 'USERNAME ALREADY TAKEN.';
    } else {
      errEl.textContent = 'ERROR SAVING: ' + error.message;
    }
    errEl.classList.remove('hidden');
    return;
  }

  showToast('Settings Saved successfully! ✓', 'success');
  await loadUserProfile();
  await refreshProfiles();

  // Re-render UI
  if (document.getElementById('view-collab').classList.contains('flex')) {
    renderFriendsList();
    renderIncomingRequests();
  }

  closeSettings();
}

async function initCollab() {
  if (!user || collabChannel) return;

  // Load existing collab request state and profiles
  await refreshProfiles();
  await refreshCollabRequests();

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

  // Listen for collab_requests changes in realtime
  collabChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'collab_requests' }, async () => {
    await refreshProfiles();
    await refreshCollabRequests();
    renderIncomingRequests();
    renderApprovedPeeks();
    renderCollabUsers();
  });

  collabChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await collabChannel.track({
        email: user.email,
        user_id: user.id,
        joined_at: new Date().toISOString()
      });
    }
  });
}

async function refreshCollabRequests() {
  const { data } = await sb.from('collab_requests').select('*');
  if (!data) return;

  // Match incoming requests: target is me by ID, OR by email (for email-sent requests not yet claimed)
  incomingRequests = data.filter(r =>
    r.status === 'pending' &&
    (r.target_id === user.id || (r.target_id === null && r.target_email === user.email))
  );
  approvedPeeks = data.filter(r => r.requester_id === user.id && r.status === 'accepted');

  // Build outgoing map: target_email -> status (use email as key since target_id may be null)
  outgoingRequests = {};
  data.filter(r => r.requester_id === user.id).forEach(r => {
    outgoingRequests[r.target_email || r.target_id] = r.status;
  });
}

async function sendCollabRequest(targetId, targetEmail) {
  if (outgoingRequests[targetId]) {
    showToast(`Already ${outgoingRequests[targetId]} for ${targetEmail}`, 'warning');
    return;
  }
  const { error } = await sb.from('collab_requests').insert({
    requester_id: user.id,
    requester_email: user.email,
    target_id: targetId,
    status: 'pending'
  });
  if (error) { showToast('Request failed: ' + error.message, 'error'); return; }
  await refreshCollabRequests();
  renderCollabUsers();
  renderIncomingRequests();
  renderApprovedPeeks();
  // Notify success visually
  const btn = document.querySelector(`[data-req-target="${targetId}"]`);
  if (btn) { btn.textContent = 'PENDING...'; btn.disabled = true; }
}

async function respondToRequest(requestId, action) {
  const { error } = await sb.from('collab_requests').update({ status: action }).eq('id', requestId);
  if (error) { showToast('Failed: ' + error.message, 'error'); return; }
  await refreshCollabRequests();
  renderIncomingRequests();
  renderApprovedPeeks();
  renderCollabUsers();
}

async function openCollabPeek(targetUserId, targetEmail) {
  collabGrantedUser = { id: targetUserId, email: targetEmail };
  const overlay = document.getElementById('collab-peek-overlay');
  document.getElementById('collab-peek-title').textContent = `${targetEmail.split('@')[0].toUpperCase()}'S VAULT`;
  document.getElementById('collab-peek-list').innerHTML = '<div class="font-mono text-xs text-gray-400 text-center mt-10">Loading...</div>';
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');

  // Fetch from the secure RPC instead of directly from items. 
  // This hides content for unshared items but returns the title.
  const { data: combinedData, error } = await sb.rpc('get_friend_vault', { target_uid: targetUserId });

  const list = document.getElementById('collab-peek-list');
  if (error) {
    list.innerHTML = `<div class="font-mono text-xs text-neo-pink text-center mt-10">Error loading vault: ${error.message}</div>`;
    return;
  }

  if (!combinedData || combinedData.length === 0) {
    list.innerHTML = '<div class="font-mono text-xs text-gray-400 text-center mt-10">EMPTY VAULT</div>';
    return;
  }

  const typeColors = { note: 'bg-neo-green', link: 'bg-neo-purple', code: 'bg-neo-blue', idea: 'bg-neo-yellow', file: 'bg-neo-pink', mindmap: 'bg-neo-yellow' };

  list.innerHTML = combinedData.map(i => {
    const isShared = i.is_shared;
    const colorClass = typeColors[i.type] || 'bg-white';
    const escapedTitle = esc(i.title || 'UNTITLED');

    if (i.type === 'mindmap' && isShared) {
      return `
        <div class="${colorClass} rounded-xl border-3 border-black shadow-neo p-4 relative">
          <div class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-success border-2 border-black flex items-center justify-center rotate-12 shadow-sm">
            <span class="material-icons-outlined text-black text-sm">account_tree</span>
          </div>
          <div class="font-bold text-sm text-black">${escapedTitle}</div>
          <div class="text-xs font-mono text-black/60 mt-1 line-clamp-2">${esc((i.content || '').substring(0, 80))}</div>
          <div class="mt-3 flex justify-between items-center text-[10px] font-bold text-black/40 uppercase">
             <span>${i.type} · ${i.category || 'no category'}</span>
             <button onclick="switchView('mindmap'); setTimeout(() => loadMindMap('${i.name.replace(/'/g, "\\'")}', '${targetUserId}'), 300); closeCollabPeek()" class="text-black hover:text-white underline font-bold bg-black/10 px-2 py-1 rounded">OPEN MAP</button>
          </div>
        </div>
      `;
    }

    if (isShared) {
      // Unlocked item (Full access)
      return `
        <div class="${colorClass} rounded-xl border-3 border-black shadow-neo p-4 relative">
          <div class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-success border-2 border-black flex items-center justify-center rotate-12 shadow-sm">
            <span class="material-icons-outlined text-black text-sm">lock_open</span>
          </div>
          <div class="font-bold text-sm text-black">${escapedTitle}</div>
          <div class="text-xs font-mono text-black/60 mt-1 line-clamp-2">${esc((i.content || '').substring(0, 80))}</div>
          <div class="mt-3 flex justify-between items-center text-[10px] font-bold text-black/40 uppercase">
             <span>${i.type} · ${i.category || 'no category'}</span>
             <button onclick="selectAndOpen('${i.id}'); closeCollabPeek()" class="text-black hover:text-white underline bg-black/10 px-2 py-1 rounded font-bold">VIEW FULL</button>
          </div>
        </div>
      `;
    } else {
      // Locked item (Title only)
      return `
        <div class="bg-gray-100 dark:bg-gray-700/50 rounded-xl border-3 border-black/30 dark:border-white/20 p-4 relative group opacity-75 hover:opacity-100 transition-opacity">
          <div class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-neo-pink border-2 border-black flex items-center justify-center -rotate-12 shadow-sm">
            <span class="material-icons-outlined text-black text-sm">lock</span>
          </div>
          <div class="font-bold text-sm text-black/60 dark:text-white/60 line-through decoration-2 decoration-neo-pink">${escapedTitle}</div>
          <div class="text-[10px] font-mono text-neo-pink font-bold mt-1 uppercase flex items-center gap-1">
            <span class="material-icons-outlined text-[12px]">visibility_off</span> CONTENT ENCRYPTED
          </div>
          <div class="mt-4">
             <button onclick="requestItemAccess('${i.id}', '${escapedTitle.replace(/'/g, "\\'")}', '${targetUserId}', '${targetEmail}', this)" 
                class="w-full bg-white dark:bg-black border-2 border-black dark:border-white px-3 py-2 text-xs font-black uppercase text-black dark:text-white shadow-neo-sm hover:translate-y-[1px] hover:shadow-none transition-all flex justify-center items-center gap-2">
                <span class="material-icons-outlined text-sm">key</span> Request Access
             </button>
          </div>
        </div>
      `;
    }
  }).join('');
}

async function requestItemAccess(itemId, itemTitle, targetId, targetEmail, btnEl) {
  // Disable button immediately
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="material-icons-outlined text-sm animate-spin">sync</span> REQUESTING...';
    btnEl.classList.add('opacity-50', 'cursor-not-allowed');
  }

  const { error } = await sb.from('collab_requests').insert({
    requester_id: user.id,
    requester_email: user.email,
    target_id: targetId,
    target_email: targetEmail,
    item_id: itemId,
    item_title: itemTitle,
    status: 'pending'
  });

  if (error) {
    showToast('Failed to request item: ' + error.message, 'error');
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = '<span class="material-icons-outlined text-sm">key</span> Request Access';
      btnEl.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    return;
  }

  showToast(`Requested access to "${itemTitle}"!`, 'success');
  if (btnEl) {
    btnEl.innerHTML = '<span class="material-icons-outlined text-sm text-success">check</span> SENT';
    btnEl.classList.replace('bg-white', 'bg-neo-yellow');
    btnEl.classList.replace('dark:bg-black', 'bg-neo-yellow');
    btnEl.classList.replace('text-white', 'text-black');
  }
}

function closeCollabPeek() {
  collabGrantedUser = null;
  const overlay = document.getElementById('collab-peek-overlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

function renderCollabUsers() {
  const container = document.getElementById('collab-users-list');
  if (!container) return;

  const users = Object.values(activeUsers).map(u => u[0]);

  if (users.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-10">No active hunters</div>';
    return;
  }

  container.innerHTML = users.map(u => {
    const isMe = u.email === user?.email;
    const name = u.email ? u.email.split('@')[0] : 'Unknown';
    const targetId = u.user_id;
    const reqStatus = targetId ? outgoingRequests[targetId] : null;
    const isAccepted = reqStatus === 'accepted';

    let actionBtn = '';
    if (!isMe && targetId) {
      if (!reqStatus) {
        actionBtn = `<button data-req-target="${targetId}" onclick="sendCollabRequest('${targetId}','${u.email || ''}')" class="text-[9px] font-black uppercase border-2 border-black bg-primary px-2 py-1 rounded shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all">Request</button>`;
      } else if (reqStatus === 'pending') {
        actionBtn = `<span class="text-[9px] font-black uppercase border-2 border-black bg-neo-yellow px-2 py-1 rounded">Pending</span>`;
      } else if (reqStatus === 'accepted') {
        actionBtn = `<button onclick="openCollabPeek('${targetId}','${u.email || ''}')" class="text-[9px] font-black uppercase border-2 border-black bg-success px-2 py-1 rounded shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all">👁 View</button>`;
      } else if (reqStatus === 'denied') {
        actionBtn = `<span class="text-[9px] font-black uppercase border-2 border-black bg-neo-pink px-2 py-1 rounded">Denied</span>`;
      }
    }

    return `
      <div class="flex items-center gap-3 p-3 border-3 border-black rounded-xl bg-white shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all">
        ${getAvatarHtml(u.email || targetId, 'w-10 h-10', 'text-lg')}
        <div class="flex-1 min-w-0">
          <div class="font-bold text-black truncate flex items-center gap-2 text-sm">
            ${name}
            ${isMe ? '<span class="px-1.5 py-0.5 bg-neo-pink text-[9px] uppercase font-black border-2 border-black rounded">YOU</span>' : ''}
          </div>
          <div class="text-[10px] font-mono font-bold text-gray-400 truncate">Online</div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <div class="w-3 h-3 bg-success rounded-full border-2 border-black animate-pulse"></div>
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
}

function renderIncomingRequests() {
  const container = document.getElementById('collab-incoming-list');
  if (!container) return;

  if (incomingRequests.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-6">No pending requests</div>';
    return;
  }

  container.innerHTML = incomingRequests.map(r => {
    const name = r.requester_email ? r.requester_email.split('@')[0] : 'Unknown';
    const requestText = r.item_title
      ? `Wants to view item: <strong>${esc(r.item_title)}</strong>`
      : 'Wants to peek your vault';

    return `
      <div class="p-3 border-3 border-black rounded-xl bg-neo-yellow shadow-neo-sm flex flex-col gap-2">
        <div class="font-bold text-black text-sm">${name}</div>
        <div class="text-[10px] font-mono text-black/60">${r.requester_email}</div>
        <div class="text-[10px] font-mono text-black/60 bg-white/50 p-1 rounded border border-black/20">${requestText}</div>
        <div class="flex gap-2 mt-1">
          <button onclick="respondToRequest('${r.id}','accepted')" class="flex-1 bg-success border-2 border-black text-black text-[10px] font-black uppercase py-1 rounded shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all">✓ Accept</button>
          <button onclick="respondToRequest('${r.id}','denied')" class="flex-1 bg-neo-pink border-2 border-black text-black text-[10px] font-black uppercase py-1 rounded shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all">✕ Deny</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderApprovedPeeks() {
  const container = document.getElementById('collab-approved-list');
  if (!container) return;

  if (approvedPeeks.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-6">No approved access yet</div>';
    return;
  }

  // Deduplicate by target_id so a friend only shows up once
  const uniqueTargets = {};
  approvedPeeks.forEach(r => {
    if (!uniqueTargets[r.target_id]) uniqueTargets[r.target_id] = r;
  });

  container.innerHTML = Object.values(uniqueTargets).map(r => {
    const name = r.target_email || r.target_id.slice(0, 8);
    return `
      <div class="p-3 border-3 border-black rounded-xl bg-neo-green shadow-neo-sm flex items-center gap-3">
        ${getAvatarHtml(r.target_id || r.target_email, 'w-8 h-8', 'text-sm')}
        <div class="flex-1 min-w-0">
          <div class="font-bold text-black text-xs truncate">${name}</div>
          <div class="text-[9px] font-mono text-black/50">Access granted</div>
        </div>
        <button onclick="openCollabPeek('${r.target_id}','${r.target_email || r.target_id}')" class="bg-black text-white text-[9px] font-black uppercase px-2 py-1 rounded shadow-sm hover:bg-gray-800 transition-colors">👁 View</button>
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

// ─── FRIENDS SYSTEM ────────────────────────────────────
let friends = []; // accepted collab_requests in both directions
let chatFriendId = null;
let chatFriendEmail = null;
let chatMessages = [];
let messageChannel = null;

async function getFriends() {
  const { data } = await sb.from('collab_requests').select('*').eq('status', 'accepted');
  if (!data) return [];
  return data.map(r => {
    if (r.requester_id === user.id) return { id: r.target_id, email: r.target_email || r.target_id.slice(0, 8) };
    return { id: r.requester_id, email: r.requester_email };
  });
}

async function renderFriendsList() {
  const container = document.getElementById('collab-friends-list');
  if (!container) return;

  friends = await getFriends();

  if (friends.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-6 leading-relaxed">No friends yet.<br/>Send a request below!</div>';
    return;
  }

  container.innerHTML = friends.map(f => {
    const profile = globalProfiles[f.id] || {};
    const name = profile.username || profile.display_name || f.email.split('@')[0];
    return `
      <div class="p-3 border-3 border-black rounded-xl bg-white shadow-neo-sm flex items-center gap-3">
        ${getAvatarHtml(f.id || f.email, 'w-10 h-10', 'text-lg')}
        <div class="flex-1 min-w-0">
          <div class="font-bold text-black text-sm truncate">${name}</div>
          <div class="text-[10px] font-mono text-gray-400 truncate">${f.email}</div>
        </div>
        <div class="flex flex-col gap-1">
          <button onclick="openChat('${f.id}','${f.email}')"
            class="bg-neo-blue border-2 border-black text-black text-[9px] font-black px-2 py-1 rounded shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all">💬 Chat</button>
          <button onclick="openCollabPeek('${f.id}','${f.email}')"
            class="bg-neo-yellow border-2 border-black text-black text-[9px] font-black px-2 py-1 rounded shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all">👁 Vault</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── USER SEARCH & FRIEND REQUEST ──────────────────────
let searchTimeout = null;

async function searchUsers() {
  const input = document.getElementById('user-search-input');
  const q = (input?.value || '').trim();
  const results = document.getElementById('user-search-results');
  if (!results) return;

  clearTimeout(searchTimeout);
  if (q.length < 2) {
    results.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-2">Type to search users...</div>';
    return;
  }

  results.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-2 animate-pulse">Searching...</div>';

  searchTimeout = setTimeout(async () => {
    const { data } = await sb.from('profiles')
      .select('id, email, display_name')
      .ilike('display_name', `%${q}%`)
      .neq('id', user.id)
      .limit(8);

    const users = data || [];
    if (users.length === 0) {
      results.innerHTML = '<div class="text-center text-gray-400 font-mono text-xs mt-2">No users found</div>';
      return;
    }

    results.innerHTML = users.map(p => {
      const name = p.username || p.display_name || p.email.split('@')[0];
      const alreadySent = outgoingRequests[p.email] || outgoingRequests[p.id];
      return `
        <div class="flex items-center gap-3 p-2 border-2 border-black rounded-xl bg-white hover:bg-gray-50 transition-colors">
          ${getAvatarHtml(p.id || p.email, 'w-9 h-9', 'text-sm')}
          <div class="flex-1 min-w-0">
            <div class="font-bold text-black text-sm truncate">${esc(name)}</div>
            <div class="text-[10px] font-mono text-gray-400 truncate">${esc(p.email)}</div>
          </div>
          ${alreadySent
          ? `<span class="text-[9px] font-black text-gray-400 uppercase border border-gray-300 rounded px-2 py-1">${alreadySent}</span>`
          : `<button onclick="sendDirectFriendRequest('${p.id}','${p.email}')"
                class="bg-primary border-2 border-black rounded-lg px-2 py-1 font-black text-black text-[9px] uppercase shadow-neo-sm hover:shadow-none hover:translate-y-[1px] transition-all flex-shrink-0">
                Add
              </button>`
        }
        </div>
      `;
    }).join('');
  }, 300);
}

async function sendDirectFriendRequest(targetId, targetEmail) {
  const { error } = await sb.from('collab_requests').insert({
    requester_id: user.id,
    requester_email: user.email,
    target_id: targetId,
    target_email: targetEmail,
    status: 'pending'
  });
  if (error) { showToast('Could not send request: ' + error.message, 'error'); return; }
  showToast(`Friend request sent to ${targetEmail.split('@')[0]}! ✓`, 'success');
  await refreshCollabRequests();
  searchUsers(); // re-render to show "pending" state
}


// No longer needed: all friend requests now use real UUIDs from profile search
async function claimPendingRequests() { /* no-op */ }


function openChat(friendId, friendEmail) {
  chatFriendId = friendId;
  chatFriendEmail = friendEmail;
  chatMessages = [];

  const panel = document.getElementById('chat-panel');
  const nameEl = document.getElementById('chat-friend-name');
  if (nameEl) nameEl.textContent = friendEmail.split('@')[0].toUpperCase();
  if (panel) { panel.classList.remove('hidden', 'translate-y-full'); panel.classList.add('flex'); }

  loadMessages();
  subscribeToMessages();
}

function closeChat() {
  const panel = document.getElementById('chat-panel');
  if (panel) { panel.classList.add('hidden'); panel.classList.remove('flex'); }
  if (messageChannel) { sb.removeChannel(messageChannel); messageChannel = null; }
  chatFriendId = null;
}

async function loadMessages() {
  if (!chatFriendId) return;
  const { data } = await sb.from('messages')
    .select('*')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${chatFriendId}),and(sender_id.eq.${chatFriendId},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: true })
    .limit(100);
  chatMessages = data || [];
  renderMessages();

  // Mark received messages as read
  await sb.from('messages').update({ is_read: true })
    .eq('receiver_id', user.id).eq('sender_id', chatFriendId).eq('is_read', false);
}

function subscribeToMessages() {
  if (messageChannel) sb.removeChannel(messageChannel);
  messageChannel = sb.channel(`chat-${[user.id, chatFriendId].sort().join('-')}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const msg = payload.new;
      if ((msg.sender_id === chatFriendId && msg.receiver_id === user.id) ||
        (msg.sender_id === user.id && msg.receiver_id === chatFriendId)) {
        chatMessages.push(msg);
        renderMessages();
      }
    })
    .subscribe();
}

function renderMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  if (chatMessages.length === 0) {
    container.innerHTML = '<div class="text-center font-mono text-xs text-gray-400 mt-8">No messages yet. Say hi! 👋</div>';
    return;
  }

  container.innerHTML = chatMessages.map(m => {
    const mine = m.sender_id === user.id;
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="flex ${mine ? 'justify-end' : 'justify-start'} mb-2">
        <div class="max-w-[75%] ${mine
        ? 'bg-primary border-2 border-black rounded-2xl rounded-tr-sm shadow-neo-sm'
        : 'bg-white border-2 border-black rounded-2xl rounded-tl-sm shadow-neo-sm'} px-3 py-2">
          <div class="text-sm font-bold text-black leading-snug">${esc(m.content)}</div>
          <div class="text-[9px] font-mono text-black/50 mt-0.5 ${mine ? 'text-right' : 'text-left'}">${time}</div>
        </div>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const content = (input?.value || '').trim();
  if (!content || !chatFriendId) return;
  input.value = '';

  const { error } = await sb.from('messages').insert({
    sender_id: user.id,
    receiver_id: chatFriendId,
    sender_email: user.email,
    content
  });

  if (error) {
    showToast('Send failed: ' + error.message, 'error');
    input.value = content; // restore text so user doesn't lose it
    return;
  }

  // Always reload after sending (realtime may not be active yet)
  await loadMessages();
}

function chatInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

// ─── MIND MAP SHARING ───────────────────────────────────
let shareMapName = null;

async function openShareMapModal(mapName) {
  shareMapName = mapName;
  const modal = document.getElementById('modal-share-map');
  const title = document.getElementById('share-map-name-display');
  const list = document.getElementById('share-friends-list');
  if (!modal) return;
  if (title) title.textContent = `"${mapName}"`;
  if (list) list.innerHTML = '<div class="font-mono text-xs text-gray-400 text-center py-4">Loading friends...</div>';
  modal.classList.remove('hidden'); modal.classList.add('flex');

  friends = await getFriends();
  if (!list) return;
  if (friends.length === 0) {
    list.innerHTML = '<div class="font-mono text-xs text-gray-400 text-center py-4">No friends yet to share with.</div>';
    return;
  }
  list.innerHTML = friends.map(f => {
    const name = f.email.split('@')[0];
    return `
      <button onclick="shareMindMap('${mapName.replace(/'/g, "\\'")}','${f.id}','${f.email}')"
        class="w-full flex items-center gap-3 p-3 border-2 border-black rounded-xl bg-white hover:bg-neo-green shadow-neo-sm hover:shadow-none transition-all text-left">
        <div class="w-8 h-8 flex-shrink-0 rounded-full border-2 border-black bg-neo-yellow flex items-center justify-center font-bold">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div class="font-bold text-sm text-black">${name}</div>
          <div class="text-[10px] font-mono text-gray-400">${f.email}</div>
        </div>
        <span class="material-icons-outlined text-black ml-auto">send</span>
      </button>
    `;
  }).join('');
}

function closeShareMapModal() {
  const modal = document.getElementById('modal-share-map');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  shareMapName = null;
}

// ─── ITEM SHARING (GRANULAR PERMISSIONS) ─────────────────
let shareItemId = null;
let currentItemSharedWith = [];

async function openShareItemModal(itemId, itemTitle, sharedWithCsv) {
  shareItemId = itemId;
  currentItemSharedWith = sharedWithCsv ? sharedWithCsv.split(',') : [];

  const modal = document.getElementById('modal-share-item');
  const title = document.getElementById('share-item-name-display');
  const list = document.getElementById('share-item-friends-list');
  if (!modal) return;
  if (title) title.textContent = `"${itemTitle}"`;
  if (list) list.innerHTML = '<div class="font-mono text-xs text-gray-400 text-center py-4">Loading friends...</div>';
  modal.classList.remove('hidden'); modal.classList.add('flex');

  friends = await getFriends();
  if (!list) return;
  if (friends.length === 0) {
    list.innerHTML = '<div class="font-mono text-xs text-gray-400 text-center py-4">No friends yet to share with.</div>';
    return;
  }

  // Render friends with a toggle indicating if they currently have access
  list.innerHTML = friends.map(f => {
    const name = f.email.split('@')[0];
    const hasAccess = currentItemSharedWith.includes(f.id);
    const btnClass = hasAccess
      ? "bg-success hover:bg-red-400"
      : "bg-white hover:bg-neo-green";

    return `
      <div class="flex items-center gap-3 p-3 border-2 border-black rounded-xl ${btnClass} shadow-neo-sm transition-all">
        ${getAvatarHtml(f.id || f.email, 'w-8 h-8', 'text-sm')}
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm text-black">${name}</div>
          <div class="text-[10px] font-mono text-gray-800">${f.email}</div>
        </div>
        <button onclick="toggleItemShare('${f.id}', '${f.email}')" class="bg-black text-white px-3 py-1 text-xs font-bold uppercase rounded border-2 border-transparent hover:border-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-neo-pink">
          ${hasAccess ? 'Revoke' : 'Grant'}
        </button>
      </div>
    `;
  }).join('');
}

function closeShareItemModal() {
  const modal = document.getElementById('modal-share-item');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  shareItemId = null;
}

async function toggleItemShare(friendId, friendEmail) {
  if (!shareItemId) return;

  const hasAccess = currentItemSharedWith.includes(friendId);
  const newSharedWith = hasAccess
    ? currentItemSharedWith.filter(id => id !== friendId)
    : [...currentItemSharedWith, friendId];

  const { error } = await sb.from('items')
    .update({ shared_with: newSharedWith })
    .eq('id', shareItemId);

  if (error) {
    showToast('Could not update sharing: ' + error.message, 'error');
    return;
  }

  // Update local state and UI
  currentItemSharedWith = newSharedWith;

  // Update the local items cache so the gallery UI uses the latest array
  const cachedItem = items.find(i => i.id === shareItemId);
  if (cachedItem) cachedItem.shared_with = currentItemSharedWith;

  showToast(`${hasAccess ? 'Revoked' : 'Granted'} access for ${friendEmail.split('@')[0]}! ✓`);

  // Re-render the gallery to update the "Share" button's CSV string, and refresh modal
  if (!document.getElementById('gallery').classList.contains('hidden')) {
    renderGallery();
  }

  // Re-open/refresh modal to show updated toggle states
  const title = document.getElementById('share-item-name-display')?.textContent || 'Item';
  openShareItemModal(shareItemId, title.replace(/"/g, ''), currentItemSharedWith.join(','));
}

async function shareMindMap(mapName, friendId, friendEmail) {
  // Add friendId to the shared_with array for this map
  const { data: map, error: fetchErr } = await sb.from('mindmaps')
    .select('*').eq('user_id', user.id).eq('name', mapName).single();

  if (fetchErr || !map) { alert('Map not found.'); return; }

  const alreadyShared = (map.shared_with || []).includes(friendId);
  if (alreadyShared) {
    closeShareMapModal();
    alert(`Already shared with ${friendEmail.split('@')[0]}!`);
    return;
  }

  const newSharedWith = [...(map.shared_with || []), friendId];
  const { error } = await sb.from('mindmaps')
    .update({ shared_with: newSharedWith }).eq('id', map.id);

  if (error) { showToast('Could not share: ' + error.message, 'error'); return; }
  closeShareMapModal();

  // Also send a chat message notification
  await sb.from('messages').insert({
    sender_id: user.id,
    receiver_id: friendId,
    sender_email: user.email,
    content: `📊 I shared a mind map with you: "${mapName}". Check your Dashboard!`
  });

  showToast(`Shared "${mapName}" with ${friendEmail.split('@')[0]}! ✓`, 'success');
}

// ─── DASHBOARD: SHARED MAPS WIDGET ──────────────────────
async function renderDashboardSharedMaps() {
  const container = document.getElementById('dashboard-shared-maps');
  if (!container || !sb || !user) return;

  const { data } = await sb.from('mindmaps')
    .select('name, user_id, updated_at')
    .contains('shared_with', [user.id])
    .order('updated_at', { ascending: false });

  const maps = data || [];
  if (maps.length === 0) {
    container.innerHTML = '<div class="text-[10px] font-mono text-gray-400 text-center py-2">None shared with you yet</div>';
    return;
  }
  container.innerHTML = maps.map(m => `
    <button onclick="switchView('mindmap'); setTimeout(() => loadSharedMap('${m.user_id}','${m.name.replace(/'/g, "\\'")}'), 300)"
      class="w-full text-left flex items-center gap-2 px-3 py-2 border-2 border-black dark:border-white rounded-lg bg-neo-blue/30 hover:bg-neo-blue hover:shadow-neo-sm font-bold text-[11px] text-black dark:text-black transition-all">
      <span class="material-icons-outlined text-sm flex-shrink-0">share</span>
      <span class="truncate">${esc(m.name)}</span>
    </button>
  `).join('');
}
