const form = document.querySelector('.search-form');
const search = document.querySelector('#search');
const countryFilter = document.querySelector('#country-filter');
const suggestionsBox = document.querySelector('#search-suggestions');
const weather = document.querySelector('#weather');
const details = document.querySelector('#details');
const mood = document.querySelector('#mood');
const dataNote = document.querySelector('#data-note');
const airQualityText = document.querySelector('#air-quality-text');
const airQualityValue = document.querySelector('#air-quality h2');
const rightCurrent = document.querySelector('#right-current');
const sunCard = document.querySelector('#sun-card');
const forecastList = document.querySelector('#forecast-list');
const temperatureList = document.querySelector('#temperature-list');
const locateBtn = document.querySelector('#locate-btn');
const navButtons = document.querySelectorAll('.rail-btn');
const chartCanvas = document.querySelector('#hourly-chart');

const appState = {
  city: '',
  latitude: null,
  longitude: null,
  unit: 'C',
  lastBundle: null,
  hourlyChart: null,
  searchDebounce: null,
  suggestionToken: 0,
  liveRefreshTimer: null
};

const weatherCodeMap = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm'
};

const getWeatherText = (code) => weatherCodeMap[code] || 'Mixed weather';
const tempUnit = () => `\u00B0${appState.unit}`;
const displayTemp = (c) => appState.unit === 'F' ? Math.round((c * 9) / 5 + 32) : Math.round(c);
const toLocalTime = (iso, zone) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: zone });
const toWeekday = (iso, zone) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: zone });
const toHour = (iso, zone) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: zone });

const hideSuggestions = () => {
  suggestionsBox.classList.remove('show');
  suggestionsBox.innerHTML = '';
};

const clearWeatherState = (message = 'Search a city to view weather.') => {
  appState.lastBundle = null;
  weather.innerHTML = `<div class="empty-state">${message}</div>`;
  details.innerHTML = '';
  temperatureList.innerHTML = '';
  forecastList.innerHTML = '<p>Search a city to see trend summary.</p>';
  mood.textContent = 'Search for a city to get mood suggestions.';
  airQualityValue.textContent = '--';
  airQualityText.textContent = 'Waiting for search...';
  rightCurrent.innerHTML = '<p class="weekday">--</p><h2>--</h2><p class="place">Search a location</p>';
  sunCard.innerHTML = '<p>Sunrise: --</p><p>Sunset: --</p>';
  dataNote.textContent = 'Data source: Open-Meteo. Updated: --';
  if (appState.hourlyChart) {
    appState.hourlyChart.destroy();
    appState.hourlyChart = null;
  }
};

const setLoadingState = (msg) => {
  weather.innerHTML = `<div class="empty-state">${msg}</div>`;
  details.innerHTML = '';
  temperatureList.innerHTML = '';
  forecastList.innerHTML = '<p>Loading forecast...</p>';
};

