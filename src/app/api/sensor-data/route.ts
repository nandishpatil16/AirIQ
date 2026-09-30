import { NextResponse } from 'next/server';

// In-memory store for the latest sensor reading
// In a production app, use a database (e.g., PostgreSQL, MongoDB, or Redis)
let latestSensorData = {
  temperature: 0,
  humidity: 0,
  pm25: 0,
  co2: 0,
  mq135: 0,
  mq7: 0,
  no2: 0,
  timestamp: new Date().toISOString()
};

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate and update store
    if (data) {
      latestSensorData = {
        ...data,
        timestamp: new Date().toISOString()
      };
      console.log('Received new sensor data:', latestSensorData);
      return NextResponse.json({ success: true, message: 'Data received successfully' });
    }
    
    return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to parse request' }, { status: 500 });
  }
}

export async function GET() {
  // Ensure the route is not statically cached
  return NextResponse.json(latestSensorData, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  });
}
