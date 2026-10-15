(() => {
  const cityInput = document.getElementById('city');
  const cityTitle = document.querySelector('header h1');
  const suggestionBox = document.createElement('div');
  const cityWrap = document.createElement('div');
  const cityHint = document.createElement('p');
  const appKey = 'travelPlan:v2';
  const lastCityKey = 'travelCity:last';
  let activeCity = {
    name: 'Roma', country: 'Italia', label: 'Roma, Italia', lat: 41.899,
    lon: 12.477, bbox: null, key: 'roma|italia'
  };
  let cityResults = [];
  let searchTimer = null;
  let searchController = null;
  let dataController = null;
  let requestVersion = 0;
  let lastSuggestionRequest = 0;

  const suggestionStyle = document.createElement('style');
  suggestionStyle.textContent = `
    .city-search{position:relative}
    .city-suggestions{position:absolute;z-index:1200;top:calc(100% + 3px);left:0;right:0;background:#fff;border:1px solid #d7e5f5;border-radius:12px;box-shadow:0 12px 28px #234e7d22;max-height:280px;overflow:auto}
    .city-suggestions.hidden{display:none}
    .city-suggestion{display:block;width:100%;padding:11px 13px;text-align:left;border:0;border-bottom:1px solid #eef3fa;background:#fff;color:#173763;cursor:pointer}
    .city-suggestion:hover,.city-suggestion:focus{background:#eff6ff}
    .city-suggestion:last-child{border-bottom:0}
    .city-status{padding:10px 13px}
  `;
  document.head.appendChild(suggestionStyle);

  const el = id => document.getElementById(id);
  const safeJson = value => { try { return JSON.parse(value); } catch { return null; } };
  const cityKey = city => `${city.name}|${city.country || ''}`.toLocaleLowerCase('es');
  const escHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const normalizeCityName = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  const cityCatalogKey = city => {
    const name = normalizeCityName(city.name);
    const country = normalizeCityName(city.country);
    if (['roma', 'rome'].includes(name) && (!country || ['italia', 'italy'].includes(country))) return 'roma';
    if (['firenze', 'florence', 'florencia'].includes(name) && (!country || ['italia', 'italy'].includes(country))) return 'florencia';
    if (name === 'paris' && (!country || ['francia', 'france'].includes(country))) return 'paris';
    return null;
  };
  const isRome = city => cityCatalogKey(city) === 'roma';

  const romeOfficialDetails = {
    coliseo: { description: 'El gran anfiteatro de la antigua Roma, escenario de espectáculos públicos y uno de los símbolos de la ciudad.', src: 'https://www.turismoroma.it/en/places/parco-archeologico-del-colosseo' },
    foro: { description: 'El centro de la vida pública romana durante siglos, junto al Palatino y el Coliseo.', src: 'https://www.turismoroma.it/en/places/parco-archeologico-del-colosseo' },
    pantheon: { description: 'Templo antiguo célebre por su cúpula y su óculo; hoy conserva también las tumbas de figuras históricas.', src: 'https://www.turismoroma.it/en/page/rome-nutshell' },
    trevi: { description: 'La fuente barroca más famosa de Roma, diseñada por Nicola Salvi y alimentada por el antiguo acueducto Virgo.', src: 'https://www.turismoroma.it/en/node/1286' },
    navona: { description: 'Una plaza barroca animada, conocida por sus fuentes monumentales y su trazado sobre el antiguo estadio de Domiciano.', src: 'https://www.turismoroma.it/en/taxonomy/term/455' },
    vaticano: { description: 'Un conjunto imprescindible de arte y arquitectura: la Basílica de San Pedro y los Museos Vaticanos, con la Capilla Sixtina.', src: 'https://www.turismoroma.it/en/node/6130' },
    castel: { description: 'Fortaleza junto al Tíber, construida originalmente como mausoleo del emperador Adriano y conectada con el Vaticano.', src: 'https://www.turismoroma.it/en/node/6130' },
    borghese: { description: 'Amplios jardines históricos para pasear y descansar; incluyen la Galería Borghese y miradores sobre la ciudad.', src: 'https://www.turismoroma.it/en/page/rome-nutshell' },
    trastevere: { description: 'Barrio de calles estrechas y plazas con una identidad romana muy marcada, ideal para recorrer a pie.', src: 'https://www.turismoroma.it/en/page/city-within-city-rioni-roma' }
  };
  placesData.forEach(place => {
    const details = romeOfficialDetails[place.id];
    if (details) Object.assign(place, details, { officialSource: true });
  });

  const officialCityCatalogs = {
    florencia: {
      source: 'FeelFlorence',
      places: [
        { id: 'florence-duomo', name: 'Piazza del Duomo y Catedral', zone: 'Centro', type: 'Catedral y monumento', lat: 43.7731, lon: 11.2560, description: 'El corazón religioso de Florencia reúne la catedral de Santa Maria del Fiore, el Baptisterio y el campanario de Giotto.', src: 'https://www.feelflorence.it/en/points-interest/piazza-del-duomo' },
        { id: 'florence-uffizi', name: 'Galería Uffizi', zone: 'Centro', type: 'Museo', lat: 43.7677, lon: 11.2553, description: 'Una de las grandes pinacotecas del mundo, con obras de Botticelli, Leonardo, Miguel Ángel, Rafael y Caravaggio.', src: 'https://www.feelflorence.it/en/points-interest/uffizi-gallery' },
        { id: 'florence-ponte-vecchio', name: 'Ponte Vecchio', zone: 'Centro', type: 'Puente histórico', lat: 43.7679, lon: 11.2531, description: 'El puente más conocido de la ciudad, con sus tiendas históricas sobre el río Arno y vistas de sus orillas.', src: 'https://www.feelflorence.it/en/points-interest/ponte-vecchio' },
        { id: 'florence-signoria', name: 'Piazza della Signoria y Palazzo Vecchio', zone: 'Centro', type: 'Plaza y palacio', lat: 43.7694, lon: 11.2558, description: 'La plaza cívica histórica de Florencia, dominada por el Palazzo Vecchio y acompañada por esculturas al aire libre.', src: 'https://www.feelflorence.it/en/points-interest' },
        { id: 'florence-accademia', name: 'Galería de la Academia', zone: 'Norte', type: 'Museo', lat: 43.7769, lon: 11.2589, description: 'Museo conocido por el David de Miguel Ángel y otras esculturas inacabadas del artista.', src: 'https://www.feelflorence.it/en/points-interest/galleria-dellaccademia-di-firenze-academy-gallery' },
        { id: 'florence-santa-croce', name: 'Piazza Santa Croce', zone: 'Este', type: 'Plaza e iglesia', lat: 43.7686, lon: 11.2626, description: 'Plaza histórica presidida por la basílica franciscana de Santa Croce, vinculada a la vida cultural de la ciudad.', src: 'https://www.feelflorence.it/en/points-interest/piazza-santa-croce' },
        { id: 'florence-piazzale', name: 'Piazzale Michelangelo', zone: 'Sur', type: 'Mirador', lat: 43.7629, lon: 11.2652, description: 'La terraza panorámica más famosa de Florencia, con vistas al Duomo, el Arno, Ponte Vecchio y las colinas.', src: 'https://www.feelflorence.it/en/points-interest/piazzale-michelangiolo' },
        { id: 'florence-pitti', name: 'Palazzo Pitti', zone: 'Oltrarno', type: 'Palacio y museo', lat: 43.7652, lon: 11.2507, description: 'Antigua residencia de los Médici; el complejo alberga varios museos y da acceso a los jardines de Boboli.', src: 'https://www.feelflorence.it/en/points-interest/piazza-pitti' }
      ]
    },
    paris: {
      source: 'Paris je t’aime',
      places: [
        { id: 'paris-eiffel', name: 'Torre Eiffel', zone: 'Oeste', type: 'Monumento', lat: 48.8584, lon: 2.2945, description: 'Símbolo de París desde la Exposición Universal de 1889; sus distintos niveles ofrecen vistas panorámicas de la ciudad.', src: 'https://parisjetaime.com/eng/article/explore-the-eiffel-tower-a1068' },
        { id: 'paris-louvre', name: 'Museo del Louvre', zone: 'Centro', type: 'Museo', lat: 48.8606, lon: 2.3376, description: 'Antiguo palacio real y museo universal, con colecciones que abarcan milenios y obras como la Mona Lisa.', src: 'https://parisjetaime.com/eng/culture/musee-du-louvre-p3489' },
        { id: 'paris-notre-dame', name: 'Catedral de Notre-Dame', zone: 'Centro', type: 'Catedral', lat: 48.8530, lon: 2.3499, description: 'Obra maestra gótica en la Île de la Cité, reabierta al público tras su restauración.', src: 'https://parisjetaime.com/eng/article/Paris-10-must-sees-a992' },
        { id: 'paris-arc', name: 'Arco del Triunfo', zone: 'Oeste', type: 'Monumento', lat: 48.8738, lon: 2.2950, description: 'Monumento encargado por Napoleón; desde su terraza se contemplan los Campos Elíseos y las grandes avenidas.', src: 'https://parisjetaime.com/eng/culture/arc-de-triomphe-p3559' },
        { id: 'paris-orsay', name: 'Museo de Orsay', zone: 'Centro', type: 'Museo', lat: 48.8600, lon: 2.3266, description: 'Museo instalado en una antigua estación, especialmente reconocido por sus colecciones impresionistas y posimpresionistas.', src: 'https://parisjetaime.com/eng/article/Paris-10-must-sees-a992' },
        { id: 'paris-sacre-coeur', name: 'Basílica del Sacré-Cœur', zone: 'Norte', type: 'Basílica y mirador', lat: 48.8867, lon: 2.3431, description: 'Basílica en lo alto de Montmartre, conocida por su arquitectura y las vistas panorámicas de París.', src: 'https://parisjetaime.com/eng/article/Paris-10-must-sees-a992' },
        { id: 'paris-sainte-chapelle', name: 'Sainte-Chapelle', zone: 'Centro', type: 'Capilla histórica', lat: 48.8554, lon: 2.3449, description: 'Capilla gótica de la Île de la Cité, famosa por sus grandes vitrales medievales.', src: 'https://parisjetaime.com/eng/article/Paris-10-must-sees-a992' },
        { id: 'paris-garnier', name: 'Palais Garnier', zone: 'Norte', type: 'Ópera y monumento', lat: 48.8719, lon: 2.3316, description: 'Ópera histórica de fachada ornamentada y espacios interiores ricamente decorados.', src: 'https://parisjetaime.com/eng/article/Paris-10-must-sees-a992' }
      ]
    }
  };
  const updateTitle = () => {
    cityTitle.textContent = activeCity.label;
    document.title = `Itinerario en ${activeCity.name}`;
    cityInput.value = activeCity.label;
    const romeReference = document.querySelector('footer a[href*="turismoroma.it"]');
    if (romeReference) romeReference.hidden = !isRome(activeCity);
    const infoText = el('infoDialog')?.querySelector('p');
    if (infoText) infoText.textContent = 'Roma, Florencia y París usan catálogos curados de sus sitios oficiales de turismo, con descripciones en español y ubicaciones para el mapa. Para otras ciudades se consultan lugares geolocalizados en Wikipedia. El alojamiento también se puede buscar. Las rutas se solicitan a un servicio público de routing peatonal y pueden no estar disponibles. Si no hay una respuesta válida, no se dibuja un recorrido ficticio.';
  };
  const status = (message, total) => {
    el('routeStatus').textContent = message;
    if (total === undefined) delete el('routeStatus').dataset.total;
    else el('routeStatus').dataset.total = total;
  };
  const hideSuggestions = () => {
    suggestionBox.classList.add('hidden');
    cityInput.setAttribute('aria-expanded', 'false');
  };

  cityWrap.className = 'city-search mt-1 mb-3';
  cityInput.parentNode.insertBefore(cityWrap, cityInput);
  cityWrap.appendChild(cityInput);
  cityInput.classList.remove('mt-1', 'mb-3');
  suggestionBox.id = 'citySuggestions';
  suggestionBox.className = 'city-suggestions hidden';
  suggestionBox.setAttribute('role', 'listbox');
  suggestionBox.setAttribute('aria-label', 'Sugerencias de ciudades');
  cityWrap.appendChild(suggestionBox);
  cityHint.className = 'small mt-1';
  cityHint.textContent = 'Escribí al menos 3 letras para buscar una ciudad.';
  cityWrap.insertAdjacentElement('afterend', cityHint);
  cityInput.setAttribute('aria-autocomplete', 'list');
  cityInput.setAttribute('aria-controls', suggestionBox.id);
  cityInput.setAttribute('autocomplete', 'off');

  const formatCity = result => {
    const address = result.address || {};
    const name = address.city || address.town || address.village || address.municipality ||
      address.hamlet || address.locality || result.name || String(result.display_name || '').split(',')[0];
    const country = address.country || '';
    return {
      name, country, label: country ? `${name}, ${country}` : name,
      lat: Number(result.lat), lon: Number(result.lon),
      bbox: Array.isArray(result.boundingbox) ? result.boundingbox.map(Number) : null,
      displayName: result.display_name || name,
      key: cityKey({ name, country })
    };
  };

  const showCityResults = (results, message) => {
    cityResults = results;
    if (message) {
      suggestionBox.innerHTML = `<div class="city-status small" role="status">${escHtml(message)}</div>`;
    } else {
      suggestionBox.innerHTML = results.map((city, index) =>
        `<button type="button" class="city-suggestion" role="option" data-city-index="${index}">${escHtml(city.label)}</button>`
      ).join('') || '<div class="city-status small" role="status">No se encontraron ciudades. Probá con otro nombre.</div>';
      suggestionBox.querySelectorAll('[data-city-index]').forEach(button => {
        button.addEventListener('click', () => chooseCity(cityResults[Number(button.dataset.cityIndex)]));
      });
    }
    suggestionBox.classList.remove('hidden');
    cityInput.setAttribute('aria-expanded', 'true');
  };

  async function suggestCities(query) {
    if (searchController) searchController.abort();
    const controller = new AbortController();
    searchController = controller;
    showCityResults([], 'Buscando ciudades…');
    const wait = Math.max(0, 1000 - (Date.now() - lastSuggestionRequest));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    if (controller.signal.aborted) return;
    lastSuggestionRequest = Date.now();
    try {
      const params = new URLSearchParams({
        format: 'jsonv2', addressdetails: '1', limit: '8', featuretype: 'city', q: query
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        signal: controller.signal, headers: { 'Accept-Language': 'es' }
      });
      if (!response.ok) throw new Error('No se pudo conectar con el buscador de ciudades.');
      const data = await response.json();
      const results = data.map(formatCity).filter(city => city.name && Number.isFinite(city.lat) && Number.isFinite(city.lon));
      showCityResults(results, results.length ? '' : 'No se encontraron ciudades. Probá con otro nombre.');
    } catch (error) {
      if (error.name !== 'AbortError') showCityResults([], 'No se pudieron cargar las sugerencias. Revisá tu conexión e intentá de nuevo.');
    }
  }

  async function loadCityAttractions(version) {
    remotePlaces = [];
    if (isRome(activeCity)) {
      showRomeCatalog = true;
      el('searchBtn').disabled = false;
      el('searchBtn').textContent = '⌕  Buscar atracciones';
      status('Mostrando el catálogo de Roma.');
      renderPlaces(); renderMap(); renderSchedule();
      return;
    }
    showRomeCatalog = false;
    const catalogKey = cityCatalogKey(activeCity);
    const officialCatalog = officialCityCatalogs[catalogKey];
    if (officialCatalog) {
      remotePlaces = officialCatalog.places.map(place => ({ ...place, officialSource: true }));
      el('searchBtn').disabled = false;
      el('searchBtn').textContent = '⌕  Volver a buscar atracciones';
      status(`${officialCatalog.source} ofrece ${remotePlaces.length} atracciones destacadas para ${activeCity.name}.`);
      renderPlaces(); renderMap(); renderSchedule();
      saveCurrentPlan();
      return;
    }
    const { lat, lon } = activeCity;
    if (dataController) dataController.abort();
    dataController = new AbortController();
    const controller = dataController;
    el('searchBtn').disabled = true;
    el('searchBtn').textContent = 'Buscando lugares…';
    status(`Buscando atracciones cercanas en ${activeCity.name}…`);
    try {
      const params = new URLSearchParams({
        action: 'query', list: 'geosearch', gscoord: `${lat}|${lon}`,
        gsradius: '10000', gslimit: '50', format: 'json', origin: '*'
      });
      const requestController = new AbortController();
      const abortWithCityChange = () => requestController.abort();
      let timedOut = false;
      controller.signal.addEventListener('abort', abortWithCityChange, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        requestController.abort();
      }, 15000);
      let data;
      try {
        const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: requestController.signal });
        if (!response.ok) throw new Error(`Wikipedia respondió ${response.status}.`);
        data = await response.json();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        if (timedOut) throw new Error('El buscador de lugares tardó demasiado en responder. Probá de nuevo en unos segundos.');
        throw error;
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', abortWithCityChange);
      }
      if (version !== requestVersion) return;
      if (data.error) throw new Error(data.error.info || 'Wikipedia no pudo completar la búsqueda.');
      remotePlaces = (data.query?.geosearch || []).map(item => {
        if (item.lat == null || item.lon == null || !item.title) return null;
        return {
          id: `wiki-${item.pageid}`, name: item.title, zone: 'Ciudad',
          type: 'Lugar de interés', lat: Number(item.lat), lon: Number(item.lon),
          src: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
        };
      }).filter(Boolean);
      status(remotePlaces.length
        ? `Wikipedia encontró ${remotePlaces.length} lugares cercanos en ${activeCity.name}. Revisá los nombres antes de agregarlos al itinerario.`
        : `Wikipedia no encontró lugares cercanos para ${activeCity.name}. Podés volver a intentarlo.`);
      renderPlaces(); renderMap(); renderSchedule();
      saveCurrentPlan();
    } catch (error) {
      if (version !== requestVersion || dataController !== controller || controller.signal.aborted) return;
      remotePlaces = [];
      status(`No se pudieron obtener atracciones para ${activeCity.name}. ${error.message || 'Revisá la conexión y volvé a intentarlo.'}`);
      renderPlaces(); renderMap(); renderSchedule();
    } finally {
      if (version === requestVersion && dataController === controller) {
        el('searchBtn').disabled = false;
        el('searchBtn').textContent = '⌕  Volver a buscar atracciones';
      }
    }
  }

  function saveCurrentPlan() {
    try {
      localStorage.setItem(appKey, JSON.stringify({
        cityKey: activeCity.key, ids: [...selected], assignments, custom,
        places: remotePlaces, coords,
        days: Number(el('dayCount').value)
      }));
      localStorage.setItem(lastCityKey, JSON.stringify(activeCity));
    } catch { /* El itinerario sigue disponible durante esta sesión. */ }
  }

  function restoreCurrentPlan() {
    const plan = safeJson(localStorage.getItem(appKey));
    if (!plan || plan.cityKey !== activeCity.key) return false;
    // Una búsqueda recién completada prevalece sobre listas antiguas o vacías del caché.
    if (!isRome(activeCity) && !remotePlaces.length && Array.isArray(plan.places)) remotePlaces = plan.places;
    selected = new Set(plan.ids || []);
    assignments = plan.assignments || {};
    custom = (plan.custom || []).filter(place => {
      const distance = dist({ lat: activeCity.lat, lon: activeCity.lon }, place);
      return distance < 100;
    });
    if (plan.coords && dist({ lat: activeCity.lat, lon: activeCity.lon }, plan.coords) < 100) coords = plan.coords;
    else coords = { lat: activeCity.lat, lon: activeCity.lon, name: `Centro de ${activeCity.name}` };
    if (plan.days >= 1 && plan.days <= 7) el('dayCount').value = String(plan.days);
    el('startName').value = coords.name;
    return true;
  }

  async function chooseCity(city, startup = false) {
    if (!city) return;
    hideSuggestions();
    const nextKey = city.key || cityKey(city);
    if (nextKey === activeCity.key) {
      updateTitle();
      if (!remotePlaces.length && !isRome(activeCity)) await loadCityAttractions(requestVersion);
      return;
    }
    if (!startup && (selected.size || custom.length)) {
      const proceed = window.confirm(`Cambiar a ${city.label} borrará las atracciones y el itinerario actuales. ¿Querés continuar?`);
      if (!proceed) { updateTitle(); return; }
    }
    const savedPlan = startup ? safeJson(localStorage.getItem(appKey)) : null;
    activeCity = { ...city, key: nextKey };
    requestVersion++;
    if (dataController) dataController.abort();
    if (userMarker && map) { map.removeLayer(userMarker); userMarker = null; }
    selected = new Set(); custom = []; remotePlaces = []; assignments = {}; routeOrder = {}; day = 0;
    zone = 'Todas';
    coords = { lat: activeCity.lat, lon: activeCity.lon, name: `Centro de ${activeCity.name}` };
    el('startName').value = coords.name;
    el('startStatus').textContent = `Inicio aproximado en el centro de ${activeCity.name}. Podés editarlo.`;
    el('customResults').innerHTML = '';
    el('customName').value = '';
    el('query').value = '';
    el('filters').classList.toggle('hidden', !isRome(activeCity));
    document.querySelectorAll('[data-zone]').forEach(button => button.classList.toggle('active', button.dataset.zone === 'Todas'));
    showRomeCatalog = isRome(activeCity);
    updateTitle();
    if (map) { map.setView([activeCity.lat, activeCity.lon], 12); map.invalidateSize(true); }
    el('routeStatus').dataset.total = '';
    setDays();
    renderPlaces(); renderMap(); renderSchedule();
    if (!startup) saveCurrentPlan();
    await loadCityAttractions(requestVersion);
    if (startup && savedPlan?.cityKey === activeCity.key && restoreCurrentPlan()) {
      el('startStatus').textContent = `Inicio guardado en ${coords.name}. Podés editarlo.`;
      setDays(); renderPlaces(); renderMap(); renderSchedule();
    }
  }

  cityInput.addEventListener('input', () => {
    const query = cityInput.value.trim();
    clearTimeout(searchTimer);
    if (searchController) searchController.abort();
    if (query.length < 3) { hideSuggestions(); return; }
    searchTimer = setTimeout(() => suggestCities(query), 300);
  });
  cityInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideSuggestions();
    if (event.key === 'Enter') {
      const first = cityResults[0];
      if (first && !suggestionBox.classList.contains('hidden')) {
        event.preventDefault(); chooseCity(first);
      }
    }
    if (event.key === 'ArrowDown' && !suggestionBox.classList.contains('hidden')) {
      event.preventDefault(); suggestionBox.querySelector('.city-suggestion')?.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!cityWrap.contains(event.target)) hideSuggestions();
  });

  window.persistPlan = saveCurrentPlan;
  el('searchBtn').onclick = () => loadCityAttractions(requestVersion);
  el('locateStart').onclick = async () => {
    const query = el('startName').value.trim();
    if (!query) return;
    try {
      const params = new URLSearchParams({ format: 'jsonv2', limit: '5', q: `${query}, ${activeCity.label}` });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'es' } });
      if (!response.ok) throw new Error();
      const results = await response.json();
      if (!results.length) throw new Error();
      const result = results[0];
      coords = { lat: Number(result.lat), lon: Number(result.lon), name: query };
      el('startStatus').textContent = `Ubicación encontrada: ${result.display_name}`;
      saveCurrentPlan(); renderMap(); renderSchedule();
    } catch {
      el('startStatus').textContent = 'No se pudo encontrar ese punto de partida. Revisá el nombre o probá con una dirección.';
    }
  };

  el('customSearch').onclick = async () => {
    const query = el('customName').value.trim();
    const output = el('customResults');
    if (!query) return;
    output.innerHTML = '<span class="small">Buscando…</span>';
    try {
      const params = new URLSearchParams({ format: 'jsonv2', limit: '5', q: `${query}, ${activeCity.label}` });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'es' } });
      if (!response.ok) throw new Error();
      const results = await response.json();
      output.innerHTML = results.map((result, index) =>
        `<button type="button" class="block w-full text-left p-2 mt-1 rounded-lg bg-white border text-sm" data-custom-result="${index}">${escHtml(result.display_name)}</button>`
      ).join('') || '<span class="small">No se encontraron ubicaciones en esta ciudad.</span>';
      output.querySelectorAll('[data-custom-result]').forEach(button => button.addEventListener('click', () => {
        const result = results[Number(button.dataset.customResult)];
        const place = {
          id: `custom-${Date.now()}`, name: query, zone: 'Personalizada', type: 'Personalizada',
          lat: Number(result.lat), lon: Number(result.lon),
          src: `https://www.openstreetmap.org/?mlat=${result.lat}&mlon=${result.lon}`
        };
        custom.push(place); selected.add(place.id); assignments[place.id] = day;
        saveCurrentPlan(); output.innerHTML = '<span class="small">Atracción agregada al día actual.</span>';
        renderPlaces(); renderMap(); renderSchedule();
      }));
    } catch {
      output.innerHTML = '<span class="small">No se pudo buscar la ubicación. Probá de nuevo.</span>';
    }
  };

  const oldRenderPlaces = renderPlaces;
  window.renderPlaces = function () {
    oldRenderPlaces();
    if (!isRome(activeCity) && !remotePlaces.length && !custom.length) {
      el('places').innerHTML = '<p class="small py-5">Todavía no hay atracciones cargadas para esta ciudad. Usá “Volver a buscar atracciones” para intentarlo otra vez.</p>';
    }
  };

  const savedCity = safeJson(localStorage.getItem(lastCityKey));
  if (savedCity && savedCity.key && savedCity.key !== activeCity.key && savedCity.lat && savedCity.lon) {
    selected = new Set(); custom = []; remotePlaces = []; assignments = {}; routeOrder = {};
    chooseCity(savedCity, true);
  } else {
    activeCity.key = cityKey(activeCity);
    const restored = restoreCurrentPlan();
    if (!restored) {
      coords = { lat: activeCity.lat, lon: activeCity.lon, name: 'Centro de Roma' };
      if (selected.size || custom.length) saveCurrentPlan();
    }
    el('startName').value = coords.name;
    el('startStatus').textContent = restored
      ? `Inicio guardado en ${coords.name}. Podés editarlo.`
      : 'Inicio aproximado en el centro de Roma. Podés editarlo.';
    el('filters').classList.remove('hidden');
    updateTitle();
    setDays(); renderMap(); renderSchedule();
  }
})();
