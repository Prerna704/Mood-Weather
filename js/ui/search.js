import { appState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { fetchGeocoding, geocodeCity, fetchWeatherBundle } from '../services/weatherApi.js';
import { clearWeatherState, hideSuggestions, renderWeather, setLoadingState } from './render.js';

export const fetchAndRenderByCoords = async (latitude, longitude, locationName) => {
  appState.latitude = latitude;
  appState.longitude = longitude;
  appState.city = locationName;
  setLoadingState('Loading weather data...');
  try {
    const bundle = await fetchWeatherBundle(latitude, longitude);
    renderWeather(bundle, locationName);
  } catch {
    clearWeatherState('Unable to fetch weather right now.');
    dom.mood.textContent = 'Network issue aayi. Thodi der baad retry karo.';
  }
};

export const searchCity = async (city) => {
  hideSuggestions();
  const preferredCountry = dom.countryFilter.value;
  try {
    let place;
    try {
      place = await geocodeCity(city, preferredCountry);
    } catch (firstError) {
      if (!preferredCountry) throw firstError;
      place = await geocodeCity(city, '');
    }
    dom.search.value = place.name;
    const label = `${place.name}, ${place.admin1 ? `${place.admin1}, ` : ''}${place.country}`;
    await fetchAndRenderByCoords(place.latitude, place.longitude, label);
  } catch {
    clearWeatherState('City not found.');
    dom.mood.textContent = 'Invalid city name. Please pick from suggestions.';
  }
};

export const renderSuggestions = (results) => {
  if (!results.length) {
    hideSuggestions();
    return;
  }
  dom.suggestionsBox.innerHTML = results.map((place) => {
    const label = `${place.name}, ${place.admin1 ? `${place.admin1}, ` : ''}${place.country}`;
    return `<div class="suggestion-item" data-lat="${place.latitude}" data-lon="${place.longitude}" data-label="${label}" data-name="${place.name}">${label}</div>`;
  }).join('');
  dom.suggestionsBox.classList.add('show');
};

export const fetchSuggestions = async (query) => {
  const token = ++appState.suggestionToken;
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  try {
    const data = await fetchGeocoding(query, dom.countryFilter.value, 8);
    if (token !== appState.suggestionToken) return;
    renderSuggestions(data.results || []);
  } catch {
    hideSuggestions();
  }
};
