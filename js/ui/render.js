import { appState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { displayTemp, getWeatherText, moodMessage, tempUnit, toHour, toLocalTime, toWeekday } from '../core/utils.js';

export const hideSuggestions = () => {
  dom.suggestionsBox.classList.remove('show');
  dom.suggestionsBox.innerHTML = '';
};

export const clearWeatherState = (message = 'Search a city to view weather.') => {
  appState.lastBundle = null;
  dom.weather.innerHTML = `<div class="empty-state">${message}</div>`;
  dom.details.innerHTML = '';
  dom.temperatureList.innerHTML = '';
  dom.forecastList.innerHTML = '<p>Search a city to see trend summary.</p>';
  dom.mood.textContent = 'Search for a city to get mood suggestions.';
  dom.airQualityValue.textContent = '--';
  dom.airQualityText.textContent = 'Waiting for search...';
  dom.rightCurrent.innerHTML = '<p class="weekday">--</p><h2>--</h2><p class="place">Search a location</p>';
  dom.sunCard.innerHTML = '<p>Sunrise: --</p><p>Sunset: --</p>';
  dom.dataNote.textContent = 'Data source: Open-Meteo. Updated: --';
  if (appState.hourlyChart) {
    appState.hourlyChart.destroy();
    appState.hourlyChart = null;
  }
};

export const setLoadingState = (msg) => {
  dom.weather.innerHTML = `<div class="empty-state">${msg}</div>`;
  dom.details.innerHTML = '';
  dom.temperatureList.innerHTML = '';
  dom.forecastList.innerHTML = '<p>Loading forecast...</p>';
};

const renderHourlyChart = (hourly, zone) => {
  const labels = hourly.time.slice(0, 24).map((iso) => toHour(iso, zone));
  const dataPoints = hourly.temperature_2m.slice(0, 24).map((value) => displayTemp(value));
  if (appState.hourlyChart) appState.hourlyChart.destroy();

  appState.hourlyChart = new Chart(dom.chartCanvas, {
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
  dom.temperatureList.innerHTML = entries.join('');
};

const renderForecast = (daily, zone) => {
  const rows = daily.time.slice(1, 6).map((time, idx) => {
    const max = displayTemp(daily.temperature_2m_max[idx + 1]);
    const min = displayTemp(daily.temperature_2m_min[idx + 1]);
    const label = toWeekday(time, zone);
    const condition = getWeatherText(daily.weather_code[idx + 1]);
    return `<div class="forecast-row"><span>${label} - ${condition}</span><strong>${max}${tempUnit()} / ${min}${tempUnit()}</strong></div>`;
  });
  dom.forecastList.innerHTML = rows.join('');
};

const renderDetails = (current) => {
  dom.details.innerHTML = `
    <div class="detail-card"><h4>Pressure</h4><p>${Math.round(current.surface_pressure)} hPa</p></div>
    <div class="detail-card"><h4>Visibility</h4><p>${(current.visibility / 1000).toFixed(1)} km</p></div>
    <div class="detail-card"><h4>Humidity</h4><p>${Math.round(current.relative_humidity_2m)}%</p></div>
    <div class="detail-card"><h4>Wind</h4><p>${Math.round(current.wind_speed_10m)} km/h</p></div>
    <div class="detail-card"><h4>Feels Like</h4><p>${displayTemp(current.apparent_temperature)}${tempUnit()}</p></div>
    <div class="detail-card"><h4>Clouds</h4><p>${Math.round(current.cloud_cover)}%</p></div>
  `;
};

export const renderWeather = (bundle, locationName) => {
  appState.lastBundle = bundle;
  const { weatherData, aqiData } = bundle;
  const current = weatherData.current;
  const daily = weatherData.daily;
  const zone = weatherData.timezone;
  const updated = new Date(current.time).toLocaleString('en-IN', { timeZone: zone });

  dom.weather.innerHTML = `
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
  dom.mood.textContent = moodMessage(current.weather_code);

  const aqi = aqiData.current?.us_aqi;
  const pm25 = aqiData.current?.pm2_5;
  const pm10 = aqiData.current?.pm10;
  dom.airQualityValue.textContent = aqi != null ? `${Math.round(aqi)} AQI` : 'AQI N/A';
  dom.airQualityText.textContent = pm25 != null ? `PM2.5 ${pm25.toFixed(1)}, PM10 ${pm10.toFixed(1)} ug/m3` : 'AQI data currently unavailable.';

  dom.rightCurrent.innerHTML = `<p class="weekday">${new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: zone })}</p><h2>${displayTemp(current.temperature_2m)}${tempUnit()}</h2><p class="place">${locationName}</p>`;
  dom.sunCard.innerHTML = `<p>Sunrise: ${toLocalTime(daily.sunrise[0], zone)}</p><p>Sunset: ${toLocalTime(daily.sunset[0], zone)}</p>`;
  dom.dataNote.textContent = `Data source: Open-Meteo. Updated: ${updated}`;

  renderForecast(daily, zone);
  renderTempStrip(weatherData.hourly, zone);
  renderHourlyChart(weatherData.hourly, zone);
};
