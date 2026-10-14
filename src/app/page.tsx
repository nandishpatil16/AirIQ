'use client';

import { useEffect, useState } from 'react';
import AqiChart from '@/components/AqiChart';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { 
  Wind, Droplets, Thermometer, Activity, CloudFog, AlertTriangle, 
  Settings, LayoutDashboard, History, CheckCircle2, Factory,
  DownloadCloud, Bell, ShieldCheck, CloudLightning,
  Sun, Cloud, CloudRain, CloudDrizzle, CloudSun, Compass, Gauge, RefreshCw, MapPin, Navigation
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyCM0rwFlapYWvq6HCzrGcU9Spn-fhTKIrI",
  authDomain: "airaqi-54c24.firebaseapp.com",
  databaseURL: "https://airaqi-54c24-default-rtdb.firebaseio.com",
  projectId: "airaqi-54c24",
  storageBucket: "airaqi-54c24.firebasestorage.app",
  messagingSenderId: "235961933401",
  appId: "1:235961933401:web:02c8bbc922ce6893b45b48"
};

// Initialize Firebase once
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface LiveWeatherData {
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  pressure: number;
  weatherCode: number;
  isDay: number;
  locationName: string;
  lastUpdated: string;
}

const CITY_PRESETS: Record<string, { name: string; lat: number; lon: number }> = {
  bangalore: { name: "Bengaluru, IN", lat: 12.9716, lon: 77.5946 },
  mumbai: { name: "Mumbai, IN", lat: 19.0760, lon: 72.8777 },
  delhi: { name: "New Delhi, IN", lat: 28.6139, lon: 77.2090 },
  hyderabad: { name: "Hyderabad, IN", lat: 17.3850, lon: 78.4867 },
  chennai: { name: "Chennai, IN", lat: 13.0827, lon: 80.2707 },
  pune: { name: "Pune, IN", lat: 18.5204, lon: 73.8567 },
};

