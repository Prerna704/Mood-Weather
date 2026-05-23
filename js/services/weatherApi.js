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

export const fetchGeocoding = async (city, preferredCountry = '', count = 10) => {
  const countryParam = preferredCountry ? `&countryCode=${preferredCountry}` : '';
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=${count}&language=en&format=json${countryParam}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to find city');
  return response.json();
};

export const geocodeCity = async (city, preferredCountry = '') => {
  const data = await fetchGeocoding(city, preferredCountry, 10);
  if (!data.results || !data.results.length) throw new Error('City not found');
  const best = chooseBestPlace(data.results, city, preferredCountry);
  if (!best) throw new Error('City not found');
  return best;
};

export const fetchWeatherBundle = async (latitude, longitude) => {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,cloud_cover,visibility&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=6`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10,ozone`;
  const [weatherRes, aqiRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
  if (!weatherRes.ok) throw new Error('Weather API failed');
  if (!aqiRes.ok) throw new Error('AQI API failed');
  const [weatherData, aqiData] = await Promise.all([weatherRes.json(), aqiRes.json()]);
  return { weatherData, aqiData };
};
