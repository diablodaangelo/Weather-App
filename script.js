// API Configuration
const API_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const weatherContent = document.getElementById('weatherContent');

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
locationBtn.addEventListener('click', handleGeolocation);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

// Search handler
async function handleSearch() {
    const city = searchInput.value.trim();
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    await fetchWeatherByCity(city);
}

// Geolocation handler
function handleGeolocation() {
    if (navigator.geolocation) {
        loading.style.display = 'block';
        error.style.display = 'none';
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoords(latitude, longitude);
            },
            () => {
                showError('Unable to access location. Please enable location permissions.');
            }
        );
    } else {
        showError('Geolocation is not supported in your browser.');
    }
}

// Fetch weather by city
async function fetchWeatherByCity(city) {
    loading.style.display = 'block';
    error.style.display = 'none';
    weatherContent.style.display = 'none';

    try {
        // Get coordinates from city name
        const geoResponse = await fetch(`${API_BASE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            showError('City not found. Try another city name.');
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];
        await fetchWeatherByCoords(latitude, longitude, `${name}, ${country}`);
    } catch (err) {
        showError('An error occurred while fetching data. Please try again.');
        console.error(err);
    }
}

// Fetch weather by coordinates
async function fetchWeatherByCoords(latitude, longitude, cityName = null) {
    try {
        const response = await fetch(
            `${WEATHER_API}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,pressure_msl,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&language=en`
        );
        const data = await response.json();

        // Get reverse geocoding for city name if not provided
        if (!cityName) {
            try {
                const reverseResponse = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                );
                const reverseData = await reverseResponse.json();
                cityName = reverseData.address?.city || reverseData.address?.town || 'Current Location';
            } catch {
                cityName = 'Current Location';
            }
        }

        displayWeather(data, cityName);
        searchInput.value = '';
    } catch (err) {
        showError('An error occurred while fetching weather data.');
        console.error(err);
    } finally {
        loading.style.display = 'none';
    }
}

// Display weather data
function displayWeather(data, cityName) {
    const current = data.current;
    const daily = data.daily;
    const timezone = data.timezone;

    // Update current weather
    document.getElementById('cityName').textContent = cityName;
    
    // Get current time in timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit'
    });
    

    document.getElementById('temperature').textContent = Math.round(current.temperature_2m);
    document.getElementById('feelsLike').textContent = `Feels like ${Math.round(current.apparent_temperature)}°C`;
    document.getElementById('humidity').textContent = current.relative_humidity_2m + '%';
    document.getElementById('windSpeed').textContent = Math.round(current.wind_speed_10m) + ' km/h';
    document.getElementById('pressure').textContent = current.pressure_msl + ' mb';
    document.getElementById('visibility').textContent = (current.visibility / 1000).toFixed(1) + ' km';

    // Weather description
    const description = getWeatherDescription(current.weather_code);
    document.getElementById('weatherDescription').textContent = description;

    // Display forecast
    displayForecast(daily);

    weatherContent.style.display = 'block';
}

// Display 7-day forecast
function displayForecast(daily) {
    const forecastContainer = document.getElementById('forecast');
    forecastContainer.innerHTML = '';

    for (let i = 1; i < Math.min(8, daily.time.length); i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const weatherCode = daily.weather_code[i];

        const forecastDay = document.createElement('div');
        forecastDay.className = 'forecast-day';
        const description = getWeatherDescription(weatherCode);
        forecastDay.innerHTML = `
            <div class="forecast-day-name">${dayName}</div>
            <div class="forecast-day-temp-range">
                <div class="forecast-max">${maxTemp}°</div>
                <div class="forecast-min">${minTemp}°</div>
            </div>
        `;
        forecastContainer.appendChild(forecastDay);
    }
}

// Get weather description from WMO code
function getWeatherDescription(code) {
    const descriptions = {
        0: 'Clear',
        1: 'Mostly Clear',
        2: 'Partly Cloudy',
        3: 'Cloudy',
        45: 'Foggy',
        48: 'Frost Fog',
        51: 'Light Drizzle',
        53: 'Moderate Drizzle',
        55: 'Heavy Drizzle',
        61: 'Light Rain',
        63: 'Moderate Rain',
        65: 'Heavy Rain',
        71: 'Light Snow',
        73: 'Moderate Snow',
        75: 'Heavy Snow',
        77: 'Snow Grains',
        80: 'Light Showers',
        81: 'Moderate Showers',
        82: 'Heavy Showers',
        85: 'Light Snow Showers',
        86: 'Heavy Snow Showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with Hail',
        99: 'Thunderstorm with Heavy Hail'
    };
    return descriptions[code] || 'Unknown';
}

// Get weather icon emoji/URL based on WMO code
function getWeatherIcon(code, large = false) {
    const size = large ? 'large' : 'small';
    
    // Using open-meteo weather icons
    let iconCode = '01d'; // default sunny

    if (code === 0) iconCode = '01d';
    else if (code === 1 || code === 2) iconCode = '02d';
    else if (code === 3) iconCode = '04d';
    else if (code === 45 || code === 48) iconCode = '50d';
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) iconCode = '09d';
    else if ([71, 73, 75, 77, 85, 86].includes(code)) iconCode = '13d';
    else if ([95, 96, 99].includes(code)) iconCode = '11d';

    // Using free weather icon API
    return `https://raw.githubusercontent.com/basmilius/weather-icons/master/production/fill/${iconCode}.svg`;
}

// Show error message
function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    weatherContent.style.display = 'none';
    loading.style.display = 'none';
}

// Load default weather on page load
window.addEventListener('load', () => {
    // Try to load weather for default location (Jakarta)
    fetchWeatherByCity('Jakarta');
});
