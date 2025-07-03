# mayLOG Activity API

This is a recreation of the Activity API system for the mayLOG Discord bot, including both the Node.js API server and Roblox scripts.

## Features

- **Real-time player tracking**: Tracks players across multiple Roblox servers
- **Team monitoring**: Monitors which team players are on
- **Automatic cleanup**: Removes inactive servers automatically
- **Rate limiting**: Protects against API abuse
- **Authentication**: Secure token-based authentication
- **Health monitoring**: Built-in health check endpoints

## Setup

### API Server

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   - `ACTIVITY_TOKEN`: Secure token for API authentication
   - `PORT`: Server port (default: 3000)
   - `ALLOWED_ORIGINS`: CORS allowed origins

3. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Roblox Integration

1. **Place the ServerScript:**
   - Copy `roblox-script/ServerScript.lua`
   - Place it in `ServerScriptService` in Roblox Studio
   - Update the configuration variables:
     - `API_BASE_URL`: Your API server URL
     - `API_TOKEN`: Same token as in your `.env` file

2. **Optional LocalScript:**
   - Copy `roblox-script/LocalScript.lua`
   - Place it in `StarterPlayer > StarterPlayerScripts`
   - This provides client-side features like activity GUI

## API Endpoints

### Authentication
All endpoints (except health check) require Bearer token authentication:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Endpoints

- `GET /health` - Health check (no auth required)
- `GET /v1/maylog-activity/servers` - Get all active servers
- `GET /v1/maylog-activity/:serverId` - Get specific server data
- `POST /v1/maylog-activity/servers/relay/create` - Update server data (from Roblox)
- `GET /v1/maylog-activity/player/:userId` - Find player's current server
- `DELETE /v1/maylog-activity/servers/:serverId` - Remove server

### Data Structure

**Server Data:**
```json
{
  "serverId": "string",
  "players": [
    {
      "name": "string",
      "userId": 123456,
      "team": "string",
      "joinedAt": 1234567890000
    }
  ],
  "lastKeepAlivePing": 1234567890000,
  "registeredAt": 1234567890000,
  "renewCreate": false
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `ACTIVITY_TOKEN`: API authentication token
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### Roblox Script Configuration

In `ServerScript.lua`, update these variables:
- `API_BASE_URL`: Your API server URL
- `API_TOKEN`: Your authentication token
- `UPDATE_INTERVAL`: How often to send updates (seconds)

## Security Features

- **Rate limiting**: 100 requests per 15 minutes per IP
- **CORS protection**: Configurable allowed origins
- **Helmet.js**: Security headers
- **Token authentication**: Bearer token required for most endpoints
- **Input validation**: Request data validation

## Monitoring

- **Health endpoint**: `/health` for uptime monitoring
- **Automatic cleanup**: Removes servers inactive for >1 minute
- **Logging**: Request logging with Morgan
- **Error handling**: Comprehensive error handling and logging

## Integration with mayLOG

This API is designed to work with the mayLOG Discord bot's activity tracking system. The bot will:

1. Call the API to check if players are in-game
2. Track activity logs based on server presence
3. Validate team membership for activity requirements
4. Automatically submit logs when players disconnect

## Troubleshooting

### Common Issues

1. **"Server not found" errors**: Check if Roblox script is running and API_BASE_URL is correct
2. **Authentication failures**: Verify ACTIVITY_TOKEN matches between API and Roblox script
3. **CORS errors**: Add your domain to ALLOWED_ORIGINS in .env
4. **Players not tracked**: Ensure Teams service is properly configured in your Roblox game

### Debugging

- Check server logs for error messages
- Use `/health` endpoint to verify API is running
- Test authentication with a simple GET request to `/v1/maylog-activity/servers`
- Verify Roblox script output in Studio's Output window

## License

MIT License - see LICENSE file for details