const chooseBestPlace = (results, query, preferredCountry = '') => {
  const cleanQuery = query.toLowerCase().trim();
  const scored = results.map((place) => {
    let score = 0;
    const name = place.name?.toLowerCase() || '';
    const admin = place.admin1?.toLowerCase() || '';
    if (name === cleanQuery) score += 100;
    if (name.includes(cleanQuery)) score += 45;
    if (preferredCountry && place.country_code === preferredCountry) score += 60;
    if (!preferredCountry && place.country_code === 'IN') score += 30;
    if (admin.includes('uttar pradesh') && (cleanQuery.includes('banaras') || cleanQuery.includes('varanasi'))) score += 80;
    score += Math.min((place.population || 0) / 100000, 30);
    return { place, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.place;
};

const fetchGeocoding = async (city, preferredCountry = '', count = 10) => {
  const countryParam = preferredCountry ? `&countryCode=${preferredCountry}` : '';
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=${count}&language=en&format=json${countryParam}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to find city');
  return response.json();
};

const geocodeCity = async (city, preferredCountry = '') => {
  const data = await fetchGeocoding(city, preferredCountry, 10);
  if (!data.results || !data.results.length) throw new Error('City not found');
  const best = chooseBestPlace(data.results, city, preferredCountry);
  if (!best) throw new Error('City not found');
  return best;
};

const fetchWeatherBundle = async (latitude, longitude) => {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,cloud_cover,visibility&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=6`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10,ozone`;
  const [weatherRes, aqiRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
  if (!weatherRes.ok) throw new Error('Weather API failed');
  if (!aqiRes.ok) throw new Error('AQI API failed');
  const [weatherData, aqiData] = await Promise.all([weatherRes.json(), aqiRes.json()]);
  return { weatherData, aqiData };
};

const moodMessage = (code) => {
  if (code === 0 || code === 1) return 'Sky clear hai. Outdoor walk, photos, ya coffee date ke liye badiya time.';
  if (code >= 2 && code <= 3) return 'Cloudy vibe chal rahi hai. Focused work aur calm playlist perfect rahega.';
  if (code >= 51 && code <= 82) return 'Rainy mood hai. Chai, snacks, aur cozy indoor plans best rahenge.';
  if (code >= 71 && code <= 75) return 'Thandi weather cozy blanket aur warm drinks demand karti hai.';
  if (code >= 95) return 'Thunder chances hain, safe indoor raho aur unnecessary travel avoid karo.';
  return 'Weather dynamic hai, hydration aur light planning ke saath din enjoy karo.';
};

const renderHourlyChart = (hourly, zone) => {
  const labels = hourly.time.slice(0, 24).map((iso) => toHour(iso, zone));
  const dataPoints = hourly.temperature_2m.slice(0, 24).map((value) => displayTemp(value));
  if (appState.hourlyChart) appState.hourlyChart.destroy();

  appState.hourlyChart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `24h Temp (${tempUnit()})`,
        data: dataPoints,
        borderColor: '#f28c38',
        backgroundColor: 'rgba(242, 140, 56, 0.18)',
        pointBackgroundColor: '#f28c38',
        fill: true,
        tension: 0.35,
        pointRadius: 2.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: '#637089' } },
        y: { ticks: { color: '#637089', callback: (v) => `${v}${tempUnit()}` }, grid: { color: 'rgba(129, 144, 170, 0.22)' } }
      }
    }
  });
};

const renderTempStrip = (hourly, zone) => {
  const targets = [6, 12, 18, 22];
  const labels = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const entries = targets.map((hour, idx) => {
    const foundIndex = hourly.time.findIndex((iso) => Number(new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: zone })) === hour);
    const safeIndex = foundIndex >= 0 ? foundIndex : idx;
    const value = hourly.temperature_2m[safeIndex];
    return `<div class="temp-item"><strong>${displayTemp(value)}${tempUnit()}</strong><p>${labels[idx]}</p></div>`;
  });
  temperatureList.innerHTML = entries.join('');
};

const renderForecast = (daily, zone) => {
  const rows = daily.time.slice(1, 6).map((time, idx) => {
    const max = displayTemp(daily.temperature_2m_max[idx + 1]);
    const min = displayTemp(daily.temperature_2m_min[idx + 1]);
    const label = toWeekday(time, zone);
    const condition = getWeatherText(daily.weather_code[idx + 1]);
    return `<div class="forecast-row"><span>${label} - ${condition}</span><strong>${max}${tempUnit()} / ${min}${tempUnit()}</strong></div>`;
  });
  forecastList.innerHTML = rows.join('');
};

const renderDetails = (current) => {
  details.innerHTML = `
    <div class="detail-card"><h4>Pressure</h4><p>${Math.round(current.surface_pressure)} hPa</p></div>
    <div class="detail-card"><h4>Visibility</h4><p>${(current.visibility / 1000).toFixed(1)} km</p></div>
    <div class="detail-card"><h4>Humidity</h4><p>${Math.round(current.relative_humidity_2m)}%</p></div>
    <div class="detail-card"><h4>Wind</h4><p>${Math.round(current.wind_speed_10m)} km/h</p></div>
    <div class="detail-card"><h4>Feels Like</h4><p>${displayTemp(current.apparent_temperature)}${tempUnit()}</p></div>
    <div class="detail-card"><h4>Clouds</h4><p>${Math.round(current.cloud_cover)}%</p></div>
  `;
};

