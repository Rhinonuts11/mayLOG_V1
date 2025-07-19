# mayLOG Activity API

A REST API for tracking Roblox server activity and player data for the mayLOG Discord bot.

## Features

- Track multiple Roblox game servers
- Monitor player activity and team assignments
- Automatic cleanup of inactive servers
- Token-based authentication
- RESTful API design

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=10001
NODE_ENV=production
ACTIVITY_TOKEN=your_secure_token_here
```

**Important**: The `ACTIVITY_TOKEN` must match the token in your mayLOG bot's environment variables.

### 3. Start the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## API Endpoints

### Authentication

All endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer your_activity_token_here
```

### Endpoints

#### GET /v1/maylog-activity/servers
Get all active servers.

**Response:**
```json
{
  "servers": [
    {
      "serverId": "server-id-123",
      "players": [...],
      "lastKeepAlivePing": 1640995200000,
      "registeredAt": 1640995200000,
      "renewCreate": false
    }
  ]
}
```

#### GET /v1/maylog-activity/:serverId
Get specific server data.

#### POST /v1/maylog-activity/servers/relay/create
Create or update a server.

**Request Body:**
```json
{
  "serverId": "server-id-123",
  "players": [
    {
      "userId": 12345,
      "name": "PlayerName",
      "team": "TeamName",
      "joinedAt": 1640995200000
    }
  ],
  "renewCreate": false
}
```

#### POST /v1/maylog-activity/servers/:serverId/keepalive
Update server keepalive and player data.

#### DELETE /v1/maylog-activity/servers/:serverId
Remove a server.

#### GET /health
Health check endpoint.

## Data Models

### Server Object
```json
{
  "serverId": "string",
  "players": "Player[]",
  "lastKeepAlivePing": "number (timestamp)",
  "registeredAt": "number (timestamp)",
  "renewCreate": "boolean"
}
```

### Player Object
```json
{
  "userId": "number",
  "name": "string",
  "team": "string",
  "joinedAt": "number (timestamp)"
}
```

## Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name "maylog-activity-api"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 10001
CMD ["npm", "start"]
```

### Environment Variables

- `PORT`: Server port (default: 10001)
- `NODE_ENV`: Environment (development/production)
- `ACTIVITY_TOKEN`: Authentication token (required)

## Security Considerations

1. **Token Security**: Keep your `ACTIVITY_TOKEN` secure and rotate it regularly
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Consider adding rate limiting for production use
4. **CORS**: Configure CORS appropriately for your domain

## Monitoring

The API includes:
- Health check endpoint at `/health`
- Automatic cleanup of inactive servers (5-minute timeout)
- Error logging and handling

## Integration with mayLOG

This API is designed to work with the mayLOG Discord bot. Make sure:

1. The `ACTIVITY_TOKEN` matches between the API and bot
2. Update the API URL in your mayLOG bot configuration
3. The Roblox script is properly configured and deployed