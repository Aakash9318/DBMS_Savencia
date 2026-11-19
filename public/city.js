import { escapeHtml, icon, number, periodSelect, roundAed } from './ui.js';

const photographs = {
  night: {
    file: 'dubai-canal-night.webp', width: 3200, height: 2000, focus: .5,
    alt: 'The Burj Khalifa and Dubai Water Canal photographed at night',
    author: 'Leon Macapagal', source: 'https://www.pexels.com/photo/aerial-photography-of-a-modern-city-13398540/'
  },
  day: {
    file: 'dubai-downtown-day.webp', width: 3000, height: 2000, focus: .59,
    alt: 'The Burj Khalifa, Dubai Mall and the Dubai Fountain lake photographed in daylight',
    author: 'Nelemson G', source: 'https://www.pexels.com/photo/aerial-view-of-dubai-skyline-with-burj-khalifa-29470840/'
  }
};

const locations = {
  downtown: [55.27417, 25.19721],
  'business-bay': [55.26837, 25.17946],
  difc: [55.27911, 25.21308],
  d3: [55.29814, 25.18915]
};

function photoAttributes(photo) {
  return `src="/assets/${photo.file}" width="${photo.width}" height="${photo.height}" alt="${photo.alt}"`;
}

export function cityPage(days) {
  return `
    <header class="city-header">
      <div class="city-header-main"><a class="city-brand" href="#overview" aria-label="ADMAP Commerce overview">${icon('logo', 23)}<b>ADMAP</b></a>
      <span class="city-header-divider"></span><span>City dashboard</span></div>
      <a class="city-back" href="#overview">${icon('overview', 16)} Commerce dashboard</a>
    </header>
    <main class="city-stage" id="city-stage">
      <div class="city-viewport" role="group" aria-label="Interactive Dubai city view. Zoom with the controls, or drag to move the camera.">
        <div class="panorama-layer">
          <img ${photoAttributes(photographs.night)} draggable="false" fetchpriority="high">
        </div>
        <div class="city-model" hidden></div>
      </div>
      <div class="city-shade"></div>
      <div class="city-pin-layer" aria-label="District markers" hidden></div>
      <div class="city-title">
        <span class="city-location">${icon('map', 15)} UNITED ARAB EMIRATES</span>
        <h1>Dubai</h1>
        <p>Commerce by delivery district</p>
      </div>
      <div class="city-tools">
        <div class="city-mode" role="group" aria-label="City view">
          <button type="button" data-mode="panorama" aria-pressed="true">${icon('camera', 17)} Panorama</button>
          <button type="button" data-mode="model" aria-pressed="false">${icon('products', 17)} 3D map</button>
        </div>
        ${periodSelect(days)}
      </div>
      <section class="city-info" aria-label="District commerce data">
        <div class="city-data-head">
          <label for="city-district">Delivery district</label>
          <span class="city-district-control"><select id="city-district"><option>Loading districts…</option></select>${icon('chevron', 16)}</span>
        </div>
        <dl class="city-metrics" aria-live="polite">
          <div><dt>Paid orders</dt><dd id="district-orders">—</dd></div>
          <div><dt>Revenue</dt><dd id="district-revenue">—</dd></div>
        </dl>
        <button type="button" class="city-locate" data-locate>${icon('map', 15)} <span>Locate on 3D map</span></button>
      </section>
      <div class="city-bottom-tools">
        <div class="city-control-stack" aria-label="Camera">
          <button type="button" data-camera="in" aria-label="Zoom in" title="Zoom in">${icon('plus')}</button>
          <button type="button" data-camera="out" aria-label="Zoom out" title="Zoom out">${icon('minus')}</button>
          <button type="button" data-camera="reset" aria-label="Reset view" title="Reset view">${icon('reset', 18)}</button>
        </div>
        <div class="city-photo-picker" role="group" aria-label="Photograph">
          <button type="button" data-photo="night" aria-pressed="true">Night</button>
          <button type="button" data-photo="day" aria-pressed="false">Day</button>
        </div>
      </div>
      <p class="city-credit"><a href="${photographs.night.source}" target="_blank" rel="noreferrer">Photo by ${photographs.night.author}</a> · Synthetic sales data</p>
      <p class="city-error" role="status" hidden></p>
    </main>`;
}

