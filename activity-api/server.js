const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for servers and players
const servers = new Map();
const KEEP_ALIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    if (token !== process.env.ACTIVITY_TOKEN) {
        return res.status(403).json({ error: 'Invalid token' });
    }

    next();
};

// Clean up expired servers
const cleanupExpiredServers = () => {
    const now = Date.now();
    for (const [serverId, server] of servers.entries()) {
        if (now - server.lastKeepAlivePing > KEEP_ALIVE_TIMEOUT) {
            console.log(`Removing expired server: ${serverId}`);
            servers.delete(serverId);
        }
    }
};

// Run cleanup every minute
setInterval(cleanupExpiredServers, 60 * 1000);

// Routes

// GET /v1/maylog-activity/servers - Get all servers
app.get('/v1/maylog-activity/servers', authenticateToken, (req, res) => {
    const serverList = Array.from(servers.values());
    res.json({ servers: serverList });
});

// GET /v1/maylog-activity/:serverId - Get specific server
app.get('/v1/maylog-activity/:serverId', authenticateToken, (req, res) => {
    const { serverId } = req.params;
    const server = servers.get(serverId);
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json(server);
});

// POST /v1/maylog-activity/servers/relay/create - Create/update server
app.post('/v1/maylog-activity/servers/relay/create', authenticateToken, (req, res) => {
    const { serverId, players = [], renewCreate = false } = req.body;
    
    if (!serverId) {
        return res.status(400).json({ error: 'serverId is required' });
    }
    
    const now = Date.now();
    const existingServer = servers.get(serverId);
    
    const serverData = {
        serverId,
        players: players.map(player => ({
            team: player.team || 'Citizen',
            name: player.name || 'Unknown',
            userId: player.userId || 0,
            joinedAt: player.joinedAt || now
        })),
        lastKeepAlivePing: now,
        registeredAt: existingServer ? existingServer.registeredAt : now,
        renewCreate: renewCreate || false
    };
    
    servers.set(serverId, serverData);
    
    res.json({ 
        success: true, 
        message: 'Server updated successfully',
        server: serverData 
    });
});

// POST /v1/maylog-activity/servers/:serverId/keepalive - Keep server alive
app.post('/v1/maylog-activity/servers/:serverId/keepalive', authenticateToken, (req, res) => {
    const { serverId } = req.params;
    const { players = [] } = req.body;
    
    const server = servers.get(serverId);
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    const now = Date.now();
    server.lastKeepAlivePing = now;
    server.players = players.map(player => ({
        team: player.team || 'Citizen',
        name: player.name || 'Unknown',
        userId: player.userId || 0,
        joinedAt: player.joinedAt || now
    }));
    
    servers.set(serverId, server);
    
    res.json({ 
        success: true, 
        message: 'Server keepalive updated',
        server 
    });
});

// DELETE /v1/maylog-activity/servers/:serverId - Remove server
app.delete('/v1/maylog-activity/servers/:serverId', authenticateToken, (req, res) => {
    const { serverId } = req.params;
    
    if (servers.delete(serverId)) {
        res.json({ success: true, message: 'Server removed successfully' });
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeServers: servers.size
    });
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
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;