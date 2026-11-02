(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const categories = ['all', 'logos', 'icons', 'images', 'fonts', 'videos', 'documents', 'templates', 'qr', 'ai'];
  const categoryNames = { all: 'All resources', logos: 'Logos', icons: 'Icons', images: 'Images', fonts: 'Fonts', videos: 'Video', documents: 'Documents', templates: 'Templates', qr: 'QR codes', ai: 'AI toolkit' };
  const pageSize = 24;
  const state = { resources: [], bundles: [], category: 'all', format: 'all', theme: 'all', query: '', sort: 'default', limit: pageSize, layout: 'grid', selected: new Set(), busy: false };
  const resourcesElement = $('#resources');
  const statusElement = $('#results-status');
  const dialog = $('#preview-dialog');
  let announceTimer;
  let searchTimer;
  let previewTrigger;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function fileFormat(file) { return String(file.format || file.path.split('.').at(-1) || '').toLowerCase(); }
  function safePath(path) {
    return typeof path === 'string' && path.startsWith('assets/') && !path.includes('..') && !/[?#]/.test(path);
  }
  function url(path) { return new URL(path, document.baseURI).href; }
  function bytesLabel(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  function announce(message) {
    $('#library-announcement').textContent = message;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { $('#library-announcement').textContent = ''; }, 7000);
  }
  function isDark(resource) { return resource.dark_surface === true || /(?:dark|mono-white)/.test(resource.theme || ''); }
  function isImage(path) { return /\.(?:svg|png|jpe?g|gif|webp|avif)$/i.test(path || ''); }
  function preferredFile(resource) {
    const files = resource.files;
    if (state.format !== 'all') return files.find(file => fileFormat(file) === state.format) || files[0];
    return files.find(file => fileFormat(file) === (resource.category === 'templates' ? 'pdf' : 'svg')) || files[0];
  }
  function formats(resource) { return [...new Set(resource.files.map(fileFormat))]; }
  function readQuery() {
    const params = new URL(location.href).searchParams;
    state.category = categories.includes(params.get('category')) ? params.get('category') : 'all';
    state.query = params.get('q') || '';
    state.format = params.get('format') || 'all';
    state.theme = ['light', 'dark', 'mono'].includes(params.get('surface')) ? params.get('surface') : 'all';
  }
  function updateQuery() {
    const current = new URL(location.href);
    for (const [key, value] of Object.entries({ category: state.category, q: state.query.trim(), format: state.format, surface: state.theme })) {
      if (value && value !== 'all') current.searchParams.set(key, value);
      else current.searchParams.delete(key);
    }
    history.replaceState(null, '', current);
  }
  function syncControls() {
    $('#asset-search').value = state.query;
    $('#format-filter').value = state.format;
    $('#theme-filter').value = state.theme;
    $('#sort-order').value = state.sort;
    document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === state.category)));
    $('#view-grid').setAttribute('aria-pressed', String(state.layout === 'grid'));
    $('#view-list').setAttribute('aria-pressed', String(state.layout === 'list'));
  }
  function matchingResources() {
    const words = state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = state.resources.filter(resource => {
      if (state.category !== 'all' && resource.category !== state.category) return false;
      if (state.format !== 'all' && !resource.files.some(file => fileFormat(file) === state.format)) return false;
      if (state.theme === 'dark' && !isDark(resource)) return false;
      if (state.theme === 'light' && (isDark(resource) || /mono/.test(resource.theme || '') || !resource.theme)) return false;
      if (state.theme === 'mono' && !/mono/.test(resource.theme || '')) return false;
      const text = [resource.name, resource.description, resource.category, resource.theme, resource.layout, ...(resource.tags || [])].filter(Boolean).join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
    if (state.sort === 'name') matches.sort((a, b) => a.name.localeCompare(b.name));
    if (state.sort === 'files') matches.sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name));
    return matches;
  }
  function imagePreview(resource) {
    const image = node('img');
    image.src = resource.preview;
    image.alt = resource.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.replaceWith(documentPreview(resource));
    }, { once: true });
    return image;
  }
  function documentPreview(resource) {
    const box = node('span', 'document-preview');
    box.append(node('span', 'document-format', formats(resource).slice(0, 3).map(value => value.toUpperCase()).join(' / ')), node('strong', '', resource.name));
    return box;
  }
  function createCard(resource) {
    const card = node('article', `asset-card${state.selected.has(resource.id) ? ' is-selected' : ''}`);
    card.dataset.resourceId = resource.id;
    const top = node('div', 'card-top');
    const checkbox = node('input', 'select-asset');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selected.has(resource.id);
    checkbox.setAttribute('aria-label', `Select ${resource.name}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selected.add(resource.id);
      else state.selected.delete(resource.id);
      card.classList.toggle('is-selected', checkbox.checked);
      updateSelection();
    });
    top.append(node('span', '', categoryNames[resource.category] || resource.category), checkbox);
    const preview = node('button', `preview-button${isDark(resource) ? ' dark' : ''}`);
    preview.type = 'button';
    preview.setAttribute('aria-label', `Preview ${resource.name}`);
    preview.addEventListener('click', () => showPreview(resource, preview));
    if (resource.category === 'fonts') {
      const sample = node('span', 'font-preview', 'Aa');
      sample.append(node('small', '', 'IDEAS. ENGINEERED.'));
      preview.append(sample);
    } else if (resource.preview && isImage(resource.preview)) {
      preview.append(imagePreview(resource));
    } else {
      preview.append(documentPreview(resource));
    }
    if (resource.category === 'videos') preview.append(node('span', 'play-symbol', '▶'));
    preview.append(node('span', 'preview-label', 'Preview ↗'));
    const content = node('div', 'card-content');
    content.append(node('h3', '', resource.name), node('p', 'card-description', resource.description || 'AndHub brand resource.'));
    const meta = node('div', 'card-meta');
    const formatLabel = node('span', 'card-formats', formats(resource).slice(0, 4).join(' · '));
    formatLabel.title = formats(resource).join(', ').toUpperCase();
    meta.append(formatLabel, node('span', '', `${resource.files.length} ${resource.files.length === 1 ? 'file' : 'files'}`));
    const actions = node('div', 'card-actions');
    const view = node('button', '', 'View files');
    view.type = 'button';
    view.setAttribute('aria-label', `View files for ${resource.name}`);
    view.addEventListener('click', () => showPreview(resource, view));
    const primary = preferredFile(resource);
    const download = node('a', '', fileFormat(primary).toUpperCase());
    download.append(node('span', '', ' ↓'));
    download.href = primary.path;
    download.download = '';
    download.setAttribute('aria-label', `Download ${resource.name} ${fileFormat(primary).toUpperCase()}`);
    actions.append(view, download);
    content.append(meta, actions);
    card.append(top, preview, content);
    return card;
  }
  function render({ keepLimit = false } = {}) {
    if (!keepLimit) state.limit = pageSize;
    const matches = matchingResources();
    const visible = matches.slice(0, state.limit);
    resourcesElement.replaceChildren(...visible.map(createCard));
    resourcesElement.classList.toggle('list-view', state.layout === 'list');
    resourcesElement.setAttribute('aria-busy', 'false');
    $('#empty-state').hidden = matches.length !== 0;
    $('#error-state').hidden = true;
    $('#load-more').hidden = visible.length >= matches.length;
    $('#load-more').textContent = `Show more resources (${matches.length - visible.length} remaining)`;
    const totalFiles = matches.reduce((sum, resource) => sum + resource.files.length, 0);
    statusElement.textContent = `${matches.length} ${matches.length === 1 ? 'asset family' : 'asset families'} · ${totalFiles} files${visible.length < matches.length ? ` · showing ${visible.length}` : ''}`;
    const legacySearch=state.query.trim().toLowerCase()==='legacy';
    const bundle = state.bundles.find(item => item.category === (legacySearch ? 'legacy' : state.category));
    const bundleLink = $('#category-download');
    bundleLink.hidden = !bundle;
    if (bundle) {
      bundleLink.href = bundle.path;
      bundleLink.textContent = `${legacySearch ? 'Legacy archive' : state.category === 'all' ? 'All resources' : categoryNames[state.category]} ZIP ↓${bundle.bytes ? ` / ${bytesLabel(bundle.bytes)}` : ''}`;
      bundleLink.setAttribute('aria-label', `Download ${legacySearch ? 'the legacy archive' : 'all '+(state.category === 'all' ? 'resources' : categoryNames[state.category])} as ZIP`);
    }
    syncControls();
    updateSelection();
    updateQuery();
  }
  function updateSelection() {
    $('#selection-bar').hidden = state.selected.size === 0;
    $('#selected-count').textContent = `${state.selected.size} ${state.selected.size === 1 ? 'asset family' : 'asset families'} selected`;
    $('#download-selected').disabled = state.busy;
  }
  function setCategory(category) {
    state.category = category;
    render();
  }
  function resetFilters() {
    state.query = '';
    state.category = 'all';
    state.format = 'all';
    state.theme = 'all';
    state.sort = 'default';
    render();
  }
  function showPreview(resource, trigger) {
    previewTrigger = trigger;
    $('#preview-title').textContent = resource.name;
    $('#preview-category').textContent = `ANDHUB / ${categoryNames[resource.category] || resource.category}`;
    $('#preview-description').textContent = resource.description || '';
    $('#preview-tags').replaceChildren(...(resource.tags || []).map(tag => node('span', '', tag)));
    const media = $('#preview-media');
    media.replaceChildren();
    media.classList.toggle('dark', isDark(resource));
    if (resource.category === 'videos') {
      const file = resource.files.find(item => /^(?:mp4|webm)$/.test(fileFormat(item)));
      if (file) {
        const video = node('video');
        video.src = file.path;
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('aria-label', resource.name);
        if (isImage(resource.preview)) video.poster = resource.preview;
        media.append(video);
      } else media.append(documentPreview(resource));
    } else if (resource.category === 'fonts') {
      const specimen = node('div');
      const editable = node('div', 'font-demo', 'Ideas.\nEngineered.');
      editable.contentEditable = 'true';
      editable.setAttribute('role', 'textbox');
      editable.setAttribute('aria-label', 'Type to preview the brand font');
      editable.setAttribute('aria-multiline', 'true');
      specimen.append(editable, node('span', 'font-preview-caption', 'Type above to try the font. License included in the downloads.'));
      media.append(specimen);
    } else if (isImage(resource.preview)) {
      media.append(imagePreview(resource));
    } else {
      const pdf = resource.files.find(item => fileFormat(item) === 'pdf');
      if (pdf) {
        const frame = node('iframe');
        frame.src = pdf.path;
        frame.title = `${resource.name} PDF preview`;
        media.append(frame);
      } else media.append(documentPreview(resource));
    }
    const downloads = resource.files.map(file => {
      const link = node('a', 'file-download');
      link.href = file.path;
      link.download = '';
      const detail = node('span');
      detail.append(node('strong', '', file.label || file.path.split('/').at(-1)));
      const dimensions = file.width && file.height ? `${file.width} × ${file.height} px` : '';
      detail.append(node('small', '', [dimensions, bytesLabel(file.bytes)].filter(Boolean).join(' · ')));
      link.append(node('span', 'file-extension', fileFormat(file)), detail, node('span', '', '↓'));
      link.setAttribute('aria-label', `Download ${file.label || file.path.split('/').at(-1)}`);
      return link;
    });
    $('#preview-files').replaceChildren(...downloads);
    dialog.showModal();
    $('#close-preview').focus();
  }
  function closePreview() {
    dialog.close();
  }
  dialog.addEventListener('close', () => {
    dialog.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    dialog.querySelectorAll('iframe').forEach(frame => frame.removeAttribute('src'));
    previewTrigger?.focus();
  });
  $('#close-preview').addEventListener('click', closePreview);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePreview();
  });

  // ZIP32 "store" keeps the original bytes; no server or third-party upload is involved.
  const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const value of bytes) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zipHeader(size) {
    const bytes = new Uint8Array(size);
    return { bytes, view: new DataView(bytes.buffer) };
  }
  async function downloadSelected() {
    if (state.busy || state.selected.size === 0) return;
    const files = [...new Map(state.resources.filter(resource => state.selected.has(resource.id)).flatMap(resource => resource.files).map(file => [file.path, file])).values()];
    const totalBytes = files.reduce((sum, file) => sum + (file.bytes || 0), 0);
    if (files.length > 250 || totalBytes > 150 * 1024 * 1024) {
      announce('This selection is large. Use the category ZIP downloads, or select fewer than 250 files / 150 MB.');
      return;
    }
    state.busy = true;
    updateSelection();
    const button = $('#download-selected');
    const originalText = button.textContent;
    button.textContent = 'Preparing ZIP…';
    try {
      const chunks = [];
      const central = [];
      const encoder = new TextEncoder();
      let offset = 0;
      let processedBytes = 0;
      for (let index = 0; index < files.length; index++) {
        button.textContent = `Preparing ${index + 1} / ${files.length}…`;
        const response = await fetch(url(files[index].path));
        if (!response.ok) throw new Error(`Could not download ${files[index].path.split('/').at(-1)}.`);
        const data = new Uint8Array(await response.arrayBuffer());
        processedBytes += data.byteLength;
        if (processedBytes > 150 * 1024 * 1024) throw new Error('Selection exceeds 150 MB. Please use a category ZIP download.');
        const name = encoder.encode(files[index].path.replace(/^assets\//, ''));
        const crc = crc32(data);
        const local = zipHeader(30);
        local.view.setUint32(0, 0x04034b50, true);
        local.view.setUint16(4, 20, true);
        local.view.setUint16(6, 0x800, true);
        local.view.setUint16(12, 33, true);
        local.view.setUint32(14, crc, true);
        local.view.setUint32(18, data.byteLength, true);
        local.view.setUint32(22, data.byteLength, true);
        local.view.setUint16(26, name.byteLength, true);
        chunks.push(local.bytes, name, data);
        const directory = zipHeader(46);
        directory.view.setUint32(0, 0x02014b50, true);
        directory.view.setUint16(4, 20, true);
        directory.view.setUint16(6, 20, true);
        directory.view.setUint16(8, 0x800, true);
        directory.view.setUint16(14, 33, true);
        directory.view.setUint32(16, crc, true);
        directory.view.setUint32(20, data.byteLength, true);
        directory.view.setUint32(24, data.byteLength, true);
        directory.view.setUint16(28, name.byteLength, true);
        directory.view.setUint32(42, offset, true);
        central.push(directory.bytes, name);
        offset += 30 + name.byteLength + data.byteLength;
      }
      const centralSize = central.reduce((sum, bytes) => sum + bytes.byteLength, 0);
      const end = zipHeader(22);
      end.view.setUint32(0, 0x06054b50, true);
      end.view.setUint16(8, files.length, true);
      end.view.setUint16(10, files.length, true);
      end.view.setUint32(12, centralSize, true);
      end.view.setUint32(16, offset, true);
      const blob = new Blob([...chunks, ...central, end.bytes], { type: 'application/zip' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = node('a');
      anchor.href = objectUrl;
      anchor.download = 'andhub-selected-assets.zip';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      announce(`Downloaded ${files.length} original files in a ZIP archive.`);
    } catch (error) {
      announce(error.message || 'The selection could not be downloaded. Please try again.');
    } finally {
      state.busy = false;
      button.textContent = originalText;
      updateSelection();
    }
  }

  async function loadCatalog() {
    resourcesElement.setAttribute('aria-busy', 'true');
    $('#error-state').hidden = true;
    statusElement.textContent = 'Loading the resource collection…';
    try {
      const response = await fetch('assets/catalog.json');
      if (!response.ok) throw new Error(`Resource inventory returned ${response.status}.`);
      const catalog = await response.json();
      if (!Array.isArray(catalog.resources)) throw new Error('The resource inventory has an unexpected format.');
      const resources = catalog.resources.map(resource => ({ ...resource, tags: Array.isArray(resource.tags) ? resource.tags : [], files: Array.isArray(resource.files) ? resource.files : [] }));
      if (resources.some(resource => !resource.id || !resource.name || !resource.files.length || resource.files.some(file => !safePath(file.path)) || (resource.preview && !safePath(resource.preview)))) throw new Error('The inventory contains an invalid resource record.');
      state.resources = resources;
      state.bundles = (catalog.bundles || []).filter(bundle => safePath(bundle.path));
      $('#resource-total').textContent = resources.length;
      document.querySelectorAll('[data-count]').forEach(element => {
        const category = element.dataset.count;
        element.textContent = category === 'all' ? resources.length : resources.filter(resource => resource.category === category).length;
      });
      const choices = [...new Set(resources.flatMap(formats))].sort();
      $('#format-filter').replaceChildren(new Option('All formats', 'all'), ...choices.map(format => new Option(format.toUpperCase(), format)));
      if (state.format !== 'all' && !choices.includes(state.format)) state.format = 'all';
      render();
    } catch (error) {
      resourcesElement.replaceChildren();
      resourcesElement.setAttribute('aria-busy', 'false');
      $('#error-state').hidden = false;
      $('#empty-state').hidden = true;
      $('#load-more').hidden = true;
      statusElement.textContent = 'Resource collection unavailable.';
      $('#error-message').textContent = location.protocol === 'file:' ? 'Open this site through the local preview server (npm run preview) or the published website. The documentation and inventory remain available as direct downloads.' : 'Please try again. You can also browse the documentation and inventory directly.';
      console.error('Asset library:', error);
    }
  }

  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => setCategory(button.dataset.category)));
  $('#asset-search').addEventListener('input', event => {
    state.query = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => render(), 120);
  });
  $('#format-filter').addEventListener('change', event => { state.format = event.target.value; render(); });
  $('#theme-filter').addEventListener('change', event => { state.theme = event.target.value; render(); });
  $('#sort-order').addEventListener('change', event => { state.sort = event.target.value; render(); });
  $('#view-grid').addEventListener('click', () => { state.layout = 'grid'; render({ keepLimit: true }); });
  $('#view-list').addEventListener('click', () => { state.layout = 'list'; render({ keepLimit: true }); });
  $('#reset-filters').addEventListener('click', resetFilters);
  $('#empty-reset').addEventListener('click', resetFilters);
  $('#retry-load').addEventListener('click', loadCatalog);
  $('#load-more').addEventListener('click', () => {
    const oldLimit = state.limit;
    state.limit += pageSize;
    render({ keepLimit: true });
    resourcesElement.children[oldLimit]?.querySelector('button')?.focus();
  });
  $('#clear-selection').addEventListener('click', () => { state.selected.clear(); render({ keepLimit: true }); });
  $('#download-selected').addEventListener('click', downloadSelected);
  $('#show-qr-codes').addEventListener('click', () => {
    state.query = '';
    state.format = 'all';
    state.theme = 'all';
    setCategory('qr');
    $('#library').scrollIntoView({ behavior: 'smooth' });
    $('#browse-title').tabIndex = -1;
    $('#browse-title').focus({ preventScroll: true });
  });
  window.addEventListener('popstate', () => { readQuery(); render(); });
  readQuery();
  loadCatalog();
})();
