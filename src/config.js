// Configuration management for the Activity API
require('dotenv').config();

const config = {
    // Server settings
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // API Security
    activityToken: process.env.ACTIVITY_TOKEN,
    relayApiKey: process.env.ACTIVITY_RELAY_API_KEY,
    
    // Discord Bot (for integration with mayLOG bot)
    discord: {
        productionToken: process.env.DISCORD_PRODUCTION_TOKEN,
        developmentToken: process.env.DISCORD_DEVELOPMENT_TOKEN,
        isProduction: process.env.NODE_ENV === 'production'
    },
    
    // Database connections
    database: {
        mongoUri: process.env.MONGO_URI,
        mongoCertPath: process.env.MONGO_CERT_PATH,
        redis: {
            host: process.env.REDIS_HOST,
            password: process.env.REDIS_PASSWORD,
            port: parseInt(process.env.REDIS_PORT) || 6379
        }
    },
    
    // External APIs
    external: {
        robloxCookie: process.env.ROBLOX_COOKIE,
        roverApiKey: process.env.ROVER_API_KEY,
        sentryDsn: process.env.SENTRY_DSN
    },
    
    // CORS settings
    cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*']
    },
    
    // Activity tracking settings
    activity: {
        cleanupInterval: 30000, // 30 seconds
        serverTimeout: 60000,   // 1 minute
        updateInterval: 30,     // 30 seconds (for Roblox script)
        maxRetries: 3
    }
};

// Validation
const requiredEnvVars = [
    'ACTIVITY_TOKEN',
    'MONGO_URI',
    'REDIS_HOST',
    'REDIS_PASSWORD'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
}

module.exports = config;