export function mountCity(stage) {
  const viewport = stage.querySelector('.city-viewport');
  const panorama = stage.querySelector('.panorama-layer');
  let photoImage = panorama.querySelector('img');
  const photoPicker = stage.querySelector('.city-photo-picker');
  const pinLayer = stage.querySelector('.city-pin-layer');
  const modelHost = stage.querySelector('.city-model');
  const districtSelect = stage.querySelector('#city-district');
  const note = stage.querySelector('.city-credit');
  const error = stage.querySelector('.city-error');
  const modelButton = stage.querySelector('[data-mode="model"]');
  const locateButton = stage.querySelector('[data-locate]');
  const resetButton = stage.querySelector('[data-camera="reset"]');
  const modeButtons = [...stage.querySelectorAll('[data-mode]')];
  const scenic = { x: 0, y: 0, zoom: 1 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 'downtown';
  let districts = [];
  let mode = 'panorama';
  let photo = photographs.night;
  let model, drag, cameraFrame;
  let photoRequest = 0;
  let destroyed = false;
  let loadingModel = false;

  function draw() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (mode === 'panorama') {
      const scale = Math.max(width / photo.width, height / photo.height) * scenic.zoom;
      const imageWidth = photo.width * scale;
      const imageHeight = photo.height * scale;
      const x = Math.max(width - imageWidth, Math.min(0, width / 2 - imageWidth * photo.focus + scenic.x));
      const y = Math.max(height - imageHeight, Math.min(0, (height - imageHeight) * .18 + scenic.y));
      panorama.style.width = `${imageWidth}px`;
      panorama.style.height = `${imageHeight}px`;
      panorama.style.transform = `translate(${x}px,${y}px)`;
      return;
    }

    model.render();
    for (const pin of pinLayer.children) {
      const slug = pin.dataset.district;
      const [left, top] = model.project(locations[slug]);
      pin.hidden = left < 26 || left > width - 26 || top < 25 || top > height - 54;
      pin.style.left = `${left}px`;
      pin.style.top = `${top}px`;
      pin.setAttribute('aria-pressed', String(slug === selected));
      const label = pin.querySelector('.pin-text');
      const half = label.offsetWidth / 2;
      const shift = Math.max(0, half + 10 - left) - Math.max(0, left + half + 10 - width);
      label.style.translate = `${shift}px`;
    }
  }

  function setDistrict(slug) {
    const district = districts.find(row => row.slug === slug);
    if (!district) return;
    selected = slug;
    districtSelect.value = slug;
    stage.querySelector('#district-orders').textContent = number.format(district.orders);
    stage.querySelector('#district-revenue').textContent = roundAed(district.revenue);
    model?.select(locations[slug]);
    draw();
  }

  function showCredit() {
    note.innerHTML = mode === 'model'
      ? '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a><br><a href="https://cloudless.eox.at/" target="_blank" rel="noreferrer">EOxCloudless by EOX IT Services GmbH</a> · Contains modified Copernicus Sentinel data 2024'
      : `<a href="${photo.source}" target="_blank" rel="noreferrer">Photo by ${photo.author}</a> · Synthetic sales data`;
  }

  function stopFlight() {
    cancelAnimationFrame(cameraFrame);
    cameraFrame = undefined;
  }

  function focusDistrict() {
    stopFlight();
    const duration = reducedMotion.matches ? 0 : 850;
    const stepCamera = model.flightTo(locations[selected]);
    const started = performance.now();
    function step(now) {
      const progress = duration ? Math.min(1, (now - started) / duration) : 1;
      stepCamera(1 - (1 - progress) ** 3);
      draw();
      if (progress < 1) cameraFrame = requestAnimationFrame(step);
    }
    cameraFrame = requestAnimationFrame(step);
  }

  async function setMode(next, focus = false) {
    if (loadingModel || mode === next) {
      if (focus && mode === 'model') focusDistrict();
      return;
    }
    if (error.dataset.source === 'model') error.hidden = true;
    if (next === 'model' && !model) {
      try {
        loadingModel = true;
        modelButton.textContent = 'Loading 3D…';
        modelButton.disabled = true;
        locateButton.disabled = true;
        const { buildModel } = await import('./city-model.js');
        const newModel = await buildModel(modelHost);
        if (destroyed) {
          newModel.dispose();
          return;
        }
        model = newModel;
      } catch (failure) {
        error.dataset.source = 'model';
        error.textContent = failure.message || 'The 3D map could not open. The panorama is available.';
        error.hidden = false;
        return;
      } finally {
        loadingModel = false;
        modelButton.innerHTML = `${icon('products', 17)} 3D map`;
        modelButton.disabled = false;
        locateButton.disabled = false;
      }
    }
    stopFlight();
    mode = next;
    const isModel = mode === 'model';
    panorama.hidden = isModel;
    modelHost.hidden = !isModel;
    pinLayer.hidden = !isModel;
    photoPicker.hidden = isModel;
    stage.classList.toggle('model-active', isModel);
    locateButton.querySelector('span').textContent = isModel ? 'Center on district' : 'Locate on 3D map';
    resetButton.title = isModel ? 'Show all districts' : 'Reset view';
    resetButton.setAttribute('aria-label', resetButton.title);
    for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    showCredit();
    if (isModel) model.select(locations[selected]);
    draw();
    if (isModel && focus) focusDistrict();
  }

  async function choosePhoto(key) {
    const request = ++photoRequest;
    const candidate = photographs[key];
    if (candidate === photo) return;
    const nextImage = new Image(candidate.width, candidate.height);
    nextImage.alt = candidate.alt;
    nextImage.draggable = false;
    nextImage.src = `/assets/${candidate.file}`;
    try {
      await nextImage.decode();
    } catch {
      if (destroyed || photoRequest !== request || mode !== 'panorama') return;
      error.dataset.source = 'photo';
      error.textContent = 'This photograph could not load. The current view is still available.';
      error.hidden = false;
      return;
    }
    if (destroyed || photoRequest !== request) return;
    if (error.dataset.source === 'photo') error.hidden = true;
    photoImage.replaceWith(nextImage);
    photoImage = nextImage;
    photo = candidate;
    stage.classList.toggle('daylight', key === 'day');
    for (const button of photoPicker.children) button.setAttribute('aria-pressed', String(button.dataset.photo === key));
    Object.assign(scenic, { x: 0, y: 0, zoom: 1 });
    showCredit();
    draw();
  }

  function camera(action) {
    stopFlight();
    if (mode === 'model') {
      if (action === 'reset') model.overview();
      else model.zoom(action === 'in' ? 1.22 : 1 / 1.22);
    } else if (action === 'reset') {
      Object.assign(scenic, { x: 0, y: 0, zoom: 1 });
    } else {
      const zoom = Math.max(1, Math.min(2.8, scenic.zoom * (action === 'in' ? 1.23 : 1 / 1.23)));
      if (zoom === 1) Object.assign(scenic, { x: 0, y: 0 });
      scenic.zoom = zoom;
    }
    draw();
  }

  stage.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.district) setDistrict(button.dataset.district);
    if (button?.dataset.mode) void setMode(button.dataset.mode);
    if (button?.dataset.photo) void choosePhoto(button.dataset.photo);
    if (button?.dataset.camera) camera(button.dataset.camera);
    if (button === locateButton) void setMode('model', true);
  });
  districtSelect.addEventListener('change', () => {
    setDistrict(districtSelect.value);
    if (mode === 'model') focusDistrict();
  });
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 2) return;
    stopFlight();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: event.shiftKey || event.button === 2 };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (mode === 'model') {
      if (drag.pan) model.pan(dx, dy);
      else model.rotate(dx, dy);
    } else {
      scenic.x = Math.max(-viewport.clientWidth, Math.min(viewport.clientWidth, scenic.x + dx));
      scenic.y = Math.max(-viewport.clientHeight, Math.min(viewport.clientHeight, scenic.y + dy));
    }
    Object.assign(drag, { x: event.clientX, y: event.clientY });
    draw();
  });
  viewport.addEventListener('contextmenu', event => { if (mode === 'model') event.preventDefault(); });
  viewport.addEventListener('lostpointercapture', () => { drag = undefined; });
  viewport.addEventListener('wheel', event => {
    if (matchMedia('(max-width: 720px)').matches) return;
    event.preventDefault();
    camera(event.deltaY < 0 ? 'in' : 'out');
  }, { passive: false });
  const observer = new ResizeObserver(draw);
  observer.observe(viewport);

  return {
    update(data) {
      if (error.dataset.source === 'data') error.hidden = true;
      districts = data.filter(row => Object.hasOwn(locations, row.slug));
      districtSelect.innerHTML = districts.map(row => `<option value="${row.slug}">${escapeHtml(row.name)}</option>`).join('');
      pinLayer.innerHTML = districts.map(row => `<button class="city-pin" type="button" data-district="${row.slug}" aria-pressed="false" aria-label="${escapeHtml(row.name)}">
        <span class="pin-dot"></span><span class="pin-text">${escapeHtml(row.name)}</span>
      </button>`).join('');
      setDistrict(districts.some(row => row.slug === selected) ? selected : districts[0]?.slug);
    },
    showError(message) {
      error.dataset.source = 'data';
      error.textContent = message;
      error.hidden = false;
    },
    dispose() {
      destroyed = true;
      stopFlight();
      observer.disconnect();
      model?.dispose();
    }
  };
}
