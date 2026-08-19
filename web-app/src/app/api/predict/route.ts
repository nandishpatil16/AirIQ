import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. Fetch current sensor data from our own API (memory)
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const sensorRes = await fetch(`${baseUrl}/api/sensor-data`, { cache: 'no-store' });
    const currentData = await sensorRes.json();

    // If no real data from ESP yet (all 0), don't fake a prediction
    if (currentData.pm25 === 0 && currentData.co2 === 0 && currentData.mq135 === 0) {
      return NextResponse.json({ success: true, predictions: [], message: "Waiting for ESP32 baseline data" }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      });
    }

    // 2. Fetch real weather forecast from Open-Meteo API (No API key required)
    // Using London coordinates for demonstration: 51.5074 N, 0.1278 W
    const weatherRes = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&forecast_days=2'
    );
    const weatherData = await weatherRes.json();

    // 3. Generate predictions for the next 24 hours using REAL API data
    const predictions = [];
    const currentHour = new Date().getHours();
    
    // Baseline "AQI" proxy based on ESP32's actual PM2.5 and CO2
    let currentAqiBase = (currentData.pm25 * 2) + (currentData.co2 / 20) + (currentData.mq135 / 50);

    for (let i = 0; i < 24; i++) {
      const forecastIndex = currentHour + i;
      
      // Extract exact data from the Weather API
      const apiWindSpeed = weatherData.hourly.wind_speed_10m[forecastIndex];
      const apiHumidity = weatherData.hourly.relative_humidity_2m[forecastIndex];
      const apiTemp = weatherData.hourly.temperature_2m[forecastIndex];
      const time = weatherData.hourly.time[forecastIndex];

      // Simple heuristic calculation using API weather data
      let predictedAqi = currentAqiBase;
      
      // Wind disperses pollution
      if (apiWindSpeed > 15) predictedAqi -= 15;
      else if (apiWindSpeed < 5) predictedAqi += 10;

      // High humidity can increase perceived smog/particles
      if (apiHumidity > 80) predictedAqi += 15;
      else if (apiHumidity < 40) predictedAqi -= 5;

      // Add a bit of random walk for realism
      predictedAqi += (Math.random() * 8 - 4);

      // Ensure AQI doesn't drop below 0
      predictedAqi = Math.max(0, predictedAqi);

      // Decay the base slightly over time
      currentAqiBase = currentAqiBase * 0.95 + 50 * 0.05;

      const formattedTime = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      predictions.push({
        time: formattedTime,
        predictedAqi: Math.round(predictedAqi),
        windSpeed: apiWindSpeed,
        humidity: apiHumidity,
        temp: apiTemp
      });
    }

    return NextResponse.json({ success: true, predictions }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });

  } catch (error) {
    console.error('Prediction API Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate predictions' }, { status: 500 });
  }
}
