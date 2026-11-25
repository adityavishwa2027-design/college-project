(() => {
  let API = (localStorage.getItem('campusApiUrl') || window.CAMPUS_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  let userId = localStorage.getItem('campusUserId') || '';
  let events = [];
  let registrations = [];
  let activeFilter = 'all';
  let view = 'all';
  const $ = (s) => document.querySelector(s);
  const grid = $('#eventsGrid');
  const notice = $('#notice');
  const dialog = $('#eventDialog');
  const settingsDialog = $('#settingsDialog');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (obj, keys, fallback = '') => {
    for (const key of keys) if (obj?.[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    return fallback;
  };
  const titleOf = (e) => pick(e, ['title','name','event_name'], 'Campus event');
  const descOf = (e) => pick(e, ['description','details','summary'], 'Join your campus community for this upcoming event.');
  const dateOf = (e) => pick(e, ['start_date','date','event_date','starts_at','datetime'], 'Date to be announced');
  const venueOf = (e) => pick(e, ['location','venue','place'], 'Campus location');
  const categoryOf = (e) => pick(e, ['category','type','event_type'], 'Campus event');
  const eventId = (e) => String(e?.id ?? '');
  const dateText = (value) => {
    if (!value || value === 'Date to be announced') return value;
    const d = new Date(value);
    return Number.isNaN(+d) ? String(value) : d.toLocaleDateString(undefined, {month:'short',day:'numeric',year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined});
  };
  const typeClass = (e) => {
    const text = categoryOf(e).toLowerCase();
    if (/workshop|hack|class|training/.test(text)) return ['workshop','lightbulb'];
    if (/social|community|fest|club|meet/.test(text)) return ['social','groups'];
    if (/talk|panel|lecture|seminar|speaker/.test(text)) return ['talk','forum'];
    return ['default','auto_awesome'];
  };
  const registeredIds = () => new Set(registrations.map(r => String(r.event_id ?? r.events?.id ?? '')));
  function showNotice(message, kind = 'error') { notice.textContent = message; notice.className = `notice ${kind}`; notice.hidden = false; }
  function clearNotice() { notice.hidden = true; notice.textContent = ''; }
  function errorMessage(data, fallback) { return data?.error || fallback; }
  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {headers:{'Content-Type':'application/json', ...(options.headers || {})}, ...options});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorMessage(data, `Request failed (${response.status})`));
    return data;
  }
  function card(e) {
    const [kind, icon] = typeClass(e);
    const id = eventId(e);
    const isRegistered = registeredIds().has(id);
    const capacity = pick(e, ['capacity','seats'], null);
    return `<article class="event-card"><div class="event-cover cover-${kind}"><span class="material-symbols-outlined cover-icon">${icon}</span><span class="category-tag">${esc(categoryOf(e))}</span></div><div class="event-body"><div class="event-meta"><span><span class="material-symbols-outlined">calendar_month</span>${esc(dateText(dateOf(e)))}</span><span><span class="material-symbols-outlined">location_on</span>${esc(venueOf(e))}</span></div><h3 class="event-title">${esc(titleOf(e))}</h3><p class="event-description">${esc(descOf(e))}</p><div class="event-card-bottom"><span class="capacity"><span class="material-symbols-outlined">${capacity === null ? 'event' : 'groups'}</span>${capacity === null ? 'Open to campus' : `${esc(capacity)} places`}</span><button class="small-button ${isRegistered ? 'secondary' : ''}" data-event="${esc(id)}" data-action="details">${isRegistered ? 'View pass' : 'Explore'} <span class="material-symbols-outlined">arrow_forward</span></button></div></div></article>`;
  }
  function render() {
    const query = $('#search').value.trim().toLowerCase();
    const regs = registeredIds();
    let shown = events.filter(e => {
      const text = `${titleOf(e)} ${descOf(e)} ${venueOf(e)} ${categoryOf(e)}`.toLowerCase();
      if (query && !text.includes(query)) return false;
      if ((view === 'registered' || $('.nav-link.active')?.dataset.page === 'registrations') && !regs.has(eventId(e))) return false;
      if (activeFilter !== 'all') {
        const c = categoryOf(e).toLowerCase();
        if (activeFilter === 'workshop' && !/workshop|hack|class|training/.test(c)) return false;
        if (activeFilter === 'social' && !/social|community|fest|club|meet/.test(c)) return false;
        if (activeFilter === 'talk' && !/talk|panel|lecture|seminar|speaker/.test(c)) return false;
      }
      return true;
    });
    $('#eventCount').textContent = events.length;
    $('#regCount').textContent = registrations.length;
    $('#resultsLabel').textContent = `${shown.length} ${shown.length === 1 ? 'event' : 'events'}`;
    grid.innerHTML = shown.length ? shown.map(card).join('') : `<div class="empty"><span class="material-symbols-outlined">${events.length ? 'search_off' : 'event_busy'}</span><b>${events.length ? 'No events match this view' : 'No events are listed yet'}</b><span>${events.length ? 'Try another filter or search.' : 'Check back soon for campus updates.'}</span></div>`;
  }
  async function loadEvents() {
    grid.innerHTML = '<div class="loading"><span class="loader"></span>Finding what’s happening…</div>';
    try { events = await api('/api/events'); if (!Array.isArray(events)) throw new Error('The events endpoint did not return a list.'); $('#connectionLabel').textContent = 'Campus connected'; clearNotice(); }
    catch (e) { events = []; $('#connectionLabel').textContent = 'Connection unavailable'; showNotice(`${e.message}. Check the API URL and that your Flask server is running.`); }
    render();
  }
  async function loadRegistrations() {
    if (!userId) { registrations = []; render(); return; }
    try { registrations = await api(`/api/me/registrations?user_id=${encodeURIComponent(userId)}`); if (!Array.isArray(registrations)) registrations = []; }
    catch (e) { registrations = []; showNotice(e.message, 'error'); }
    render();
  }
  function openDetails(e) {
    const [kind, icon] = typeClass(e);
    const id = eventId(e);
    const isRegistered = registeredIds().has(id);
    const capacity = pick(e, ['capacity','seats'], 'Not specified');
    $('#dialogContent').innerHTML = `<div class="dialog-cover cover-${kind}"><span class="category-tag">${esc(categoryOf(e))}</span><span class="material-symbols-outlined cover-icon">${icon}</span></div><div class="dialog-inner"><p class="eyebrow">CAMPUS EVENT</p><h2>${esc(titleOf(e))}</h2><p>${esc(descOf(e))}</p><div class="detail-list"><div class="detail-item"><small>Date</small><b>${esc(dateText(dateOf(e)))}</b></div><div class="detail-item"><small>Location</small><b>${esc(venueOf(e))}</b></div><div class="detail-item"><small>Category</small><b>${esc(categoryOf(e))}</b></div><div class="detail-item"><small>Capacity</small><b>${esc(capacity)}</b></div></div>${isRegistered ? '<button class="primary-button" disabled>Already registered <span class="material-symbols-outlined">check_circle</span></button>' : `<button class="primary-button" data-action="register" data-event="${esc(id)}">Register for this event <span class="material-symbols-outlined">arrow_forward</span></button>`}</div>`;
    dialog.showModal();
  }
  async function register(id) {
    if (!userId) { dialog.close(); openSettings(); showNotice('Add your backend user ID before registering.', 'error'); return; }
    const button = dialog.querySelector('[data-action="register"]');
    if (button) { button.disabled = true; button.textContent = 'Registering…'; }
    try {
      await api('/api/registrations', {method:'POST', body:JSON.stringify({user_id:userId,event_id:id})});
      registrations = await api(`/api/me/registrations?user_id=${encodeURIComponent(userId)}`);
      showNotice('You’re registered. Your event now appears in My registrations.', 'success');
      openDetails(events.find(e => eventId(e) === id)); render();
    } catch (e) { if (button) { button.disabled = false; button.innerHTML = 'Register for this event <span class="material-symbols-outlined">arrow_forward</span>'; } showNotice(e.message); }
  }
  function openSettings() { $('#apiUrl').value = API; $('#userId').value = userId; settingsDialog.showModal(); }
  $('#settingsButton').addEventListener('click', openSettings);
  $('#footerSettings').addEventListener('click', openSettings);
  $('#settingsForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const url = $('#apiUrl').value.trim().replace(/\/$/, '');
    API = url || window.CAMPUS_API_URL || 'http://localhost:5000';
    userId = $('#userId').value.trim();
    if (url) localStorage.setItem('campusApiUrl', url); else localStorage.removeItem('campusApiUrl');
    localStorage.setItem('campusUserId', userId);
    settingsDialog.close();
    await loadEvents(); await loadRegistrations();
  });
  $('#search').addEventListener('input', render);
  $('#exploreButton').addEventListener('click', () => $('#eventSection').scrollIntoView({behavior:'smooth'}));
  $('#filters').addEventListener('click', e => { const btn = e.target.closest('[data-filter]'); if (!btn) return; activeFilter = btn.dataset.filter; $('#filters').querySelectorAll('.filter-pill').forEach(b => b.classList.toggle('active', b === btn)); render(); });
  document.querySelectorAll('.view-button').forEach(btn => btn.addEventListener('click', () => { view = btn.dataset.view; document.querySelectorAll('.view-button').forEach(b => b.classList.toggle('active', b === btn)); document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === (view === 'registered' ? 'registrations' : 'discover'))); $('#pageTitle').textContent = view === 'registered' ? 'Your registrations' : 'Upcoming events'; render(); }));
  document.querySelectorAll('.nav-link').forEach(btn => btn.addEventListener('click', () => { const page = btn.dataset.page; view = page === 'registrations' ? 'registered' : 'all'; document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b === btn)); document.querySelectorAll('.view-button').forEach(b => b.classList.toggle('active', b.dataset.view === view)); $('#pageTitle').textContent = page === 'registrations' ? 'Your registrations' : 'Upcoming events'; render(); }));
  grid.addEventListener('click', e => { const btn = e.target.closest('[data-action="details"]'); if (!btn) return; const item = events.find(event => eventId(event) === btn.dataset.event); if (item) openDetails(item); });
  dialog.addEventListener('click', e => { if (e.target.matches('[data-close]')) dialog.close(); const btn = e.target.closest('[data-action="register"]'); if (btn) register(btn.dataset.event); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  if (!userId) setTimeout(openSettings, 450);
  loadEvents().then(loadRegistrations);
})();
