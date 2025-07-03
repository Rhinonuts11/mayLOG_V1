const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
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
const CLEANUP_INTERVAL = 30000; // 30 seconds
const SERVER_TIMEOUT = 60000; // 1 minute

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    if (token !== process.env.ACTIVITY_TOKEN) {
        return res.status(403).json({ error: 'Invalid access token' });
    }

    next();
};

// Cleanup old servers
setInterval(() => {
    const now = Date.now();
    for (const [serverId, server] of servers.entries()) {
        if (now - server.lastKeepAlivePing > SERVER_TIMEOUT) {
            console.log(`Removing inactive server: ${serverId}`);
            servers.delete(serverId);
        }
    }
}, CLEANUP_INTERVAL);

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        servers: servers.size
    });
});

// Get all servers
app.get('/v1/maylog-activity/servers', authenticateToken, (req, res) => {
    const serverList = Array.from(servers.values());
    res.json({ servers: serverList });
});

// Get specific server
app.get('/v1/maylog-activity/:serverId', authenticateToken, (req, res) => {
    const { serverId } = req.params;
    const server = servers.get(serverId);
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json(server);
});

// Create or update server (from Roblox)
app.post('/v1/maylog-activity/servers/relay/create', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token !== process.env.ACTIVITY_TOKEN) {
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

    console.log(`Server ${serverId} updated with ${players.length} players`);
    
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
        res.json({ success: true, message: 'Server deleted successfully' });
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
});

// Get player's current server
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

    res.status(404).json({ error: 'Player not found in any server' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`Activity API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;