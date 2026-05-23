import { appState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { clearWeatherState, hideSuggestions, renderWeather } from './render.js';
import { fetchAndRenderByCoords, fetchSuggestions, searchCity } from './search.js';

const stopLiveRefresh = () => {
  if (appState.liveRefreshTimer) {
    clearInterval(appState.liveRefreshTimer);
    appState.liveRefreshTimer = null;
  }
};

const startLiveRefresh = (latitude, longitude, label) => {
  stopLiveRefresh();
  appState.isLiveLocation = true;
  appState.liveRefreshTimer = setInterval(() => {
    fetchAndRenderByCoords(latitude, longitude, label);
  }, 10 * 60 * 1000);
};

const handleLocation = () => {
  if (!navigator.geolocation) {
    dom.mood.textContent = 'Geolocation aapke browser me supported nahi hai.';
    return;
  }

  dom.locateBtn.textContent = 'Locating...';
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const label = 'Your current location';
      await fetchAndRenderByCoords(lat, lon, label);
      startLiveRefresh(lat, lon, label);
      dom.locateBtn.textContent = 'My Location';
    },
    () => {
      dom.locateBtn.textContent = 'My Location';
      dom.mood.textContent = 'Location permission deny hua. City search use karo.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

const handleNavAction = (action) => {
  if (action === 'home') return window.scrollTo({ top: 0, behavior: 'smooth' });
  if (action === 'map') {
    if (appState.latitude == null || appState.longitude == null) {
      dom.mood.textContent = 'Map open karne se pehle city search karo.';
      return;
    }
    window.open(`https://www.google.com/maps?q=${appState.latitude},${appState.longitude}`, '_blank');
    return;
  }
  if (action === 'notes') {
    const text = `Weather notes: ${appState.city || 'N/A'}. ${dom.mood.textContent}`;
    navigator.clipboard.writeText(text).then(() => {
      dom.mood.textContent = 'Weather note clipboard me copy ho gaya.';
    }).catch(() => {
      dom.mood.textContent = 'Clipboard access blocked. Manual copy use karo.';
    });
    return;
  }
  if (action === 'gear') {
    appState.unit = appState.unit === 'C' ? 'F' : 'C';
    if (appState.lastBundle && appState.city) renderWeather(appState.lastBundle, appState.city);
    dom.mood.textContent = `Unit switched to ${appState.unit}.`;
  }
};

export const bindEvents = () => {
  dom.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const city = dom.search.value.trim();
    if (!city) {
      clearWeatherState('Please enter a city name.');
      return;
    }
    appState.isLiveLocation = false;
    stopLiveRefresh();
    await searchCity(city);
  });

  dom.search.addEventListener('input', () => {
    clearTimeout(appState.searchDebounce);
    appState.searchDebounce = setTimeout(() => fetchSuggestions(dom.search.value.trim()), 300);
  });

  dom.countryFilter.addEventListener('change', () => {
    const query = dom.search.value.trim();
    if (query.length >= 2) fetchSuggestions(query);
  });

  dom.suggestionsBox.addEventListener('click', async (event) => {
    const item = event.target.closest('.suggestion-item');
    if (!item) return;
    const lat = Number(item.dataset.lat);
    const lon = Number(item.dataset.lon);
    const label = item.dataset.label;
    dom.search.value = item.dataset.name;
    hideSuggestions();
    appState.isLiveLocation = false;
    stopLiveRefresh();
    await fetchAndRenderByCoords(lat, lon, label);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-input-wrap')) hideSuggestions();
  });

  dom.locateBtn.addEventListener('click', handleLocation);

  dom.navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      dom.navButtons.forEach((btn) => btn.classList.remove('rail-btn-active'));
      button.classList.add('rail-btn-active');
      handleNavAction(button.dataset.action);
    });
  });
};

export const initLiveLocationOnHome = async () => {
  if (!navigator.geolocation) return false;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const label = 'Your current location';
        await fetchAndRenderByCoords(lat, lon, label);
        startLiveRefresh(lat, lon, label);
        resolve(true);
      },
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
};