const renderWeather = (bundle, locationName) => {
  appState.lastBundle = bundle;
  const { weatherData, aqiData } = bundle;
  const current = weatherData.current;
  const daily = weatherData.daily;
  const zone = weatherData.timezone;
  const updated = new Date(current.time).toLocaleString('en-IN', { timeZone: zone });

  weather.innerHTML = `
    <div class="weather-head">
      <div>
        <p class="card-label">Weather</p>
        <h2 class="weather-temp">${displayTemp(current.temperature_2m)}${tempUnit()}</h2>
        <p class="weather-meta">${getWeatherText(current.weather_code)}</p>
      </div>
      <div>
        <p class="weather-meta">Feels ${displayTemp(current.apparent_temperature)}${tempUnit()}</p>
        <p class="weather-meta">Precip ${current.precipitation ?? 0} mm</p>
      </div>
    </div>
  `;

  renderDetails(current);
  mood.textContent = moodMessage(current.weather_code);

  const aqi = aqiData.current?.us_aqi;
  const pm25 = aqiData.current?.pm2_5;
  const pm10 = aqiData.current?.pm10;
  airQualityValue.textContent = aqi != null ? `${Math.round(aqi)} AQI` : 'AQI N/A';
  airQualityText.textContent = pm25 != null ? `PM2.5 ${pm25.toFixed(1)}, PM10 ${pm10.toFixed(1)} ug/m3` : 'AQI data currently unavailable.';

  rightCurrent.innerHTML = `<p class="weekday">${new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: zone })}</p><h2>${displayTemp(current.temperature_2m)}${tempUnit()}</h2><p class="place">${locationName}</p>`;
  sunCard.innerHTML = `<p>Sunrise: ${toLocalTime(daily.sunrise[0], zone)}</p><p>Sunset: ${toLocalTime(daily.sunset[0], zone)}</p>`;
  dataNote.textContent = `Data source: Open-Meteo. Updated: ${updated}`;

  renderForecast(daily, zone);
  renderTempStrip(weatherData.hourly, zone);
  renderHourlyChart(weatherData.hourly, zone);
};

const fetchAndRenderByCoords = async (latitude, longitude, locationName) => {
  appState.latitude = latitude;
  appState.longitude = longitude;
  appState.city = locationName;
  setLoadingState('Loading weather data...');
  try {
    const bundle = await fetchWeatherBundle(latitude, longitude);
    renderWeather(bundle, locationName);
  } catch {
    clearWeatherState('Unable to fetch weather right now.');
    mood.textContent = 'Network issue aayi. Thodi der baad retry karo.';
  }
};

const searchCity = async (city) => {
  hideSuggestions();
  const preferredCountry = countryFilter.value;
  try {
    let place;
    try {
      place = await geocodeCity(city, preferredCountry);
    } catch (firstError) {
      if (!preferredCountry) throw firstError;
      place = await geocodeCity(city, '');
    }

    search.value = place.name;
    const label = `${place.name}, ${place.admin1 ? `${place.admin1}, ` : ''}${place.country}`;
    stopLiveRefresh();
    await fetchAndRenderByCoords(place.latitude, place.longitude, label);
  } catch {
    clearWeatherState('City not found.');
    mood.textContent = 'Invalid city name. Please pick from suggestions.';
  }
};

const renderSuggestions = (results) => {
  if (!results.length) {
    hideSuggestions();
    return;
  }
  suggestionsBox.innerHTML = results.map((place) => {
    const label = `${place.name}, ${place.admin1 ? `${place.admin1}, ` : ''}${place.country}`;
    return `<div class="suggestion-item" data-lat="${place.latitude}" data-lon="${place.longitude}" data-label="${label}" data-name="${place.name}">${label}</div>`;
  }).join('');
  suggestionsBox.classList.add('show');
};

