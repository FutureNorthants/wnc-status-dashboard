const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public folder

// Wormly API configuration
const WORMLY_API_KEY = process.env.WORMLY_API_KEY;
const WORMLY_BASE_URL = 'https://api.wormly.com/';

// Service mapping - Wormly host IDs
const SERVICE_MAPPING = {
    '107401': {
        name: 'API - Coroners',
        description: 'Coroners API service',
        id: 'api-coroners'
    },
    '68843': {
        name: 'API - NBC Collection Details',
        description: 'NBC collection details API',
        id: 'api-nbc-collection'
    },
    '89703': {
        name: 'Blue Badge Application',
        description: 'Blue Badge application system',
        id: 'app-blue-badge'
    },
    '89705': {
        name: 'Firmstep Application',
        description: 'Firmstep application system',
        id: 'app-firmstep'
    },
    '82156': {
        name: 'WNC Main Website',
        description: 'West Northamptonshire Council main website',
        id: 'wnc-website'
    },
    '67371': {
        name: 'WNC Northampton Website',
        description: 'WNC Northampton area website',
        id: 'wnc-northampton'
    },
    '70744': {
        name: 'Bin Details API',
        description: 'NBC bin collection details API',
        id: 'api-bin-details'
    },
    '67417': {
        name: 'Veolia Echo Live',
        description: 'Veolia waste management system',
        id: 'veolia-echo'
    }
};

// Helper function to convert Wormly status to format
function convertWormlyStatus(host) {
    // Check if monitoring is enabled
    if (!host.uptimemonitored) {
        return 'warning'; // Monitoring disabled
    }
    
    // Check for uptime errors
    if (host.uptimeerrors) {
        return 'down';
    }
    
    // Check for health errors (if health monitoring)
    if (host.healthmonitored && host.healtherrors) {
        return 'warning';
    }
    
    // If no errors and monitoring is active, service is operational
    return 'operational';
}

// Helper function to get last check time
function getLastCheckTime(host) {
    if (host.lastuptimecheck) {
        // Convert Unix timestamp to ISO string
        return new Date(host.lastuptimecheck * 1000).toISOString();
    }
    return new Date().toISOString();
}

// Helper function to fetch data
async function fetchWormlyData() {
    try {
        // getting host status
        const apiUrl = `${WORMLY_BASE_URL}?key=${WORMLY_API_KEY}&response=json&cmd=getHostStatus`;
        
        console.log('Fetching from Wormly API...');
        const response = await axios.get(apiUrl);
        
        if (response.data.errorcode !== 0) {
            throw new Error('Wormly API returned error code: ' + response.data.errorcode);
        }

        const hosts = response.data.status || [];
        const services = [];
        
        for (const host of hosts) {
            const hostId = host.hostid.toString();
            
            // Skip if not in our service mapping
            if (!SERVICE_MAPPING[hostId]) {
                continue; // Only process mapped services
            }

            const serviceConfig = SERVICE_MAPPING[hostId];
            const status = convertWormlyStatus(host);
            
            const service = {
                id: serviceConfig.id,
                name: serviceConfig.name,
                description: serviceConfig.description,
                status: status,
                response_time: null, // Wormly does not provide this in getHostStatus - chec
                uptime_percentage: calculateUptimePercentage(host),
                last_checked: getLastCheckTime(host),
                incident: null
            };

            // Add incident info if service is down or has any warnings
            if (service.status !== 'operational') {
                service.incident = createIncidentInfo(hostId, service.status, host);
            }

            services.push(service);
        }

        console.log(`Found ${services.length} mapped services out of ${hosts.length} total hosts`);
        return services;
        
    } catch (error) {
        console.error('Error fetching Wormly data:', error.message);
        throw error;
    }
}

// Helper function to calculate uptime percentage (simplified-changed for testing)
function calculateUptimePercentage(host) {
    if (!host.uptimemonitored) {
        return 0;
    }
    
    // If currently has errors, assume 95% uptime
    if (host.uptimeerrors) {
        return 95.0;
    }
    
    // If no current errors, assume good uptime
    return 99.9;
}

// Helper function to create incident information
function createIncidentInfo(hostId, status, hostData) {
    const severityMap = {
        'down': 'high',
        'warning': 'medium',
        'degraded': 'medium'
    };

    let title = 'Service Issue';
    let description = 'Service is experiencing issues';
    
    if (status === 'down') {
        title = 'Service Down';
        if (!hostData.uptimemonitored) {
            description = 'Uptime monitoring is disabled for this service';
        } else {
            description = 'Service is currently experiencing uptime errors and is not responding';
        }
    } else if (status === 'warning') {
        title = 'Service Warning';
        if (hostData.healtherrors) {
            description = 'Service has health monitoring alerts active';
        } else if (!hostData.uptimemonitored) {
            description = 'Uptime monitoring is disabled - unable to verify service status';
        } else {
            description = 'Service is experiencing intermittent issues';
        }
    }

    return {
        id: `inc-${hostId}-${Date.now()}`,
        title: title,
        description: description,
        severity: severityMap[status] || 'medium',
        started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: 'investigating'
    };
}

// Calculate overall system status
function calculateOverallStatus(services) {
    if (services.length === 0) return 'operational';
    
    const hasDown = services.some(s => s.status === 'down');
    const hasIssues = services.some(s => s.status === 'warning' || s.status === 'degraded');
    
    if (hasDown) return 'down';
    if (hasIssues) return 'issues';
    return 'operational';
}

// Main status endpoint
app.get('/api/status', async (req, res) => {
    try {
        console.log('Fetching status data...');
        
        const services = await fetchWormlyData();
        const overallStatus = calculateOverallStatus(services);
        
        const response = {
            timestamp: new Date().toISOString(),
            overall_status: overallStatus,
            services: services
        };

        console.log(`Returning status for ${services.length} services`);
        res.json(response);
        
    } catch (error) {
        console.error('Error in /api/status:', error);
        
        res.status(500).json({
            error: 'Failed to fetch status data',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint to get raw Wormly data
app.get('/api/wormly-raw', async (req, res) => {
    try {
        if (!WORMLY_API_KEY) {
            return res.status(500).json({ error: 'WORMLY_API_KEY not configured' });
        }
        
        const apiUrl = `${WORMLY_BASE_URL}?key=${WORMLY_API_KEY}&response=json&cmd=getHostStatus`;
        const response = await axios.get(apiUrl);
        
        res.json({
            url_used: apiUrl.replace(WORMLY_API_KEY, 'HIDDEN'),
            wormly_response: response.data,
            mapped_services: Object.keys(SERVICE_MAPPING).length,
            available_hostids: response.data.status ? response.data.status.map(h => `${h.hostid}: ${h.name}`) : []
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch Wormly data',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        wormly_key_configured: !!WORMLY_API_KEY,
        mapped_services_count: Object.keys(SERVICE_MAPPING).length
    });
});

// Serve the Teams dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile('dashboard.html', { root: __dirname });
});

// Root redirect to dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Start server
app.listen(PORT, () => {
    console.log(`Status API server running on port ${PORT}`);
    console.log(`Status endpoint: http://localhost:${PORT}/api/status`);
    console.log(`Raw Wormly test: http://localhost:${PORT}/api/wormly-raw`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    
    if (!WORMLY_API_KEY) {
        console.warn('⚠️  WORMLY_API_KEY environment variable not set!');
        console.warn('   Add it to your .env file: WORMLY_API_KEY=your_key_here');
    } else {
        console.log('Wormly API key is configured');
        console.log(`Monitoring ${Object.keys(SERVICE_MAPPING).length} services`);
    }
});

module.exports = app;