// ═══════════════════════════════════════════
//  THE GOTED — Mind Map Drawing Canvas v2
// ═══════════════════════════════════════════

let mmNodes = [];
let mmConnections = [];
let mmNodeId = 0;
let mmSelected = null;
let mmDragging = null;
let mmDragOffset = { x: 0, y: 0 };
let mmMode = 'select'; // 'select', 'connect'
let mmConnectFrom = null;
let mmResizing = null;
let mmResizeStart = { x: 0, y: 0, w: 0, h: 0 };
let mmShapeMenuOpen = false;
let mmLineMenuOpen = false;

const MM_SHAPES = [
  { id: 'rect', label: '▭ Rectangle', color: '#B8E6FF' },
  { id: 'rounded', label: '▢ Rounded', color: '#C4B5FD' },
  { id: 'circle', label: '○ Circle', color: '#FF90E8' },
  { id: 'diamond', label: '◇ Diamond', color: '#FFD028' },
  { id: 'hexagon', label: '⬡ Hexagon', color: '#34D399' },
  { id: 'parallelogram', label: '▱ Slanted', color: '#FB923C' },
  { id: 'star', label: '★ Star', color: '#F87171' },
  { id: 'cloud', label: '☁ Cloud', color: '#E0E7FF' },
];

const MM_LINE_TYPES = [
  { id: 'arrow', label: '→ Arrow', style: 'solid', marker: true },
  { id: 'dashed', label: '⇢ Dashed', style: 'dashed', marker: true },
  { id: 'dotted', label: '⋯ Dotted', style: 'dotted', marker: true },
  { id: 'solid', label: '— Solid', style: 'solid', marker: false },
  { id: 'double', label: '⇔ Double', style: 'solid', marker: 'both' },
];

let mmCurrentLineType = 'arrow';
let currentMapName = null; // tracks most recently loaded/saved map name

// ─── SHAPE MENU ───────────────────────────
function toggleShapeMenu() {
  mmShapeMenuOpen = !mmShapeMenuOpen;
  mmLineMenuOpen = false;
  renderMindMapToolbar();
}

function toggleLineMenu() {
  mmLineMenuOpen = !mmLineMenuOpen;
  mmShapeMenuOpen = false;
  renderMindMapToolbar();
}

function setConnectMode() {
  mmMode = mmMode === 'connect' ? 'select' : 'connect';
  mmConnectFrom = null;
  mmShapeMenuOpen = false;
  mmLineMenuOpen = false;
  renderMindMapToolbar();
  renderMindMapCanvas();
}

