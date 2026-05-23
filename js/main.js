import { clearWeatherState } from './ui/render.js';
import { searchCity } from './ui/search.js';
import { bindEvents, initLiveLocationOnHome } from './ui/events.js';

clearWeatherState();
bindEvents();

const boot = async () => {
  const liveLoaded = await initLiveLocationOnHome();
  if (!liveLoaded) {
    searchCity('Delhi');
  }
};

boot();