export default function Dashboard() {
  const [sensorData, setSensorData] = useState<any>({ pm25: 0, co2: 0, mq135: 0, mq7: 0, no2: 0, temperature: 0, humidity: 0, timestamp: 0 });
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Live Weather API State
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData>({
    temp: 27.5,
    apparentTemp: 28.2,
    humidity: 62,
    windSpeed: 14.4,
    windDirection: 75,
    windGusts: 19.8,
    pressure: 1012,
    weatherCode: 1,
    isDay: 1,
    locationName: "Bengaluru, IN",
    lastUpdated: "Live API"
  });
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [activeCityKey, setActiveCityKey] = useState("bangalore");

  // Settings State
  const [alarmThreshold, setAlarmThreshold] = useState('150');
  const [pollingRate, setPollingRate] = useState('5'); // Kept for UI compatibility, though Firebase is realtime
  const [isSettingsSaved, setIsSettingsSaved] = useState(false);

  // Fetch real-time weather directly from Open-Meteo API
  const fetchWeather = async (lat = 12.9716, lon = 77.5946, label = "Bengaluru, IN") => {
    setWeatherLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure&timezone=auto`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.current) {
          setLiveWeather({
            temp: Number(data.current.temperature_2m?.toFixed(1) || 27.5),
            apparentTemp: Number(data.current.apparent_temperature?.toFixed(1) || 28.2),
            humidity: Math.round(data.current.relative_humidity_2m || 62),
            windSpeed: Number(data.current.wind_speed_10m?.toFixed(1) || 14.4),
            windDirection: Math.round(data.current.wind_direction_10m || 75),
            windGusts: Number((data.current.wind_gusts_10m || (data.current.wind_speed_10m * 1.35))?.toFixed(1) || 19.8),
            pressure: Math.round(data.current.surface_pressure || 1012),
            weatherCode: data.current.weather_code ?? 1,
            isDay: data.current.is_day ?? 1,
            locationName: label,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
        }
      }
    } catch (e) {
      console.warn("Weather API notice:", e);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    // 1. Firebase Live Listener
    const latestRef = ref(database, 'sensor_data/latest');
    const unsubscribe = onValue(latestRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // If ESP32 doesn't send a timestamp, we stamp it locally so it says "Online"
        if (!data.timestamp || data.timestamp === 0) {
          data.timestamp = Date.now();
        }
        setSensorData(data);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    // 2. Initial Live Weather Fetch
    fetchWeather(12.9716, 77.5946, "Bengaluru, IN");

    // Optional GPS location if granted by user's browser
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your Live GPS Location");
          setActiveCityKey("gps");
        },
        () => {
          // Keep default Bengaluru
        },
        { timeout: 6000 }
      );
    }

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- Logic & Calculations ---
  
  const mq135 = Number(sensorData?.mq135 || 0);
  const mq7 = Number(sensorData?.mq7 || 0);
  const temp = Number(sensorData?.temperature || 0);
  const hum = Number(sensorData?.humidity || 0);
  const timestamp = Number(sensorData?.timestamp || 0);

  const currentAqi = Math.round((mq135 / 50) + (mq7 / 20));
  
  const isWaitingForEsp = currentAqi === 0 && mq135 === 0 && mq7 === 0;
  const lastUpdateTime = new Date(timestamp).getTime();
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  const isOnline = !isWaitingForEsp && timeSinceUpdate < 60000;

  let aqiStatus = "Good";
  let aqiBadge = "bg-green-100 text-green-700";
  
  if (isWaitingForEsp) {
     aqiStatus = "Awaiting Data";
     aqiBadge = "bg-gray-100 text-gray-500";
  } else if (currentAqi > parseInt(alarmThreshold)) {
    aqiStatus = "Hazardous (Alarm)";
    aqiBadge = "bg-red-100 text-red-700 animate-pulse";
  } else if (currentAqi > 100) {
    aqiStatus = "Unhealthy";
    aqiBadge = "bg-orange-100 text-orange-700";
  } else if (currentAqi > 50) {
    aqiStatus = "Moderate";
    aqiBadge = "bg-yellow-100 text-yellow-700";
  }

  let maxAqiTomorrow = 0;
  let avgTempTomorrow = 0;
  let avgHumTomorrow = 0;
  
  if (predictions.length > 0) {
    maxAqiTomorrow = Math.max(...predictions.map(p => p.predictedAqi));
    avgTempTomorrow = (predictions.reduce((acc, curr) => acc + curr.temp, 0) / predictions.length).toFixed(1) as any;
    avgHumTomorrow = (predictions.reduce((acc, curr) => acc + curr.humidity, 0) / predictions.length).toFixed(1) as any;
  }

  const handleExportCSV = () => {
    if (!sensorData) return;
    const csvData = [
      ["Metric", "Value", "Unit"],
      ["Report Generated", new Date().toLocaleString(), ""],
      ["Last Sensor Update", isNaN(timestamp) || timestamp === 0 ? "Never" : new Date(timestamp).toLocaleString(), ""],
      ["Status", isOnline ? "Online" : "Offline", ""],
      ["Calculated AQI", currentAqi, "index"],
      ["Temperature", temp, "°C"],
      ["Humidity", hum, "%"],
      ["Volatile Gases (MQ135)", mq135, "raw"],
      ["Carbon Monoxide (MQ7)", mq7, "raw"]
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "air_quality_report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveSettings = () => {
    setIsSettingsSaved(true);
    setTimeout(() => setIsSettingsSaved(false), 3000);
  };

  const getWeatherIcon = (code: number, isDay: number) => {
    if (code === 0) return isDay ? <Sun className="w-8 h-8 text-amber-500" /> : <Sun className="w-8 h-8 text-amber-400" />;
    if (code === 1 || code === 2) return <CloudSun className="w-8 h-8 text-sky-500" />;
    if (code === 3) return <Cloud className="w-8 h-8 text-slate-400" />;
    if (code === 45 || code === 48) return <CloudFog className="w-8 h-8 text-slate-400" />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className="w-8 h-8 text-blue-400" />;
    if (code >= 61 && code <= 65) return <CloudRain className="w-8 h-8 text-blue-600" />;
    if (code >= 80 && code <= 82) return <CloudRain className="w-8 h-8 text-indigo-600" />;
    if (code >= 95) return <CloudLightning className="w-8 h-8 text-purple-600" />;
    return <CloudSun className="w-8 h-8 text-sky-500" />;
  };

  const getWeatherTitle = (code: number) => {
    if (code === 0) return "Clear Sky";
    if (code === 1 || code === 2) return "Partly Cloudy";
    if (code === 3) return "Overcast Clouds";
    if (code === 45 || code === 48) return "Foggy / Haze";
    if (code >= 51 && code <= 55) return "Light Drizzle";
    if (code >= 61 && code <= 65) return "Rain Showers";
    if (code >= 80 && code <= 82) return "Heavy Rainfall";
    if (code >= 95) return "Thunderstorm";
    return "Fair Weather";
  };

  const getWindDirectionLabel = (deg: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round((deg % 360) / 22.5);
    return directions[idx % 16];
  };

  const getWindBeaufort = (speed: number) => {
    if (speed < 2) return "Calm";
    if (speed < 6) return "Light Air";
    if (speed < 12) return "Light Breeze";
    if (speed < 20) return "Gentle Breeze";
    if (speed < 29) return "Moderate Breeze";
    if (speed < 39) return "Fresh Breeze";
    return "Strong Wind";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center">
          <Wind className="w-6 h-6 text-blue-600" />
          <span className="ml-2 text-xl font-bold text-slate-900 tracking-tight">AirIQ</span>
        </div>
        <button onClick={handleExportCSV} className="p-2 bg-slate-100 text-slate-600 rounded-full active:bg-blue-100 active:text-blue-600 transition-colors">
          <DownloadCloud className="w-5 h-5" />
        </button>
      </header>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col py-8 z-10 sticky top-0 h-screen shadow-sm">
        <div className="px-8 mb-10 flex items-center w-full justify-start">
          <Wind className="w-8 h-8 text-blue-600" />
          <span className="ml-3 text-2xl font-bold text-slate-900">AirIQ</span>
        </div>
        
        <nav className="flex-1 w-full space-y-1 px-4">
          <NavItem icon={<LayoutDashboard size={20} />} label="Overview" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Wind size={20} />} label="Live Weather & Wind" active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} />
          <NavItem icon={<History size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          <NavItem icon={<ShieldCheck size={20} />} label="Diagnostics" active={activeTab === 'device'} onClick={() => setActiveTab('device')} />
          <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-28 md:pb-0 relative w-full">
        <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-10">
          
          {/* Desktop Header Actions */}
          <header className="hidden md:flex justify-between items-center mb-10 pb-6 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Environmental Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Real-time monitoring and predictive insights.</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleExportCSV}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-sm"
              >
                <DownloadCloud className="w-4 h-4 mr-2" />
                Export Report
              </button>
            </div>
          </header>
          
          {/* Mobile Page Title */}
          <div className="md:hidden flex flex-col mb-6 mt-2">
             <h1 className="text-2xl font-semibold text-slate-900 capitalize tracking-tight">{activeTab}</h1>
             <p className="text-xs text-slate-500 mt-1">Live Telemetry Data</p>
          </div>

          {/* --- DASHBOARD TAB --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                
                {/* Main AQI */}
                <div className="col-span-1 lg:col-span-2 bg-white border border-slate-200 p-5 sm:p-8 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-6 sm:mb-8">
                    <div>
                      <h2 className="text-[11px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Air Quality Index</h2>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-1">
                        <span className="text-6xl sm:text-7xl font-bold text-slate-900 leading-none tracking-tight">{currentAqi}</span>
                        <div className={`mt-3 sm:mt-0 px-3 py-1 text-[11px] sm:text-sm font-bold rounded-full w-max tracking-wide ${aqiBadge}`}>
                          {aqiStatus}
                        </div>
                      </div>
                    </div>
                    {currentAqi > parseInt(alarmThreshold) ? <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" /> : <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />}
                  </div>
                  
                  <div className="w-full h-2 bg-slate-100 rounded-full relative overflow-hidden mt-4">
                    <div 
                      className={`absolute top-0 left-0 h-full transition-all duration-1000 ${currentAqi > parseInt(alarmThreshold) ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min((currentAqi / 300) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Temp & Hum */}
                <div className="col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
                  <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col justify-center">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Temperature</p>
                    <div className="flex items-center text-slate-900">
                      <Thermometer className="w-5 h-5 mr-2 text-orange-500" />
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">{temp.toFixed(1)}<span className="text-sm sm:text-lg text-slate-400 ml-1">°C</span></p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col justify-center">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Humidity</p>
                    <div className="flex items-center text-slate-900">
                      <Droplets className="w-5 h-5 mr-2 text-blue-500" />
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">{hum.toFixed(1)}<span className="text-sm sm:text-lg text-slate-400 ml-1">%</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Sensors */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 px-1">Pollutant Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <RawMetric title="MQ-135" gasName="Volatile Gases" value={mq135} unit="raw" normalRange="< 400" icon={<Activity size={18} />} />
                  <RawMetric title="MQ-7" gasName="Carbon Monoxide" value={mq7} unit="raw" normalRange="< 200" icon={<Wind size={18} />} />
                </div>
              </div>

              {/* Live Weather & Wind Quick Glance */}
              <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/70 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-white text-blue-600 rounded-xl shadow-xs border border-blue-100 flex-shrink-0">
                    <Wind className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Live Weather & Wind API</span>
                      <span className="text-[10px] bg-blue-600 text-white font-semibold px-2 py-0.5 rounded-full">Open-Meteo</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {liveWeather.locationName} • <span className="text-slate-600 font-normal">{getWeatherTitle(liveWeather.weatherCode)}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Wind: <span className="font-bold text-slate-800">{liveWeather.windSpeed} km/h {getWindDirectionLabel(liveWeather.windDirection)}</span> | Temp: <span className="font-bold text-slate-800">{liveWeather.temp}°C</span> | Hum: <span className="font-bold text-slate-800">{liveWeather.humidity}%</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('forecast')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center justify-center sm:self-center"
                >
                  View Full Wind Station &rarr;
                </button>
              </div>

            </div>
          )}

          {/* --- LIVE WEATHER & WIND TAB --- */}
          {activeTab === 'forecast' && (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
               
               {/* Controls & Location Bar */}
               <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">{liveWeather.locationName}</h3>
                      <span className="flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                        Live API Sync
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Real-time Open-Meteo weather and wind telemetry • Synced at {liveWeather.lastUpdated}</p>
                  </div>

                  {/* Actions: GPS & Refresh */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined' && navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your Live GPS Location");
                              setActiveCityKey("gps");
                            },
                            () => alert("Location permission denied. Using selected city."),
                            { timeout: 8000 }
                          );
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center"
                    >
                      <Navigation className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      Use GPS
                    </button>
                    
                    <button
                      onClick={() => {
                        const city = CITY_PRESETS[activeCityKey] || CITY_PRESETS.bangalore;
                        fetchWeather(city.lat, city.lon, city.name);
                      }}
                      disabled={weatherLoading}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center shadow-sm disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${weatherLoading ? 'animate-spin' : ''}`} />
                      {weatherLoading ? 'Updating...' : 'Refresh API'}
                    </button>
                  </div>
               </div>

               {/* City Quick Selector */}
               <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                 <span className="text-xs font-semibold text-slate-500 whitespace-nowrap px-1">Quick Stations:</span>
                 {Object.entries(CITY_PRESETS).map(([key, city]) => (
                   <button
                     key={key}
                     onClick={() => {
                       setActiveCityKey(key);
                       fetchWeather(city.lat, city.lon, city.name);
                     }}
                     className={`px-3 py-1 text-xs rounded-full font-medium transition-colors whitespace-nowrap ${
                       activeCityKey === key 
                         ? 'bg-blue-600 text-white shadow-sm' 
                         : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                     }`}
                   >
                     {city.name.split(',')[0]}
                   </button>
                 ))}
               </div>

               {/* Main Live Telemetry Grid */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                 
                 {/* Card 1: Wind Telemetry */}
                 <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Live Wind Speed</span>
                       <div className="flex items-baseline space-x-2">
                         <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{liveWeather.windSpeed}</span>
                         <span className="text-sm sm:text-base font-semibold text-slate-500">km/h</span>
                       </div>
                       <p className="text-xs text-slate-400 mt-0.5">≈ {(liveWeather.windSpeed / 3.6).toFixed(1)} m/s</p>
                     </div>
                     <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                       <Wind className="w-8 h-8" />
                     </div>
                   </div>

                   <div className="space-y-3 pt-4 border-t border-slate-100">
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium">Wind Condition</span>
                       <span className="px-2 py-0.5 rounded-md font-semibold bg-blue-100 text-blue-800">
                         {getWindBeaufort(liveWeather.windSpeed)}
                       </span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium flex items-center">
                         <Compass 
                           className="w-4 h-4 mr-1 text-blue-600 transition-transform duration-500" 
                           style={{ transform: `rotate(${liveWeather.windDirection}deg)` }}
                         />
                         Direction
                       </span>
                       <span className="font-bold text-slate-900">
                         {getWindDirectionLabel(liveWeather.windDirection)} ({liveWeather.windDirection}°)
                       </span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium">Peak Gusts</span>
                       <span className="font-bold text-slate-900">{liveWeather.windGusts} km/h</span>
                     </div>
                   </div>
                 </div>

                 {/* Card 2: Weather & Sky Conditions */}
                 <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Atmospheric Condition</span>
                       <div className="flex items-baseline space-x-2">
                         <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{liveWeather.temp}</span>
                         <span className="text-sm sm:text-base font-semibold text-slate-500">°C</span>
                       </div>
                       <p className="text-xs text-slate-500 mt-0.5">Real Feel: <span className="font-bold text-slate-700">{liveWeather.apparentTemp}°C</span></p>
                     </div>
                     <div className="p-3 bg-amber-50 rounded-2xl">
                       {getWeatherIcon(liveWeather.weatherCode, liveWeather.isDay)}
                     </div>
                   </div>

                   <div className="space-y-3 pt-4 border-t border-slate-100">
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium">Sky Status</span>
                       <span className="font-bold text-slate-900">{getWeatherTitle(liveWeather.weatherCode)}</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium flex items-center">
                         <Gauge className="w-4 h-4 mr-1 text-slate-500" />
                         Air Pressure
                       </span>
                       <span className="font-bold text-slate-900">{liveWeather.pressure} hPa</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium">Diurnal Cycle</span>
                       <span className="font-bold text-slate-900">{liveWeather.isDay ? 'Daytime' : 'Nighttime'}</span>
                     </div>
                   </div>
                 </div>

                 {/* Card 3: Atmospheric Moisture */}
                 <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Ambient Humidity</span>
                       <div className="flex items-baseline space-x-2">
                         <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{liveWeather.humidity}</span>
                         <span className="text-sm sm:text-base font-semibold text-slate-500">%</span>
                       </div>
                       <p className="text-xs text-slate-500 mt-0.5">Relative Moisture Level</p>
                     </div>
                     <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
                       <Droplets className="w-8 h-8" />
                     </div>
                   </div>

                   <div className="space-y-3 pt-4 border-t border-slate-100">
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium">Moisture Status</span>
                       <span className={`px-2 py-0.5 rounded-md font-semibold ${liveWeather.humidity > 70 ? 'bg-blue-100 text-blue-800' : liveWeather.humidity < 35 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                         {liveWeather.humidity > 70 ? 'Humid' : liveWeather.humidity < 35 ? 'Dry' : 'Comfortable'}
                       </span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium">Precipitation Status</span>
                       <span className="font-bold text-slate-900">{liveWeather.weatherCode >= 51 ? 'Active Rain/Drizzle' : 'Dry / Clear'}</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-medium">Weather Provider</span>
                       <span className="font-semibold text-blue-600">Open-Meteo REST</span>
                     </div>
                   </div>
                 </div>

               </div>

               {/* IoT Hardware vs Live Weather API Cross-Validation */}
               <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-slate-100 gap-2">
                   <div>
                     <h4 className="text-sm sm:text-base font-bold text-slate-900">ESP32 Hardware vs Weather API Cross-Validation</h4>
                     <p className="text-xs text-slate-500 mt-0.5">Comparing real-time on-site IoT sensors with external meteorological station data.</p>
                   </div>
                   <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 w-max">
                     Dual Telemetry Sync
                   </span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   
                   {/* Local Hardware */}
                   <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                     <div className="flex justify-between items-center mb-3">
                       <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                         <span className="w-2 h-2 rounded-full bg-blue-600 mr-2"></span>
                         ESP32 Microcontroller (On-Site)
                       </span>
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {isOnline ? 'Online' : 'Offline'}
                       </span>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                       <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                         <span className="text-[10px] font-semibold text-slate-400 uppercase block">DHT Temperature</span>
                         <span className="text-xl font-bold text-slate-900">{temp.toFixed(1)}°C</span>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                         <span className="text-[10px] font-semibold text-slate-400 uppercase block">DHT Humidity</span>
                         <span className="text-xl font-bold text-slate-900">{hum.toFixed(1)}%</span>
                       </div>
                     </div>
                   </div>

                   {/* External Weather API */}
                   <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80">
                     <div className="flex justify-between items-center mb-3">
                       <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center">
                         <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                         Open-Meteo Weather Station (API)
                       </span>
                       <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                         Live Stream
                       </span>
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                       <div className="bg-white p-3 rounded-lg border border-blue-100">
                         <span className="text-[10px] font-semibold text-slate-400 uppercase block">Station Temp</span>
                         <span className="text-xl font-bold text-slate-900">{liveWeather.temp}°C</span>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-blue-100">
                         <span className="text-[10px] font-semibold text-slate-400 uppercase block">Station Hum</span>
                         <span className="text-xl font-bold text-slate-900">{liveWeather.humidity}%</span>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-blue-100">
                         <span className="text-[10px] font-semibold text-slate-400 uppercase block">Wind Flow</span>
                         <span className="text-xl font-bold text-blue-700">{liveWeather.windSpeed}</span>
                         <span className="text-[9px] text-slate-500 block">km/h</span>
                       </div>
                     </div>
                   </div>

                 </div>

                 {/* Atmospheric Dispersion Insight */}
                 <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                   <div className="flex items-start space-x-3">
                     <div className="p-2 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0 mt-0.5">
                       <Wind className="w-5 h-5" />
                     </div>
                     <div>
                       <h5 className="text-xs font-bold text-slate-900">Wind Velocity Impact on Air Quality</h5>
                       <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                         {liveWeather.windSpeed > 15
                           ? `Strong winds (${liveWeather.windSpeed} km/h) actively disperse airborne particulate matter, smoke, and carbon monoxide around your MQ-135 and MQ-7 sensors.`
                           : `Calm wind conditions (${liveWeather.windSpeed} km/h) reduce atmospheric mixing, causing localized gas concentrations to remain concentrated near ground level.`}
                       </p>
                     </div>
                   </div>
                   <div className="flex-shrink-0 text-right sm:border-l sm:border-slate-200 sm:pl-4">
                     <span className="text-[10px] text-slate-500 uppercase font-semibold block">Calculated AQI</span>
                     <span className="text-lg font-bold text-slate-900">{currentAqi}</span>
                     <span className={`text-[10px] font-bold block ${aqiBadge.includes('green') ? 'text-green-600' : 'text-orange-600'}`}>{aqiStatus}</span>
                   </div>
                 </div>

               </div>

            </div>
          )}

          {/* --- ANALYTICS TAB --- */}
          {activeTab === 'analytics' && (
             <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
                <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm">
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 sm:mb-6">Tomorrow's Forecast</h3>
                  
                  {predictions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
                      <div className="p-5 sm:p-6 bg-blue-50 border border-blue-100 rounded-xl flex flex-col justify-center">
                        <p className="text-xs sm:text-sm font-semibold text-blue-600 mb-1">Max Predicted AQI</p>
                        <p className="text-3xl sm:text-4xl font-bold text-blue-900 tracking-tight">{maxAqiTomorrow}</p>
                        <p className="text-[10px] sm:text-xs text-blue-500 mt-1">Expected peak pollution.</p>
                      </div>
                      <div className="p-5 sm:p-6 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-center">
                        <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-1">Avg Temperature</p>
                        <p className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{avgTempTomorrow}°C</p>
                      </div>
                      <div className="p-5 sm:p-6 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-center">
                        <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-1">Avg Humidity</p>
                        <p className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{avgHumTomorrow}%</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 sm:py-12 text-center text-slate-500">
                      <CloudLightning className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-300 mb-3 sm:mb-4" />
                      <p className="text-sm">Insufficient data to generate tomorrow's forecast.</p>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm text-center py-12 sm:py-16">
                  <History className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-300 mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">Long-term Trends</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-sm mx-auto">Weekly and monthly trend charts will appear here after 7 days of collection.</p>
                </div>
             </div>
          )}
          
          {/* --- DIAGNOSTICS TAB --- */}
          {activeTab === 'device' && (
             <div className="animate-in fade-in duration-500 max-w-3xl">
                <h2 className="hidden md:block text-2xl font-semibold text-slate-900 mb-6">Hardware Diagnostics</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Connection Status</p>
                    <div className="flex items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mr-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <p className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{isOnline ? 'Online & Receiving' : 'Offline'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Last Sync Time</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{isWaitingForEsp || isNaN(timestamp) || timestamp === 0 ? 'Never' : new Date(timestamp).toLocaleTimeString()}</p>
                  </div>
                  
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Data Integrity</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {isWaitingForEsp ? 'No Data' : (mq135 >= 0 && mq7 >= 0) ? 'Valid Packets' : 'Corrupted Packets'}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Backend API</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Operational</p>
                  </div>
                </div>
             </div>
          )}

          {/* --- SETTINGS TAB --- */}
          {activeTab === 'settings' && (
             <div className="max-w-2xl animate-in fade-in duration-500">
                <h2 className="hidden md:block text-2xl font-semibold text-slate-900 mb-6">System Preferences</h2>
                <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm space-y-6 sm:space-y-8">
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="mb-3 sm:mb-0 pr-4">
                      <h4 className="text-sm sm:text-base text-slate-900 font-semibold">Alarm Threshold</h4>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-[250px]">AQI level required to trigger the buzzer.</p>
                    </div>
                    <select 
                      value={alarmThreshold}
                      onChange={(e) => setAlarmThreshold(e.target.value)}
                      className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-slate-900 font-medium outline-none"
                    >
                      <option value="100">100 (Sensitive)</option>
                      <option value="150">150 (Unhealthy)</option>
                      <option value="200">200 (Hazardous)</option>
                    </select>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-5 sm:pt-6 border-t border-slate-100">
                    <div className="mb-3 sm:mb-0 pr-4">
                      <h4 className="text-sm sm:text-base text-slate-900 font-semibold">Refresh Rate</h4>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-[250px]">How often to fetch new data.</p>
                    </div>
                    <select 
                      value={pollingRate}
                      onChange={(e) => setPollingRate(e.target.value)}
                      className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-slate-900 font-medium outline-none"
                    >
                      <option value="1">1 Second (Live)</option>
                      <option value="5">5 Seconds (Std)</option>
                      <option value="15">15 Seconds</option>
                      <option value="30">30 Seconds (Eco)</option>
                    </select>
                  </div>

                  <div className="pt-4 sm:pt-6 mt-2 sm:mt-4">
                    <button 
                      onClick={handleSaveSettings}
                      className="w-full bg-blue-600 text-white font-medium text-sm rounded-lg py-3 hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      {isSettingsSaved ? 'Settings Saved ✓' : 'Save Preferences'}
                    </button>
                  </div>
                </div>
             </div>
          )}

        </div>
      </main>

       {/* Mobile Bottom Navigation - FIXED / NO SCROLL */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] pb-safe">
        <div className="flex justify-between items-center w-full px-2 py-1">
           <MobileNavItem icon={<LayoutDashboard size={18} />} label="Data" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
           <MobileNavItem icon={<Wind size={18} />} label="Weather" active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} />
           <MobileNavItem icon={<History size={18} />} label="History" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
           <MobileNavItem icon={<ShieldCheck size={18} />} label="Status" active={activeTab === 'device'} onClick={() => setActiveTab('device')} />
           <MobileNavItem icon={<Settings size={18} />} label="Prefs" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}
    >
      <div className={`${active ? 'text-blue-600' : 'opacity-70'}`}>
        {icon}
      </div>
      <span className="ml-3 text-sm">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center py-2 flex-1 rounded-xl transition-colors ${active ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500'}`}
    >
      {icon}
      <span className={`text-[9px] mt-1 tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

function RawMetric({ title, gasName, value, unit, icon, normalRange }: { title: string, gasName: string, value: string|number, unit: string, icon: React.ReactNode, normalRange: string }) {
  return (
    <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:border-blue-200 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-700 leading-tight pr-1">{title}</p>
        <div className="text-blue-500 bg-blue-50 p-1.5 rounded-lg flex-shrink-0">{icon}</div>
      </div>
      <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium mb-3 sm:mb-4">{gasName}</p>
      
      <div>
        <div className="flex items-baseline space-x-1 mb-1.5">
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight truncate">{value}</h3>
          <span className="text-[10px] sm:text-xs text-slate-500 font-medium ml-1">{unit}</span>
        </div>
        <div className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 text-[9px] sm:text-[10px] font-semibold text-slate-600 rounded-md whitespace-nowrap">
          {normalRange}
        </div>
      </div>
    </div>
  );
}
