const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const config = require('./config');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.cors.allowedOrigins,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/v1/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory storage for servers and players
const servers = new Map();

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // Support both ACTIVITY_TOKEN and ACTIVITY_RELAY_API_KEY for compatibility
    const validTokens = [config.activityToken, config.relayApiKey].filter(Boolean);
    
    if (!validTokens.includes(token)) {
        return res.status(403).json({ error: 'Invalid access token' });
    }

    next();
};

// Cleanup old servers
setInterval(() => {
    const now = Date.now();
    for (const [serverId, server] of servers.entries()) {
        if (now - server.lastKeepAlivePing > config.activity.serverTimeout) {
            console.log(`Removing inactive server: ${serverId}`);
            servers.delete(serverId);
        }
    }
}, config.activity.cleanupInterval);

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        servers: servers.size,
        environment: config.nodeEnv,
        version: '1.0.0'
    });
});

// Get all servers - matches the original mayLOG API interface
app.get('/v1/maylog-activity/servers', authenticateToken, (req, res) => {
    const serverList = Array.from(servers.values());
    res.json({ servers: serverList });
});

// Get specific server - matches the original mayLOG API interface
app.get('/v1/maylog-activity/:serverId', authenticateToken, (req, res) => {
    const { serverId } = req.params;
    const server = servers.get(serverId);
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json(server);
});

// Create or update server (from Roblox) - matches the original relay endpoint
app.post('/v1/maylog-activity/servers/relay/create', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Support both tokens for compatibility
    const validTokens = [config.activityToken, config.relayApiKey].filter(Boolean);
    
    if (!token || !validTokens.includes(token)) {
        return res.status(403).json({ error: 'Invalid access token' });
    }

    const { serverId, players } = req.body;

    if (!serverId) {
        return res.status(400).json({ error: 'Server ID is required' });
    }

    if (!Array.isArray(players)) {
        return res.status(400).json({ error: 'Players must be an array' });
    }

    const now = Date.now();
    const existingServer = servers.get(serverId);

    const serverData = {
        serverId,
        players: players.map(player => ({
            team: player.team || 'Unknown',
            name: player.name || 'Unknown',
            userId: parseInt(player.userId) || 0,
            joinedAt: player.joinedAt || now
        })),
        lastKeepAlivePing: now,
        registeredAt: existingServer ? existingServer.registeredAt : now,
        renewCreate: !!existingServer
    };

    servers.set(serverId, serverData);

    console.log(`[${new Date().toISOString()}] Server ${serverId} updated with ${players.length} players`);
    
    res.json({ 
        success: true, 
        message: 'Server data updated successfully',
        serverId,
        playerCount: players.length
    });
});

// Delete server
app.delete('/v1/maylog-activity/servers/:serverId', authenticateToken, (req, res) => {
    const { serverId } = req.params;
    
    if (servers.delete(serverId)) {
        console.log(`[${new Date().toISOString()}] Server ${serverId} deleted`);
        res.json({ success: true, message: 'Server deleted successfully' });
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
});

// Get player's current server - this is what the mayLOG bot uses to check if a player is in-game
app.get('/v1/maylog-activity/player/:userId', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    for (const server of servers.values()) {
        const player = server.players.find(p => p.userId === userId);
        if (player) {
            return res.json({
                server: {
                    serverId: server.serverId,
                    registeredAt: server.registeredAt,
                    lastKeepAlivePing: server.lastKeepAlivePing
                },
                player
            });
        }
    }

    // Return null/void when player not found (matches original API behavior)
    res.status(404).json(null);
});

// Additional endpoint for Discord bot integration - get all active players
app.get('/v1/maylog-activity/players', authenticateToken, (req, res) => {
    const allPlayers = [];
    
    for (const server of servers.values()) {
        for (const player of server.players) {
            allPlayers.push({
                ...player,
                serverId: server.serverId,
                serverRegisteredAt: server.registeredAt
            });
        }
    }
    
    res.json({ players: allPlayers });
});

// Stats endpoint for monitoring
app.get('/v1/maylog-activity/stats', authenticateToken, (req, res) => {
    const stats = {
        totalServers: servers.size,
        totalPlayers: Array.from(servers.values()).reduce((sum, server) => sum + server.players.length, 0),
        serverDetails: Array.from(servers.values()).map(server => ({
            serverId: server.serverId,
            playerCount: server.players.length,
            lastUpdate: server.lastKeepAlivePing,
            uptime: Date.now() - server.registeredAt
        }))
    };
    
    res.json(stats);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(config.port, () => {
    console.log(`[${new Date().toISOString()}] Activity API server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health check available at: http://localhost:${config.port}/health`);
    console.log(`Discord integration: ${config.discord.isProduction ? 'Production' : 'Development'} mode`);
    
    if (config.discord.isProduction && !config.discord.productionToken) {
        console.warn('WARNING: Production mode but no production Discord token configured');
    }
    if (!config.discord.isProduction && !config.discord.developmentToken) {
        console.warn('WARNING: Development mode but no development Discord token configured');
    }
});

module.exports = app;