function renderMindMapToolbar() {
  const tb = document.getElementById('mindmap-toolbar');
  if (!tb) return;

  const connectActive = mmMode === 'connect'
    ? 'bg-accent-green border-3 border-black shadow-neo-sm ring-2 ring-green-400'
    : 'bg-white border-3 border-black shadow-neo-sm';

  tb.innerHTML = `
    <!-- Node Counter -->
    <div class="font-mono text-xs font-bold bg-white border-3 border-black px-3 py-1.5 shadow-neo-sm rounded-lg text-black flex items-center gap-1.5">
      <span class="material-icons-outlined text-sm">hub</span>
      ${mmNodes.length} NODES
    </div>
    
    <!-- Shapes Dropdown -->
    <div class="relative">
      <button onclick="toggleShapeMenu()" class="bg-neo-blue text-black border-3 border-black px-3 py-1.5 font-bold text-xs shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all rounded-lg flex items-center gap-1.5">
        <span class="material-icons-outlined text-sm">category</span>
        Shapes
        <span class="material-icons-outlined text-sm">${mmShapeMenuOpen ? 'expand_less' : 'expand_more'}</span>
      </button>
      ${mmShapeMenuOpen ? `
        <div class="absolute top-full right-0 mt-2 bg-white border-3 border-black rounded-xl shadow-neo p-2 z-50 w-48">
          <div class="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest px-2 mb-1">Add Shape</div>
          ${MM_SHAPES.map(s => `
            <button onclick="addMindMapNode('${s.id}'); toggleShapeMenu();" 
                    class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-100 rounded-lg flex items-center gap-2.5 transition-colors">
              <div class="w-5 h-5 rounded-md border-2 border-black shadow-sm" style="background:${s.color}"></div>
              ${s.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Lines Dropdown -->
    <div class="relative">
      <button onclick="toggleLineMenu()" class="bg-neo-purple text-black border-3 border-black px-3 py-1.5 font-bold text-xs shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all rounded-lg flex items-center gap-1.5">
        <span class="material-icons-outlined text-sm">timeline</span>
        Lines
        <span class="material-icons-outlined text-sm">${mmLineMenuOpen ? 'expand_less' : 'expand_more'}</span>
      </button>
      ${mmLineMenuOpen ? `
        <div class="absolute top-full right-0 mt-2 bg-white border-3 border-black rounded-xl shadow-neo p-2 z-50 w-44">
          <div class="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest px-2 mb-1">Line Style</div>
          ${MM_LINE_TYPES.map(l => `
            <button onclick="mmCurrentLineType='${l.id}'; toggleLineMenu(); setConnectMode();" 
                    class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 ${mmCurrentLineType === l.id ? 'bg-neo-green/30 border-2 border-black' : ''}">
              ${mmCurrentLineType === l.id ? '<span class="material-icons-outlined text-sm text-green-600">check_circle</span>' : '<span class="w-4"></span>'}
              ${l.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Connect Mode Toggle -->
    <button onclick="setConnectMode()" class="${connectActive} text-black px-3 py-1.5 font-bold text-xs hover:shadow-neo hover:-translate-y-0.5 transition-all rounded-lg flex items-center gap-1.5" title="Connect Mode">
      <span class="material-icons-outlined text-sm">${mmMode === 'connect' ? 'link' : 'add_link'}</span>
      ${mmMode === 'connect' ? 'Linking...' : 'Connect'}
    </button>

    <!-- Save -->
    <button onclick="saveMindMap()" class="bg-success text-black border-3 border-black px-3 py-1.5 font-bold text-xs shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all rounded-lg flex items-center gap-1.5" title="Save Mind Map">
      <span class="material-icons-outlined text-sm">save</span>
      Save
    </button>

    <!-- Share -->
    <button onclick="openShareMapModal(currentMapName || '')" class="bg-neo-blue text-black border-3 border-black px-3 py-1.5 font-bold text-xs shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all rounded-lg flex items-center gap-1.5" title="Share with a friend">
      <span class="material-icons-outlined text-sm">share</span>
      Share
    </button>

    <!-- Clear -->
    <button onclick="clearMindMap()" class="bg-neo-pink text-black border-3 border-black px-3 py-1.5 font-bold text-xs shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all rounded-lg flex items-center gap-1.5" title="Clear All">
      <span class="material-icons-outlined text-sm">delete_sweep</span>
      Clear
    </button>
  `;
}

// ─── ADD NODE ─────────────────────────────
function addMindMapNode(shape) {
  const canvas = document.getElementById('mindmap-canvas');
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const shapeInfo = MM_SHAPES.find(s => s.id === shape) || MM_SHAPES[0];
  const x = rect.width / 2 - 70 + (Math.random() * 140 - 70);
  const y = rect.height / 2 - 30 + (Math.random() * 60 - 30);

  const node = {
    id: 'mm-' + (++mmNodeId),
    shape: shape,
    x: Math.max(10, Math.min(rect.width - 150, x)),
    y: Math.max(10, Math.min(rect.height - 60, y)),
    w: 130,
    h: 55,
    text: 'New Node',
    color: shapeInfo.color
  };

  mmNodes.push(node);
  mmSelected = node.id;
  renderMindMapCanvas();
  renderMindMapToolbar();
}

// ─── RENDER CANVAS ────────────────────────
function renderMindMapCanvas() {
  const container = document.getElementById('mindmap-nodes');
  const svg = document.getElementById('mindmap-svg');
  if (!container || !svg) return;

  // Render SVG connections
  let svgContent = `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" fill="#333">
        <polygon points="0 0, 10 3.5, 0 7" />
      </marker>
      <marker id="arrowhead-start" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" fill="#333">
        <polygon points="10 0, 0 3.5, 10 7" />
      </marker>
    </defs>
  `;

  mmConnections.forEach((conn, idx) => {
    const from = mmNodes.find(n => n.id === conn.from);
    const to = mmNodes.find(n => n.id === conn.to);
    if (!from || !to) return;

    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h / 2;
    const x2 = to.x + to.w / 2;
    const y2 = to.y + to.h / 2;

    const lineType = MM_LINE_TYPES.find(l => l.id === conn.lineType) || MM_LINE_TYPES[0];
    let dashArray = '';
    if (lineType.style === 'dashed') dashArray = 'stroke-dasharray="8 4"';
    if (lineType.style === 'dotted') dashArray = 'stroke-dasharray="2 4"';

    let markerEnd = lineType.marker === true || lineType.marker === 'both' ? 'marker-end="url(#arrowhead)"' : '';
    let markerStart = lineType.marker === 'both' ? 'marker-start="url(#arrowhead-start)"' : '';

    svgContent += `
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
            stroke="#333" stroke-width="2" ${dashArray}
            ${markerEnd} ${markerStart}
            class="cursor-pointer hover:stroke-red-500" style="transition: stroke 0.2s"
            onclick="removeConnection(${idx})" />
    `;
  });

  svg.innerHTML = svgContent;

  // Render nodes using inline SVG for clean shapes
  container.innerHTML = mmNodes.map(node => {
    const selected = mmSelected === node.id;
    const selRing = selected ? 'ring-3 ring-primary ring-offset-2' : '';
    const connectHighlight = mmMode === 'connect' && mmConnectFrom && mmConnectFrom !== node.id
      ? 'ring-2 ring-green-400 animate-pulse' : '';
    const connectFrom = mmMode === 'connect' && mmConnectFrom === node.id
      ? 'ring-2 ring-blue-500' : '';

    const w = node.w;
    const h = node.h;

    // Build SVG path for each shape
    let svgShape = '';
    switch (node.shape) {
      case 'rect':
        svgShape = `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="4" ry="4" fill="${node.color}" stroke="#000" stroke-width="2.5"/>`;
        break;
      case 'rounded':
        svgShape = `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="18" ry="18" fill="${node.color}" stroke="#000" stroke-width="2.5"/>`;
        break;
      case 'circle':
        svgShape = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 2}" ry="${h / 2 - 2}" fill="${node.color}" stroke="#000" stroke-width="2.5"/>`;
        break;
      case 'diamond': {
        const cx = w / 2, cy = h / 2;
        svgShape = `<polygon points="${cx},3 ${w - 3},${cy} ${cx},${h - 3} 3,${cy}" fill="${node.color}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;
        break;
      }
      case 'hexagon': {
        const cx = w / 2, cy = h / 2;
        const rx = w / 2 - 3, ry = h / 2 - 3;
        const pts = [0, 1, 2, 3, 4, 5].map(i => {
          const a = Math.PI / 3 * i - Math.PI / 6;
          return `${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`;
        }).join(' ');
        svgShape = `<polygon points="${pts}" fill="${node.color}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;
        break;
      }
      case 'parallelogram': {
        const skew = w * 0.18;
        svgShape = `<polygon points="${skew + 3},3 ${w - 3},3 ${w - skew - 3},${h - 3} 3,${h - 3}" fill="${node.color}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;
        break;
      }
      case 'star': {
        const cx = w / 2, cy = h / 2;
        const outerR = Math.min(w, h) / 2 - 3;
        const innerR = outerR * 0.4;
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = Math.PI / 5 * i - Math.PI / 2;
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
        }
        svgShape = `<polygon points="${pts.join(' ')}" fill="${node.color}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;
        break;
      }
      case 'cloud': {
        const p = `M ${w * 0.25},${h * 0.7} 
                    C ${w * 0.05},${h * 0.7} ${w * 0.05},${h * 0.4} ${w * 0.2},${h * 0.35}
                    C ${w * 0.15},${h * 0.15} ${w * 0.35},${h * 0.05} ${w * 0.45},${h * 0.2}
                    C ${w * 0.5},${h * 0.05} ${w * 0.7},${h * 0.05} ${w * 0.75},${h * 0.2}
                    C ${w * 0.9},${h * 0.15} ${w * 0.95},${h * 0.4} ${w * 0.85},${h * 0.5}
                    C ${w * 0.95},${h * 0.6} ${w * 0.9},${h * 0.75} ${w * 0.75},${h * 0.7}
                    Z`;
        svgShape = `<path d="${p}" fill="${node.color}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;
        break;
      }
    }

    return `
      <div class="absolute cursor-move select-none ${selRing} ${connectHighlight} ${connectFrom} hover:opacity-90 transition-all group"
           style="left:${node.x}px; top:${node.y}px; width:${node.w}px; height:${node.h}px;"
           id="${node.id}"
           onmousedown="startDragNode(event, '${node.id}')"
           onclick="handleNodeClick(event, '${node.id}')"
           ondblclick="editNodeText('${node.id}')">
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="absolute inset-0">
          ${svgShape}
          <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" 
                font-size="12" font-weight="bold" font-family="ui-monospace, monospace" fill="#000"
                class="pointer-events-none">${node.text}</text>
        </svg>
        
        <!-- Resize handle -->
        ${selected ? `
          <div class="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary border-2 border-black rounded-sm cursor-se-resize z-30"
               onmousedown="startResize(event, '${node.id}')"></div>
          <div class="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
            <button onclick="event.stopPropagation(); removeNode('${node.id}')" class="bg-red-400 text-white border border-black px-1.5 py-0.5 text-[9px] font-bold rounded shadow-sm" title="Delete">✕</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ─── NODE INTERACTIONS ────────────────────
function handleNodeClick(e, id) {
  e.stopPropagation();

  if (mmMode === 'connect') {
    if (!mmConnectFrom) {
      mmConnectFrom = id;
      renderMindMapCanvas();
    } else if (mmConnectFrom !== id) {
      const exists = mmConnections.some(c =>
        (c.from === mmConnectFrom && c.to === id) || (c.from === id && c.to === mmConnectFrom)
      );
      if (!exists) {
        mmConnections.push({ from: mmConnectFrom, to: id, lineType: mmCurrentLineType });
      }
      mmConnectFrom = null;
      renderMindMapCanvas();
      renderMindMapToolbar();
    }
    return;
  }

  mmSelected = mmSelected === id ? null : id;
  renderMindMapCanvas();
}

function removeConnection(idx) {
  mmConnections.splice(idx, 1);
  renderMindMapCanvas();
}

function removeNode(id) {
  mmNodes = mmNodes.filter(n => n.id !== id);
  mmConnections = mmConnections.filter(c => c.from !== id && c.to !== id);
  if (mmSelected === id) mmSelected = null;
  renderMindMapCanvas();
  renderMindMapToolbar();
}

function editNodeText(id) {
  const node = mmNodes.find(n => n.id === id);
  if (!node) return;

  const canvas = document.getElementById('mindmap-canvas');
  if (document.getElementById('mm-node-editor')) {
    document.getElementById('mm-node-editor').remove();
  }

  const input = document.createElement('input');
  input.id = 'mm-node-editor';
  input.type = 'text';
  input.value = node.text;

  // Position over the node
  input.style.position = 'absolute';
  input.style.left = node.x + 'px';
  input.style.top = node.y + 'px';
  input.style.width = node.w + 'px';
  input.style.height = node.h + 'px';
  input.style.zIndex = '100';

  // Styling matching neo-brutalist
  input.className = 'bg-white border-3 border-black text-center font-bold font-mono text-sm focus:outline-none focus:ring-4 ring-primary shadow-neo-sm rounded-lg';

  canvas.appendChild(input);
  input.focus();
  input.select();

  const save = () => {
    if (input.value !== null && input.value.trim() !== '') {
      node.text = input.value.trim();
    }
    input.remove();
    renderMindMapCanvas();
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      input.remove();
      renderMindMapCanvas();
    }
  });
}

// ─── DRAG ─────────────────────────────────
function startDragNode(e, id) {
  if (mmMode === 'connect') return;
  e.stopPropagation();
  const node = mmNodes.find(n => n.id === id);
  if (!node) return;

  mmDragging = id;
  mmSelected = id;
  const canvas = document.getElementById('mindmap-canvas');
  const cr = canvas.getBoundingClientRect();
  mmDragOffset.x = e.clientX - cr.left - node.x;
  mmDragOffset.y = e.clientY - cr.top - node.y;

  const onMove = (ev) => {
    const n = mmNodes.find(n => n.id === mmDragging);
    if (!n) return;
    const cr = canvas.getBoundingClientRect();
    n.x = Math.max(0, Math.min(cr.width - n.w, ev.clientX - cr.left - mmDragOffset.x));
    n.y = Math.max(0, Math.min(cr.height - n.h, ev.clientY - cr.top - mmDragOffset.y));
    renderMindMapCanvas();
  };

  const onUp = () => {
    mmDragging = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ─── RESIZE ───────────────────────────────
function startResize(e, id) {
  e.stopPropagation();
  e.preventDefault();
  const node = mmNodes.find(n => n.id === id);
  if (!node) return;

  mmResizing = id;
  mmResizeStart = { x: e.clientX, y: e.clientY, w: node.w, h: node.h };

  const onMove = (ev) => {
    const n = mmNodes.find(n => n.id === mmResizing);
    if (!n) return;
    const dx = ev.clientX - mmResizeStart.x;
    const dy = ev.clientY - mmResizeStart.y;
    n.w = Math.max(60, mmResizeStart.w + dx);
    n.h = Math.max(30, mmResizeStart.h + dy);
    renderMindMapCanvas();
  };

  const onUp = () => {
    mmResizing = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ─── CANVAS CLICK ─────────────────────────
function handleCanvasClick(e) {
  if (e.target.id === 'mindmap-canvas' || e.target.id === 'mindmap-svg' || e.target.id === 'mindmap-nodes') {
    mmSelected = null;
    if (mmMode === 'connect') {
      mmConnectFrom = null;
    }
    mmShapeMenuOpen = false;
    mmLineMenuOpen = false;
    renderMindMapCanvas();
    renderMindMapToolbar();
  }
}

// ─── SAVE / LOAD ──────────────────────────
function saveMindMap() {
  // Open the custom save modal instead of native prompt()
  const modal = document.getElementById('modal-save-map');
  const input = document.getElementById('save-map-name');
  if (!modal || !input) return;
  input.value = 'My Mind Map';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => { input.select(); input.focus(); }, 50);
}

async function confirmSaveMap() {
  if (!sb || !user) { showToast('Not logged in', 'error'); return; }
  const input = document.getElementById('save-map-name');
  const name = (input?.value || '').trim();
  if (!name) { input?.focus(); return; }

  const btn = document.getElementById('save-map-btn');
  if (btn) { btn.textContent = 'SAVING...'; btn.disabled = true; }

  const { error } = await sb.from('mindmaps').upsert({
    user_id: user.id,
    name: name,
    nodes: mmNodes,
    connections: mmConnections,
    node_id_counter: mmNodeId,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,name' });

  if (btn) { btn.textContent = 'SAVE'; btn.disabled = false; }

  if (error) { showToast('Save failed: ' + error.message, 'error'); return; }

  currentMapName = name;
  closeSaveMapModal();

  const statusEl = document.getElementById('mm-save-status');
  if (statusEl) {
    statusEl.textContent = `✓ Saved "${name}"`;
    statusEl.classList.remove('opacity-0');
    setTimeout(() => statusEl.classList.add('opacity-0'), 2500);
  }
  await renderSavedMaps();
  if (typeof load === 'function') setTimeout(() => load(), 100);
}

function closeSaveMapModal() {
  const modal = document.getElementById('modal-save-map');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function loadMindMap(name, ownerId = null) {
  if (!sb || !user) return;
  const targetId = ownerId || user.id;

  const { data, error } = await sb.from('mindmaps')
    .select('*')
    .eq('user_id', targetId)
    .eq('name', name)
    .single();

  if (error || !data) return;

  mmNodes = data.nodes || [];
  mmConnections = data.connections || [];
  mmNodeId = data.node_id_counter || mmNodes.length;
  currentMapName = name;
  mmSelected = null;
  mmMode = 'select';
  mmConnectFrom = null;
  renderMindMapCanvas();
  renderMindMapToolbar();
  await renderSavedMaps();
}

async function deleteSavedMap(name) {
  if (!confirm(`Delete "${name}"?`)) return;
  if (!sb || !user) return;

  const { error } = await sb.from('mindmaps')
    .delete()
    .eq('user_id', user.id)
    .eq('name', name);

  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  await renderSavedMaps();
}

async function renderSavedMaps() {
  const list = document.getElementById('mm-saved-list');
  if (!list) return;

  if (!sb || !user) {
    list.innerHTML = '<span class="text-xs font-mono text-gray-400">No saved maps</span>';
    return;
  }

  const { data } = await sb.from('mindmaps')
    .select('name')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  const names = (data || []).map(r => r.name);

  if (names.length === 0) {
    list.innerHTML = '<span class="text-xs font-mono text-gray-400">No saved maps</span>';
    return;
  }

  list.innerHTML = names.map(n => `
    <button onclick="loadMindMap('${n.replace(/'/g, "\\'")}')"
            class="bg-white border-2 border-black px-3 py-1 text-[10px] font-bold rounded-lg shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all flex items-center gap-1">${n}</button>
    <button onclick="deleteSavedMap('${n.replace(/'/g, "\\'")}')"
            class="text-red-500 text-xs font-bold hover:text-red-700 transition-colors"><span class="material-icons-outlined text-sm">close</span></button>
  `).join('');
}

function clearMindMap() {
  if (mmNodes.length === 0) return;
  if (!confirm('Clear all nodes and connections?')) return;
  mmNodes = [];
  mmConnections = [];
  mmSelected = null;
  mmNodeId = 0;
  mmMode = 'select';
  mmConnectFrom = null;
  renderMindMapCanvas();
  renderMindMapToolbar();
}

// Override the old renderMindMap from app.js
async function renderMindMap() {
  renderMindMapToolbar();
  renderMindMapCanvas();
  await renderSavedMaps();
}
