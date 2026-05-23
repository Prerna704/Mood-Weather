import { appState } from './state.js';

export const weatherCodeMap = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm'
};

export const getWeatherText = (code) => weatherCodeMap[code] || 'Mixed weather';
export const tempUnit = () => `\u00B0${appState.unit}`;
export const displayTemp = (c) => appState.unit === 'F' ? Math.round((c * 9) / 5 + 32) : Math.round(c);
export const toLocalTime = (iso, zone) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: zone });
export const toWeekday = (iso, zone) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: zone });
export const toHour = (iso, zone) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: zone });

export const moodMessage = (code) => {
  if (code === 0 || code === 1) return 'Sky clear hai. Outdoor walk, photos, ya coffee date ke liye badiya time.';
  if (code >= 2 && code <= 3) return 'Cloudy vibe chal rahi hai. Focused work aur calm playlist perfect rahega.';
  if (code >= 51 && code <= 82) return 'Rainy mood hai. Chai, snacks, aur cozy indoor plans best rahenge.';
  if (code >= 71 && code <= 75) return 'Thandi weather cozy blanket aur warm drinks demand karti hai.';
  if (code >= 95) return 'Thunder chances hain, safe indoor raho aur unnecessary travel avoid karo.';
  return 'Weather dynamic hai, hydration aur light planning ke saath din enjoy karo.';
};
