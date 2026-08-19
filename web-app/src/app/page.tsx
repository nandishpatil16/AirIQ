'use client';

import { useEffect, useState } from 'react';
import AqiChart from '@/components/AqiChart';
import { 
  Wind, Droplets, Thermometer, Activity, CloudFog, AlertTriangle, 
  Settings, LayoutDashboard, History, CheckCircle2, Factory,
  DownloadCloud, Bell, ShieldCheck, CloudLightning
} from 'lucide-react';

export default function Dashboard() {
  const [sensorData, setSensorData] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Settings State
  const [alarmThreshold, setAlarmThreshold] = useState('150');
  const [pollingRate, setPollingRate] = useState('5');
  const [isSettingsSaved, setIsSettingsSaved] = useState(false);

  const fetchData = async () => {
    try {
      const [sensorRes, predictRes] = await Promise.all([
        fetch('/api/sensor-data', { cache: 'no-store' }),
        fetch('/api/predict', { cache: 'no-store' })
      ]);
      
      const current = await sensorRes.json();
      const pred = await predictRes.json();

      setSensorData(current);
      if (pred.success && pred.predictions) {
        setPredictions(pred.predictions);
      } else {
        setPredictions([]); 
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, parseInt(pollingRate) * 1000); 
    return () => clearInterval(interval);
  }, [pollingRate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- Logic & Calculations ---
  
  const currentAqi = Math.round((sensorData.pm25 * 2) + (sensorData.co2 / 20) + (sensorData.mq135 / 50));
  
  // Real Connection Status
  const isWaitingForEsp = currentAqi === 0 && sensorData.pm25 === 0 && sensorData.co2 === 0;
  const lastUpdateTime = new Date(sensorData.timestamp).getTime();
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  const isOnline = !isWaitingForEsp && timeSinceUpdate < 60000; // Connected if updated in last 60s

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

  // Analytics tab calculations (Tomorrow's Forecast)
  let maxAqiTomorrow = 0;
  let avgTempTomorrow = 0;
  let avgHumTomorrow = 0;
  
  if (predictions.length > 0) {
    maxAqiTomorrow = Math.max(...predictions.map(p => p.predictedAqi));
    avgTempTomorrow = (predictions.reduce((acc, curr) => acc + curr.temp, 0) / predictions.length).toFixed(1) as any;
    avgHumTomorrow = (predictions.reduce((acc, curr) => acc + curr.humidity, 0) / predictions.length).toFixed(1) as any;
  }

  // --- Actions ---

  const handleExportCSV = () => {
    if (!sensorData) return;
    const csvData = [
      ["Metric", "Value", "Unit"],
      ["Report Generated", new Date().toLocaleString(), ""],
      ["Last Sensor Update", new Date(sensorData.timestamp).toLocaleString(), ""],
      ["Status", isOnline ? "Online" : "Offline", ""],
      ["Calculated AQI", currentAqi, "index"],
      ["Temperature", sensorData.temperature, "°C"],
      ["Humidity", sensorData.humidity, "%"],
      ["Particulate Matter (PM2.5)", sensorData.pm25, "µg/m³"],
      ["Carbon Dioxide (CO2)", sensorData.co2, "ppm"],
      ["VOCs (MQ135)", sensorData.mq135, "raw"],
      ["Nitrogen Dioxide (NO2)", sensorData.no2, "raw"]
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center">
          <Wind className="w-6 h-6 text-blue-600" />
          <span className="ml-2 text-xl font-semibold text-slate-900">AirIQ</span>
        </div>
      </header>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col py-8 z-10 sticky top-0 h-screen shadow-sm">
        <div className="px-8 mb-10 flex items-center w-full justify-start">
          <Wind className="w-8 h-8 text-blue-600" />
          <span className="ml-3 text-2xl font-bold text-slate-900">AirIQ</span>
        </div>
        
        <nav className="flex-1 w-full space-y-1 px-4">
          <NavItem icon={<LayoutDashboard size={20} />} label="Overview" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<CloudLightning size={20} />} label="Forecast" active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} />
          <NavItem icon={<History size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          <NavItem icon={<ShieldCheck size={20} />} label="Diagnostics" active={activeTab === 'device'} onClick={() => setActiveTab('device')} />
          <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 relative">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10">
          
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
          
          {/* Mobile Page Title & Export */}
          <div className="md:hidden flex justify-between items-center mb-6 mt-2">
             <h1 className="text-2xl font-semibold text-slate-900 capitalize">{activeTab}</h1>
             <button onClick={handleExportCSV} className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <DownloadCloud className="w-5 h-5" />
             </button>
          </div>

          {/* --- DASHBOARD TAB --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main AQI */}
                <div className="col-span-1 lg:col-span-2 bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Air Quality Index</h2>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2">
                        <span className="text-6xl sm:text-7xl font-bold text-slate-900 leading-none">{currentAqi}</span>
                        <div className={`mt-3 sm:mt-0 px-3 py-1 text-sm font-medium rounded-full w-max ${aqiBadge}`}>
                          {aqiStatus}
                        </div>
                      </div>
                    </div>
                    {currentAqi > parseInt(alarmThreshold) ? <AlertTriangle className="w-10 h-10 text-red-500" /> : <CheckCircle2 className="w-10 h-10 text-green-500" />}
                  </div>
                  
                  <div className="w-full h-2 bg-slate-100 rounded-full relative overflow-hidden">
                    <div 
                      className={`absolute top-0 left-0 h-full transition-all duration-1000 ${currentAqi > parseInt(alarmThreshold) ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min((currentAqi / 300) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Temp & Hum */}
                <div className="col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col justify-center">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Temperature</p>
                    <div className="flex items-center text-slate-900">
                      <Thermometer className="w-5 h-5 mr-2 text-orange-500" />
                      <p className="text-3xl font-semibold">{sensorData.temperature.toFixed(1)}<span className="text-lg text-slate-400 ml-1">°C</span></p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col justify-center">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Humidity</p>
                    <div className="flex items-center text-slate-900">
                      <Droplets className="w-5 h-5 mr-2 text-blue-500" />
                      <p className="text-3xl font-semibold">{sensorData.humidity.toFixed(1)}<span className="text-lg text-slate-400 ml-1">%</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Sensors */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-4">Detailed Pollutant Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <RawMetric title="PM 2.5" gasName="Fine Particles" value={sensorData.pm25} unit="µg/m³" normalRange="Safe: < 12.0" icon={<CloudFog size={20} />} />
                  <RawMetric title="CO₂" gasName="Carbon Dioxide" value={sensorData.co2} unit="ppm" normalRange="Safe: 400 - 1000" icon={<Wind size={20} />} />
                  <RawMetric title="MQ-135" gasName="Volatile Gases" value={sensorData.mq135} unit="raw" normalRange="Safe: < 400" icon={<Activity size={20} />} />
                  <RawMetric title="NO₂" gasName="Nitrogen Dioxide" value={sensorData.no2} unit="raw" normalRange="Safe: < 200" icon={<Factory size={20} />} />
                </div>
              </div>

            </div>
          )}

          {/* --- FORECAST TAB --- */}
          {activeTab === 'forecast' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                 
                 <div className="col-span-1 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Live Weather API</h3>
                    <p className="text-sm text-slate-500 mb-6">Meteorological data driving the AI predictions.</p>
                    
                    <div className="space-y-4">
                       <div className="p-4 bg-slate-50 rounded-xl">
                         <label className="text-xs font-medium text-slate-500 block mb-1">API Wind Speed</label>
                         <p className="text-2xl font-semibold text-slate-900">
                           {predictions.length > 0 ? predictions[0].windSpeed : '--'} <span className="text-sm text-slate-500">km/h</span>
                         </p>
                       </div>
                       <div className="p-4 bg-slate-50 rounded-xl">
                         <label className="text-xs font-medium text-slate-500 block mb-1">API Humidity</label>
                         <p className="text-2xl font-semibold text-slate-900">
                           {predictions.length > 0 ? predictions[0].humidity : '--'} <span className="text-sm text-slate-500">%</span>
                         </p>
                       </div>
                    </div>
                 </div>

                 <div className="col-span-1 lg:col-span-3 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-900">24-Hour Prediction Trend</h3>
                    <p className="text-sm text-slate-500">Interactive forecast based on current emissions and incoming weather.</p>
                  </div>
                  <div className="h-[300px] w-full">
                     <AqiChart data={predictions} />
                  </div>
                </div>
               </div>
            </div>
          )}

          {/* --- ANALYTICS TAB --- */}
          {activeTab === 'analytics' && (
             <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900 mb-6">Tomorrow's Environmental Forecast</h3>
                  
                  {predictions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-blue-50 border border-blue-100 rounded-xl text-center">
                        <p className="text-sm font-medium text-blue-600 mb-2">Max Predicted AQI</p>
                        <p className="text-4xl font-bold text-blue-900">{maxAqiTomorrow}</p>
                        <p className="text-xs text-blue-500 mt-2">Peak pollution level expected.</p>
                      </div>
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-xl text-center">
                        <p className="text-sm font-medium text-slate-600 mb-2">Avg Temperature</p>
                        <p className="text-4xl font-bold text-slate-900">{avgTempTomorrow}°C</p>
                      </div>
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-xl text-center">
                        <p className="text-sm font-medium text-slate-600 mb-2">Avg Humidity</p>
                        <p className="text-4xl font-bold text-slate-900">{avgHumTomorrow}%</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500">
                      <CloudLightning className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                      <p>Insufficient baseline data to generate tomorrow's forecast.</p>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm text-center py-16">
                  <History className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900">Long-term Trends</h3>
                  <p className="text-slate-500 mt-2 max-w-md mx-auto">Weekly and monthly trend charts will appear here after the system has collected data for at least 7 days.</p>
                </div>
             </div>
          )}
          
          {/* --- DIAGNOSTICS TAB --- */}
          {activeTab === 'device' && (
             <div className="animate-in fade-in duration-500 max-w-3xl">
                <h2 className="hidden md:block text-2xl font-semibold text-slate-900 mb-6">Hardware Diagnostics</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Connection Status</p>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <p className="text-lg font-semibold text-slate-900">{isOnline ? 'Online & Receiving' : 'Offline'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Last Sync Time</p>
                    <p className="text-lg font-semibold text-slate-900">{isWaitingForEsp ? 'Never' : new Date(sensorData.timestamp).toLocaleTimeString()}</p>
                  </div>
                  
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Data Integrity</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {isWaitingForEsp ? 'No Data' : (sensorData.pm25 >= 0 && sensorData.co2 >= 0) ? 'Valid Packets' : 'Corrupted Packets'}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Backend API Status</p>
                    <p className="text-lg font-semibold text-slate-900">Operational</p>
                  </div>
                </div>
             </div>
          )}

          {/* --- SETTINGS TAB --- */}
          {activeTab === 'settings' && (
             <div className="max-w-2xl animate-in fade-in duration-500">
                <h2 className="hidden md:block text-2xl font-semibold text-slate-900 mb-6">System Preferences</h2>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-8">
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div className="mb-4 md:mb-0 pr-4">
                      <h4 className="text-base text-slate-900 font-medium">Hardware Alarm Threshold</h4>
                      <p className="text-sm text-slate-500 mt-1">AQI level required to trigger the physical buzzer.</p>
                    </div>
                    <select 
                      value={alarmThreshold}
                      onChange={(e) => setAlarmThreshold(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 font-medium outline-none"
                    >
                      <option value="100">100 (Sensitive)</option>
                      <option value="150">150 (Unhealthy)</option>
                      <option value="200">200 (Hazardous)</option>
                    </select>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-6 border-t border-slate-100">
                    <div className="mb-4 md:mb-0 pr-4">
                      <h4 className="text-base text-slate-900 font-medium">Dashboard Refresh Rate</h4>
                      <p className="text-sm text-slate-500 mt-1">How often the web interface fetches new data.</p>
                    </div>
                    <select 
                      value={pollingRate}
                      onChange={(e) => setPollingRate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 font-medium outline-none"
                    >
                      <option value="1">1 Second (Real-time)</option>
                      <option value="5">5 Seconds (Standard)</option>
                      <option value="15">15 Seconds</option>
                      <option value="30">30 Seconds (Eco)</option>
                    </select>
                  </div>

                  <div className="pt-6 mt-4">
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center z-50 px-1 pb-safe pt-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
         <MobileNavItem icon={<LayoutDashboard size={22} />} label="Overview" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
         <MobileNavItem icon={<CloudLightning size={22} />} label="Forecast" active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} />
         <MobileNavItem icon={<ShieldCheck size={22} />} label="Diag" active={activeTab === 'device'} onClick={() => setActiveTab('device')} />
         <MobileNavItem icon={<Settings size={22} />} label="Prefs" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
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
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 w-1/4 ${active ? 'text-blue-600' : 'text-slate-400'}`}>
      {icon}
      <span className={`text-[10px] mt-1 ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

function RawMetric({ title, gasName, value, unit, icon, normalRange }: { title: string, gasName: string, value: string|number, unit: string, icon: React.ReactNode, normalRange: string }) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:border-blue-200 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
        <div className="text-blue-500 bg-blue-50 p-1.5 rounded-lg">{icon}</div>
      </div>
      <p className="text-[10px] text-slate-500 font-medium mb-4">{gasName}</p>
      
      <div>
        <div className="flex items-baseline space-x-1 mb-1.5">
          <h3 className="text-3xl font-bold text-slate-900 truncate">{value}</h3>
          <span className="text-xs text-slate-500 font-medium ml-1">{unit}</span>
        </div>
        <div className="inline-block px-2 py-1 bg-slate-100 text-[10px] font-medium text-slate-600 rounded-md">
          {normalRange}
        </div>
      </div>
    </div>
  );
}
