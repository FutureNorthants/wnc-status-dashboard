# Teams Status Dashboard

A real-time system status dashboard designed for Microsoft Teams integration, providing comprehensive monitoring of services through the Wormly API.
http://systemstatus.eu-west-2.elasticbeanstalk.com/dashboard

## Features

- **Real-time Monitoring**: Automatically fetches and displays service status from Wormly API
- **Teams Integration**: Optimized for Microsoft Teams with theme support
- **Interactive Dashboard**: Modern UI with charts, metrics, and service details
- **Auto-refresh**: Updates every 30 seconds to ensure current status
- **Responsive Design**: Works on desktop and mobile devices
- **AWS Elastic Beanstalk Ready**: Configured for easy deployment

## Quick Start

### Prerequisites
- Node.js 18+
- Wormly API key

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:
```env
WORMLY_API_KEY=your_wormly_api_key_here
PORT=3000
NODE_ENV=development
```

### Running

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

Access the dashboard at `http://localhost:3000`

## API Endpoints

- `GET /` - Redirects to dashboard
- `GET /dashboard` - Main status dashboard
- `GET /api/status` - JSON status data
- `GET /api/wormly-raw` - Raw Wormly API response
- `GET /health` - Health check endpoint

## Deployment

### AWS Elastic Beanstalk
Configured for AWS Elastic Beanstalk deployment:
- Node.js 18 runtime
- Production environment variables
- Port 3000 configuration

### Environment Variables
- `WORMLY_API_KEY` - Your Wormly API key (required)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Dependencies

- Express.js - Web framework
- Axios - HTTP client
- CORS - Cross-origin support
- Chart.js - Data visualization
- Microsoft Teams SDK - Teams integration

## License

ISC
