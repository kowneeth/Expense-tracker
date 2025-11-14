/* Expense Tracker — vanilla JS
   Features: localStorage, filters, inline edit, accessible toasts, keyboard shortcuts, custom Canvas bar chart.
*/
(() => {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  
    // Elements
    const form = $('#expenseForm');
    const dateEl = $('#date');
    const categoryEl = $('#category');
    const amountEl = $('#amount');
    const noteEl = $('#note');
  
    const filterMonth = $('#filterMonth');
    const filterCategory = $('#filterCategory');
    const filterSearch = $('#filterSearch');
  
    const tbody = $('#tbody');
    const statTotal = $('#statTotal');
    const statCount = $('#statCount');
    const statAvg = $('#statAvg');
    const chartCanvas = $('#chart');
    const themeToggle = $('#themeToggle');
    const exportBtn = $('#exportBtn');
    const importInput = $('#importInput');
    const clearFiltersBtn = $('#clearFilters');
    const toast = $('#toast');
  
    const STORAGE_KEY = 'expense-tracker.v1';
    const THEME_KEY = 'expense-tracker.theme';
    let data = load();
    let selectionId = null;
    let chart;
  
    // Init
    setDefaultDate();
    initTheme();
    attachEvents();
    render();
  
    // --- Utilities ---
    function load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : demoSeed();
      } catch {
        return demoSeed();
      }
    }
    function save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    function uid() {
      return Math.random().toString(36).slice(2, 10);
    }
    function setDefaultDate() {
      const today = new Date().toISOString().slice(0,10);
      dateEl.value = today;
      filterMonth.value = today.slice(0,7);
    }
    function rupees(n) {
      return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function showToast(msg) {
      toast.textContent = msg;
      toast.hidden = false;
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => (toast.hidden = true), 2200);
    }
  
    // --- Theme ---
    function initTheme() {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
      } else {
        document.documentElement.setAttribute('data-theme', 'system');
        // system is handled by prefers-color-scheme via CSS defaults
      }
    }
    function toggleTheme() {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem(THEME_KEY, next);
      showToast(`Theme: ${next}`);
    }
  
    // --- Event bindings ---
    function attachEvents() {
      form.addEventListener('submit', onAdd);
      filterMonth.addEventListener('input', render);
      filterCategory.addEventListener('input', render);
      filterSearch.addEventListener('input', render);
      clearFiltersBtn.addEventListener('click', () => {
        setDefaultDate();
        filterCategory.value = 'All';
        filterSearch.value = '';
        render();
      });
  
      themeToggle.addEventListener('click', toggleTheme);
  
      exportBtn.addEventListener('click', onExport);
      importInput.addEventListener('change', onImport);
  
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 't') toggleTheme();
        if (e.key === '/' && !isTypingInInput(e)) {
          e.preventDefault(); filterSearch.focus();
        }
        if (e.key.toLowerCase() === 'n' && !isTypingInInput(e)) {
          e.preventDefault(); amountEl.focus();
        }
        if (e.key === 'Delete' && selectionId) {
          onDelete(selectionId);
        }
      });
    }
    function isTypingInInput(e) {
      const tag = e.target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
    }
  
    // --- CRUD ---
    function onAdd(e) {
      e.preventDefault();
      const date = dateEl.value;
      const category = categoryEl.value;
      const amount = parseFloat(amountEl.value);
      const note = noteEl.value.trim();
  
      // Validation
      if (!date || !category || !(amount > 0)) {
        showToast('Please provide date, category, and a positive amount.');
        return;
      }
      const item = { id: uid(), date, category, amount: Number(amount.toFixed(2)), note };
      data.push(item);
      save();
  
      form.reset();
      setDefaultDate();
      render();
      showToast('Added ✓');
    }
  
    function onDelete(id) {
      const idx = data.findIndex(x => x.id === id);
      if (idx >= 0) {
        const [removed] = data.splice(idx, 1);
        save(); render();
        showToast(`Deleted ${removed.category} (${rupees(removed.amount)})`);
      }
    }
  
    function onEdit(id) {
      // Turn row into editable cells
      const tr = tbody.querySelector(`tr[data-id="${id}"]`);
      if (!tr) return;
      const item = data.find(x => x.id === id);
      tr.classList.add('editing');
      tr.innerHTML = `
        <td><input type="date" value="${item.date}"></td>
        <td>
          <select>
            ${['Food','Transport','Shopping','Bills','Entertainment','Healthcare','Education','Other'].map(c => `<option ${c===item.category?'selected':''}>${c}</option>`).join('')}
          </select>
        </td>
        <td class="num"><input type="number" step="0.01" min="0" value="${item.amount}"></td>
        <td><input type="text" maxlength="80" value="${escapeHtml(item.note||'')}"></td>
        <td class="actions">
          <div class="row-actions">
            <button class="btn primary save">Save</button>
            <button class="btn cancel">Cancel</button>
          </div>
        </td>
      `;
      tr.querySelector('.save').addEventListener('click', () => {
        const [d, c, a, n] = $$('input, select', tr);
        const amount = parseFloat(a.value);
        if (!d.value || !c.value || !(amount > 0)) { showToast('Invalid values.'); return; }
        item.date = d.value;
        item.category = c.value;
        item.amount = Number(amount.toFixed(2));
        item.note = n.value.trim();
        save(); render(); showToast('Saved ✓');
      });
      tr.querySelector('.cancel').addEventListener('click', render);
    }
  
    // --- Rendering ---
    function render() {
      const rows = filtered();
      // Table
      tbody.innerHTML = '';
      rows.forEach(item => {
        const tr = document.createElement('tr');
        tr.dataset.id = item.id;
        tr.tabIndex = 0;
        tr.innerHTML = `
          <td>${item.date}</td>
          <td><span class="badge">${item.category}</span></td>
          <td class="num">${rupees(item.amount)}</td>
          <td>${escapeHtml(item.note || '')}</td>
          <td class="actions">
            <div class="row-actions">
              <button class="btn subtle edit">Edit</button>
              <button class="btn subtle del">Delete</button>
            </div>
          </td>
        `;
        tr.addEventListener('focusin', () => (selectionId = item.id));
        tr.addEventListener('dblclick', () => onEdit(item.id));
        tr.querySelector('.edit').addEventListener('click', () => onEdit(item.id));
        tr.querySelector('.del').addEventListener('click', () => onDelete(item.id));
        tbody.appendChild(tr);
      });
  
      // Stats
      const total = rows.reduce((s, x) => s + x.amount, 0);
      statTotal.textContent = rupees(total);
      statCount.textContent = rows.length.toString();
      statAvg.textContent = rows.length ? rupees(total / rows.length) : '₹0.00';
  
      // Chart
      drawChart(rows);
    }
  
    function filtered() {
      const month = filterMonth.value; // "YYYY-MM"
      const cat = filterCategory.value;
      const q = filterSearch.value.trim().toLowerCase();
      return data.filter(x => {
        const okMonth = month ? x.date.startsWith(month) : true;
        const okCat = cat && cat !== 'All' ? x.category === cat : true;
        const okQ = q ? (x.note || '').toLowerCase().includes(q) : true;
        return okMonth && okCat && okQ;
      }).sort((a,b) => b.date.localeCompare(a.date));
    }
  
    // --- Chart (basic bar chart with Canvas 2D) ---
    function drawChart(rows) {
      const ctx = chartCanvas.getContext('2d');
      const w = chartCanvas.width = chartCanvas.clientWidth;
      const h = chartCanvas.height; // fixed from HTML
      ctx.clearRect(0,0,w,h);
  
      const cats = ['Food','Transport','Shopping','Bills','Entertainment','Healthcare','Education','Other'];
      const sums = cats.map(c => rows.filter(r => r.category === c).reduce((s,x)=>s+x.amount,0));
  
      const max = Math.max(1, ...sums);
      const pad = 28;
      const axis = 24;
      const innerW = w - pad*2 - axis;
      const innerH = h - pad*2;
      const barW = innerW / sums.length * 0.72;
      const gap = innerW / sums.length * 0.28;
  
      // Axes
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted');
      ctx.font = '12px system-ui';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      // y labels (0, 50%, 100%)
      [0, 0.5, 1].forEach((t,i) => {
        const y = pad + innerH - innerH * t;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(pad + axis, y, innerW, 1);
        ctx.globalAlpha = 1;
        const val = (max * t);
        ctx.fillText(rupees(val), pad + axis - 6, y);
      });
  
      // Bars
      const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#7c5cff';
      sums.forEach((v, i) => {
        const x = pad + axis + i*(barW+gap) + gap/2;
        const hBar = v === 0 ? 2 : Math.max(2, (v / max) * innerH);
        const y = pad + innerH - hBar;
  
        // bar
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.moveTo(x, y + hBar);
        ctx.lineTo(x, y + 8);
        ctx.quadraticCurveTo(x, y, x+8, y);
        ctx.lineTo(x + barW - 8, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + 8);
        ctx.lineTo(x + barW, y + hBar);
        ctx.closePath();
        ctx.fill();
  
        // label
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
        ctx.globalAlpha = 0.9;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(cats[i], x + barW/2, pad + innerH + 6);
        ctx.globalAlpha = 1;
  
        // value
        if (v > 0) {
          ctx.textBaseline = 'bottom';
          ctx.font = '11px system-ui';
          ctx.fillText(rupees(v), x + barW/2, y - 2);
        }
      });
    }
  
    // --- Import/Export ---
    function onExport() {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const dt = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.download = `expenses-${dt}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Exported ✓');
    }
  
    function onImport(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!Array.isArray(parsed)) throw new Error('Invalid format');
          // basic shape check
          parsed.forEach(x => {
            if (!x.id) x.id = uid();
            if (!x.date || !x.category || typeof x.amount !== 'number') throw new Error('Invalid item');
          });
          data = parsed;
          save(); render();
          showToast('Imported ✓');
        } catch (err) {
          console.error(err);
          showToast('Import failed. Ensure valid JSON array.');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    }
  
    // --- Helpers ---
    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    }
  
    function demoSeed() {
      // Seed with some example rows for first run
      const today = new Date();
      const pad = n => String(n).padStart(2,'0');
      const ym = (y,m,d) => `${y}-${pad(m)}-${pad(d)}`;
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const seed = [
        { date: ym(y, m, 3),  category: 'Food', amount: 180.50, note: 'Breakfast with friends' },
        { date: ym(y, m, 5),  category: 'Transport', amount: 60, note: 'Metro card top-up' },
        { date: ym(y, m, 7),  category: 'Bills', amount: 899.99, note: 'Mobile recharge + data' },
        { date: ym(y, m, 8),  category: 'Education', amount: 1299, note: 'Course material' },
        { date: ym(y, m, 10), category: 'Shopping', amount: 650, note: 'T-shirt' },
        { date: ym(y, m, 10), category: 'Food', amount: 240, note: 'Lunch' },
        { date: ym(y, m, 12), category: 'Entertainment', amount: 320, note: 'Movie night' },
        { date: ym(y, m, 14), category: 'Healthcare', amount: 150, note: 'Medicines' },
        { date: ym(y, m, 15), category: 'Other', amount: 99, note: 'Misc purchase' },
      ];
      return seed.map(x => ({ id: uid(), ...x }));
    }
  })();
  