const fetchSuggestions = async (query) => {
  const token = ++appState.suggestionToken;
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  try {
    const data = await fetchGeocoding(query, countryFilter.value, 8);
    if (token !== appState.suggestionToken) return;
    renderSuggestions(data.results || []);
  } catch {
    hideSuggestions();
  }
};

const stopLiveRefresh = () => {
  if (appState.liveRefreshTimer) {
    clearInterval(appState.liveRefreshTimer);
    appState.liveRefreshTimer = null;
  }
};

const startLiveRefresh = (latitude, longitude, label) => {
  stopLiveRefresh();
  appState.liveRefreshTimer = setInterval(() => {
    fetchAndRenderByCoords(latitude, longitude, label);
  }, 10 * 60 * 1000);
};

const handleLocation = () => {
  if (!navigator.geolocation) {
    mood.textContent = 'Geolocation aapke browser me supported nahi hai.';
    return;
  }
  locateBtn.textContent = 'Locating...';
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const label = 'Your current location';
      await fetchAndRenderByCoords(lat, lon, label);
      startLiveRefresh(lat, lon, label);
      locateBtn.textContent = 'My Location';
    },
    () => {
      locateBtn.textContent = 'My Location';
      mood.textContent = 'Location permission deny hua. City search use karo.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

const handleNavAction = (action) => {
  if (action === 'home') return window.scrollTo({ top: 0, behavior: 'smooth' });
  if (action === 'map') {
    if (appState.latitude == null || appState.longitude == null) {
      mood.textContent = 'Map open karne se pehle city search karo.';
      return;
    }
    window.open(`https://www.google.com/maps?q=${appState.latitude},${appState.longitude}`, '_blank');
    return;
  }
  if (action === 'notes') {
    const text = `Weather notes: ${appState.city || 'N/A'}. ${mood.textContent}`;
    navigator.clipboard.writeText(text).then(() => {
      mood.textContent = 'Weather note clipboard me copy ho gaya.';
    }).catch(() => {
      mood.textContent = 'Clipboard access blocked. Manual copy use karo.';
    });
    return;
  }
  if (action === 'gear') {
    appState.unit = appState.unit === 'C' ? 'F' : 'C';
    if (appState.lastBundle && appState.city) renderWeather(appState.lastBundle, appState.city);
    mood.textContent = `Unit switched to ${appState.unit}.`;
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const city = search.value.trim();
  if (!city) {
    clearWeatherState('Please enter a city name.');
    return;
  }
  await searchCity(city);
});

search.addEventListener('input', () => {
  clearTimeout(appState.searchDebounce);
  appState.searchDebounce = setTimeout(() => fetchSuggestions(search.value.trim()), 300);
});

countryFilter.addEventListener('change', () => {
  const query = search.value.trim();
  if (query.length >= 2) fetchSuggestions(query);
});

suggestionsBox.addEventListener('click', async (event) => {
  const item = event.target.closest('.suggestion-item');
  if (!item) return;
  const lat = Number(item.dataset.lat);
  const lon = Number(item.dataset.lon);
  const label = item.dataset.label;
  search.value = item.dataset.name;
  hideSuggestions();
  stopLiveRefresh();
  await fetchAndRenderByCoords(lat, lon, label);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-input-wrap')) hideSuggestions();
});

locateBtn.addEventListener('click', handleLocation);

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    navButtons.forEach((btn) => btn.classList.remove('rail-btn-active'));
    button.classList.add('rail-btn-active');
    handleNavAction(button.dataset.action);
  });
});

const boot = () => {
  clearWeatherState();
  if (!navigator.geolocation) {
    searchCity('Delhi');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const label = 'Your current location';
      await fetchAndRenderByCoords(lat, lon, label);
      startLiveRefresh(lat, lon, label);
    },
    () => searchCity('Delhi'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

boot();
