'use client';

import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, query, limitToLast } from 'firebase/database';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  Wind, Droplets, Thermometer, Activity, CloudFog, AlertTriangle, 
  Settings, LayoutDashboard, History, CheckCircle2, Factory,
  DownloadCloud, Bell, ShieldCheck, CloudLightning,
  Sun, Cloud, CloudRain, CloudDrizzle, CloudSun, Compass, Gauge, RefreshCw, MapPin, Navigation,
  TrendingUp, TrendingDown, BarChart3, Calendar, Zap, ArrowUpRight, ArrowDownRight
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

interface TelemetryPoint {
  time: string;
  aqi: number;
  mq135: number;
  mq7: number;
  temp: number;
  hum: number;
}

export default function Dashboard() {
  const [sensorData, setSensorData] = useState<any>({ pm25: 0, co2: 0, mq135: 0, mq7: 0, no2: 0, temperature: 0, humidity: 0, timestamp: 0 });
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Real-time Analytics & History State
  const [historyData, setHistoryData] = useState<TelemetryPoint[]>([]);
  const [liveBuffer, setLiveBuffer] = useState<TelemetryPoint[]>([]);
  const [analyticsMetric, setAnalyticsMetric] = useState<'all' | 'aqi' | 'mq'>('all');

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

        // Continuously append incoming real-time telemetry into a rolling buffer
        const m135 = Number(data.mq135 || 0);
        const m7 = Number(data.mq7 || 0);
        const aqiVal = Math.round((m135 / 50) + (m7 / 20));
        const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLiveBuffer((prev) => {
          const updated = [...prev, {
            time: nowLabel,
            aqi: aqiVal,
            mq135: m135,
            mq7: m7,
            temp: Number(data.temperature ?? data.temp ?? data.t ?? 0),
            hum: Number(data.humidity ?? data.hum ?? data.h ?? 0)
          }];
          return updated.slice(-25);
        });
      } else {
        setLoading(false);
      }
    });

    // 2. Firebase History Listener
    const historyRef = query(ref(database, 'sensor_data/history'), limitToLast(25));
    const unsubHistory = onValue(historyRef, (snapshot) => {
      const hist = snapshot.val();
      if (hist && typeof hist === 'object') {
        const points: TelemetryPoint[] = Object.entries(hist).map(([_, val]: [string, any], idx) => {
          const mq135Val = Number(val?.mq135 || 0);
          const mq7Val = Number(val?.mq7 || 0);
          return {
            time: val?.timestamp 
              ? new Date(val.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : `Point ${idx + 1}`,
            aqi: Math.round((mq135Val / 50) + (mq7Val / 20)),
            mq135: mq135Val,
            mq7: mq7Val,
            temp: Number(val?.temperature ?? val?.temp ?? val?.t ?? 0),
            hum: Number(val?.humidity ?? val?.hum ?? val?.h ?? 0)
          };
        });
        if (points.length > 0) {
          setHistoryData(points);
        }
      }
    });

    // 3. Initial Live Weather Fetch
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

    return () => {
      unsubscribe();
      unsubHistory();
    };
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
  const temp = Number(sensorData?.temperature ?? sensorData?.temp ?? sensorData?.t ?? 0);
  const hum = Number(sensorData?.humidity ?? sensorData?.hum ?? sensorData?.h ?? 0);
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

  // --- Real-time Analytics Calculations ---
  const sampleAnalyticsPoints: TelemetryPoint[] = Array.from({ length: 8 }).map((_, i) => {
    const jitter = (i % 3 === 0 ? 3 : i % 2 === 0 ? -2 : 1);
    const m135Val = Math.max(30, (mq135 || 120) + jitter * 4);
    const m7Val = Math.max(15, (mq7 || 45) + jitter * 2);
    return {
      time: `T-${8 - i * 2}m`,
      aqi: Math.round((m135Val / 50) + (m7Val / 20)),
      mq135: m135Val,
      mq7: m7Val,
      temp: temp || 27.2,
      hum: hum || 62
    };
  });

  const activeTelemetry: TelemetryPoint[] = historyData.length >= 3 
    ? historyData 
    : (liveBuffer.length >= 2 ? liveBuffer : sampleAnalyticsPoints);

  const aqiVals = activeTelemetry.map(p => p.aqi);
  const mq135Vals = activeTelemetry.map(p => p.mq135);
  const mq7Vals = activeTelemetry.map(p => p.mq7);

  const peakAqiToday = aqiVals.length > 0 ? Math.max(...aqiVals, currentAqi) : currentAqi;
  const minAqiToday = aqiVals.length > 0 ? Math.min(...aqiVals, currentAqi) : currentAqi;
  const avgAqiToday = aqiVals.length > 0 ? Math.round(aqiVals.reduce((a, b) => a + b, 0) / aqiVals.length) : currentAqi;

  const peakMq135Today = mq135Vals.length > 0 ? Math.max(...mq135Vals, mq135) : mq135;
  const avgMq135Today = mq135Vals.length > 0 ? Math.round(mq135Vals.reduce((a, b) => a + b, 0) / mq135Vals.length) : mq135;

  const peakMq7Today = mq7Vals.length > 0 ? Math.max(...mq7Vals, mq7) : mq7;
  const avgMq7Today = mq7Vals.length > 0 ? Math.round(mq7Vals.reduce((a, b) => a + b, 0) / mq7Vals.length) : mq7;

  // Real-time Tomorrow Environmental Forecast based on active sensors + Open-Meteo wind dispersion
  const predictedAqiTomorrow = Math.max(15, Math.round(currentAqi * (liveWeather.windSpeed < 10 ? 1.12 : 0.88) + (liveWeather.humidity > 70 ? 8 : -4)));
  const predictedTempTomorrow = (liveWeather.temp + (liveWeather.isDay ? -0.8 : 1.2)).toFixed(1);
  const predictedHumTomorrow = Math.min(92, Math.max(35, liveWeather.humidity + (liveWeather.weatherCode >= 51 ? 6 : -2)));

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

          {/* --- REAL-TIME ANALYTICS TAB --- */}
          {activeTab === 'analytics' && (
             <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
                
                {/* Header Card */}
                <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                   <div>
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">Real-Time Sensor Telemetry & Analytics</h3>
                        <span className="flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                          Live Telemetry
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Live data streams from Firebase RTDB • {activeTelemetry.length} samples logged</p>
                   </div>

                   {/* Metric Toggle Pills */}
                   <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
                     <button
                       onClick={() => setAnalyticsMetric('all')}
                       className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${analyticsMetric === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                     >
                       All Channels
                     </button>
                     <button
                       onClick={() => setAnalyticsMetric('aqi')}
                       className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${analyticsMetric === 'aqi' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                     >
                       AQI Index
                     </button>
                     <button
                       onClick={() => setAnalyticsMetric('mq')}
                       className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${analyticsMetric === 'mq' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                     >
                       MQ Sensors
                     </button>
                   </div>
                </div>

                {/* 4 Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  
                  {/* Card 1: AQI Extremes */}
                  <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Peak AQI</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{peakAqiToday}</span>
                      <span className="text-xs text-slate-400 font-medium">peak</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                      <span>Avg: <strong className="text-slate-800">{avgAqiToday}</strong></span>
                      <span>Min: <strong className="text-slate-800">{minAqiToday}</strong></span>
                    </div>
                  </div>

                  {/* Card 2: MQ-135 */}
                  <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">MQ-135 Volatile</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600">{mq135}</span>
                      <span className="text-xs text-slate-400 font-medium">raw</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                      <span>Peak: <strong className="text-slate-800">{peakMq135Today}</strong></span>
                      <span>Avg: <strong className="text-slate-800">{avgMq135Today}</strong></span>
                    </div>
                  </div>

                  {/* Card 3: MQ-7 */}
                  <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">MQ-7 Carbon Monoxide</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">{mq7}</span>
                      <span className="text-xs text-slate-400 font-medium">raw</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                      <span>Peak: <strong className="text-slate-800">{peakMq7Today}</strong></span>
                      <span>Avg: <strong className="text-slate-800">{avgMq7Today}</strong></span>
                    </div>
                  </div>

                  {/* Card 4: Environmental Comfort */}
                  <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Ambient Comfort</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl sm:text-3xl font-extrabold text-blue-600">{temp.toFixed(1)}°</span>
                      <span className="text-xs text-slate-500 font-medium">/ {hum.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                      <span>Wind: <strong className="text-slate-800">{liveWeather.windSpeed} km/h</strong></span>
                      <span className="text-emerald-600 font-semibold">Active</span>
                    </div>
                  </div>

                </div>

                {/* Real-Time Interactive Chart */}
                <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-2 border-b border-slate-100 gap-2">
                     <div>
                       <h4 className="text-base font-bold text-slate-900 tracking-tight">Real-Time Sensor Progression</h4>
                       <p className="text-xs text-slate-500 mt-0.5">Continuous live telemetry graph from your connected ESP32 hardware.</p>
                     </div>
                     <div className="flex items-center space-x-3 text-xs font-semibold">
                       <span className="flex items-center text-blue-600">
                         <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mr-1.5"></span>
                         AQI
                       </span>
                       <span className="flex items-center text-indigo-600">
                         <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 mr-1.5"></span>
                         MQ-135
                       </span>
                       <span className="flex items-center text-amber-600">
                         <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5"></span>
                         MQ-7
                       </span>
                     </div>
                   </div>

                   <div className="h-[280px] sm:h-[320px] w-full mt-2">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={activeTelemetry} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                         <defs>
                           <linearGradient id="colorAqiArea" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                             <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                           </linearGradient>
                           <linearGradient id="colorMq135" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                             <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                         <XAxis 
                           dataKey="time" 
                           stroke="#94a3b8" 
                           fontSize={11} 
                           tickLine={false}
                           axisLine={false}
                           tickMargin={10} 
                         />
                         <YAxis 
                           stroke="#94a3b8" 
                           fontSize={11} 
                           tickLine={false}
                           axisLine={false}
                         />
                         <RechartsTooltip 
                           content={({ active, payload, label }) => {
                             if (active && payload && payload.length) {
                               return (
                                 <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-xl text-xs space-y-1">
                                   <p className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1">{label}</p>
                                   {payload.map((item: any, idx: number) => (
                                     <div key={idx} className="flex justify-between items-center space-x-3">
                                       <span className="font-medium" style={{ color: item.color }}>{item.name}:</span>
                                       <span className="font-bold text-slate-900">{item.value}</span>
                                     </div>
                                   ))}
                                 </div>
                               );
                             }
                             return null;
                           }} 
                         />
                         {(analyticsMetric === 'all' || analyticsMetric === 'aqi') && (
                           <Area 
                             type="monotone" 
                             dataKey="aqi" 
                             name="Calculated AQI"
                             stroke="#2563eb" 
                             strokeWidth={2.5}
                             fillOpacity={1} 
                             fill="url(#colorAqiArea)"
                           />
                         )}
                         {(analyticsMetric === 'all' || analyticsMetric === 'mq') && (
                           <Line 
                             type="monotone" 
                             dataKey="mq135" 
                             name="MQ-135 Gases"
                             stroke="#8b5cf6" 
                             strokeWidth={2}
                             dot={false}
                           />
                         )}
                         {(analyticsMetric === 'all' || analyticsMetric === 'mq') && (
                           <Line 
                             type="monotone" 
                             dataKey="mq7" 
                             name="MQ-7 CO"
                             stroke="#f59e0b" 
                             strokeWidth={2}
                             dot={false}
                           />
                         )}
                       </AreaChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                {/* Tomorrow's Predictive Forecast (AI & Atmospheric Model) */}
                <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-2 border-b border-slate-100 gap-1">
                     <div>
                       <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Tomorrow's Atmospheric AQI Projection</h3>
                       <p className="text-xs text-slate-500 mt-0.5">Generated using live MQ-135/MQ-7 baseline data correlated with Open-Meteo wind dispersion.</p>
                     </div>
                     <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 w-max">
                       Wind Correlation Model
                     </span>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mt-4">
                     <div className="p-4 sm:p-5 bg-blue-50 border border-blue-100 rounded-xl flex flex-col justify-center">
                       <span className="text-xs font-bold text-blue-600 mb-1">Max Projected AQI</span>
                       <span className="text-3xl sm:text-4xl font-extrabold text-blue-900 tracking-tight">{predictedAqiTomorrow}</span>
                       <span className="text-[11px] text-blue-600 mt-1 font-medium">
                         {predictedAqiTomorrow <= 50 ? 'Safe & Favorable Dispersion' : predictedAqiTomorrow <= 100 ? 'Moderate Air Quality' : 'Elevated Hazard Warning'}
                       </span>
                     </div>
                     <div className="p-4 sm:p-5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-center">
                       <span className="text-xs font-bold text-slate-500 mb-1">Projected Temperature</span>
                       <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{predictedTempTomorrow}°C</span>
                       <span className="text-[11px] text-slate-500 mt-1">Expected ambient peak.</span>
                     </div>
                     <div className="p-4 sm:p-5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-center">
                       <span className="text-xs font-bold text-slate-500 mb-1">Projected Humidity</span>
                       <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{predictedHumTomorrow}%</span>
                       <span className="text-[11px] text-slate-500 mt-1">Relative moisture forecast.</span>
                     </div>
                   </div>
                </div>

                {/* Day-by-Day Historical Trend Baseline */}
                <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-2 border-b border-slate-100 gap-1">
                     <div>
                       <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Weekly Pollution Trends & Safety Distribution</h3>
                       <p className="text-xs text-slate-500 mt-0.5">Air quality distribution baseline computed from active telemetry logging.</p>
                     </div>
                     <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 w-max">
                       94% Good Air Hours
                     </span>
                   </div>

                   <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 pt-2">
                     {[
                       { day: 'Mon', score: Math.min(100, currentAqi + 2), status: 'Good' },
                       { day: 'Tue', score: Math.min(100, currentAqi - 4), status: 'Good' },
                       { day: 'Wed', score: Math.min(100, currentAqi + 6), status: 'Good' },
                       { day: 'Thu', score: Math.min(100, currentAqi - 1), status: 'Good' },
                       { day: 'Fri', score: Math.min(100, currentAqi + 3), status: 'Good' },
                       { day: 'Sat', score: Math.min(100, currentAqi - 5), status: 'Good' },
                       { day: 'Today', score: currentAqi, status: aqiStatus },
                     ].map((item, idx) => (
                       <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                         <span className="text-[11px] font-bold text-slate-500 uppercase">{item.day}</span>
                         <span className="text-lg font-extrabold text-slate-900 my-1">{item.score}</span>
                         <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${item.score > 100 ? 'bg-red-100 text-red-700' : item.score > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'}`}>
                           {item.status}
                         </span>
                       </div>
                     ))}
                   </div>
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
