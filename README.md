# mayLOG Activity API

This is a recreation of the Activity API system for the mayLOG Discord bot, including both the Node.js API server and Roblox scripts. This API enables the Discord bot to track player activity in Roblox games for activity logging and quota management.

## Features

- **Real-time player tracking**: Tracks players across multiple Roblox servers
- **Team monitoring**: Monitors which team players are on (essential for mayLOG activity validation)
- **Discord bot integration**: Full compatibility with mayLOG bot's activity tracking system
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
   
   **Required for Discord Bot Integration:**
   - `ACTIVITY_TOKEN`: Secure token for API authentication (matches mayLOG bot config)
   - `DISCORD_PRODUCTION_TOKEN`: Your Discord bot token for production
   - `DISCORD_DEVELOPMENT_TOKEN`: Your Discord bot token for development
   - `MONGO_URI`: MongoDB connection string (for mayLOG bot database)
   - `REDIS_HOST`: Redis server IP address
   - `REDIS_PASSWORD`: Redis server password
   - `ROVER_API_KEY`: RoVer API key for Roblox-Discord linking
   
   **Optional:**
   - `PORT`: Server port (default: 3000)
   - `ALLOWED_ORIGINS`: CORS allowed origins
   - `SENTRY_DSN`: Error tracking
   - `ROBLOX_COOKIE`: For additional Roblox API features

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
     - `API_TOKEN`: Same as `ACTIVITY_TOKEN` in your `.env` file

2. **Optional LocalScript:**
   - Copy `roblox-script/LocalScript.lua`
   - Place it in `StarterPlayer > StarterPlayerScripts`
   - This provides client-side features like activity GUI

### mayLOG Discord Bot Integration

This API is designed to work seamlessly with the mayLOG Discord bot. The bot will:

1. **Check player activity**: Use `/v1/maylog-activity/player/:userId` to see if a player is in-game
2. **Validate team membership**: Ensure players are on the correct team for activity logs
3. **Track activity duration**: Monitor how long players stay in-game
4. **Automatic log submission**: Submit activity logs when players disconnect

## API Endpoints

### Authentication
All endpoints (except health check) require Bearer token authentication:
```
Authorization: Bearer YOUR_ACTIVITY_TOKEN
```

### Core Endpoints (Used by mayLOG Bot)

- `GET /health` - Health check (no auth required)
- `GET /v1/maylog-activity/servers` - Get all active servers
- `GET /v1/maylog-activity/:serverId` - Get specific server data
- `POST /v1/maylog-activity/servers/relay/create` - Update server data (from Roblox)
- `GET /v1/maylog-activity/player/:userId` - **Find player's current server** (main endpoint used by bot)

### Additional Endpoints

- `GET /v1/maylog-activity/players` - Get all active players across all servers
- `GET /v1/maylog-activity/stats` - Get server and player statistics
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

**Player Lookup Response (for mayLOG bot):**
```json
{
  "server": {
    "serverId": "string",
    "registeredAt": 1234567890000,
    "lastKeepAlivePing": 1234567890000
  },
  "player": {
    "name": "string",
    "userId": 123456,
    "team": "string",
    "joinedAt": 1234567890000
  }
}
```

## Configuration

### Environment Variables

**Discord Bot Integration:**
- `DISCORD_PRODUCTION_TOKEN`: Production Discord bot token
- `DISCORD_DEVELOPMENT_TOKEN`: Development Discord bot token
- `MONGO_URI`: MongoDB connection for mayLOG bot database
- `REDIS_HOST`: Redis server for caching
- `REDIS_PASSWORD`: Redis authentication
- `ROVER_API_KEY`: RoVer API for Discord-Roblox linking

**API Configuration:**
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `ACTIVITY_TOKEN`: API authentication token
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### Roblox Script Configuration

In `ServerScript.lua`, update these variables:
- `API_BASE_URL`: Your API server URL
- `API_TOKEN`: Your `ACTIVITY_TOKEN` from `.env`
- `UPDATE_INTERVAL`: How often to send updates (30 seconds recommended)

### mayLOG Bot Configuration

In your mayLOG bot, ensure these settings match:
- `ACTIVITY_TOKEN`: Same token as API server
- Activity API endpoint should point to your deployed API server
- Team names in Roblox should match the team configured in mayLOG

## How It Works with mayLOG

1. **Player joins Roblox server**: Roblox script sends player data to API
2. **Player starts activity log**: mayLOG bot calls API to verify player is in-game and on correct team
3. **Continuous monitoring**: API tracks player presence and team changes
4. **Activity validation**: Bot periodically checks if player is still active
5. **Log completion**: When player leaves or time requirement is met, bot submits activity log

## Security Features

- **Rate limiting**: 100 requests per 15 minutes per IP
- **CORS protection**: Configurable allowed origins
- **Helmet.js**: Security headers
- **Token authentication**: Bearer token required for most endpoints
- **Input validation**: Request data validation
- **Environment separation**: Different tokens for development/production

## Monitoring

- **Health endpoint**: `/health` for uptime monitoring
- **Automatic cleanup**: Removes servers inactive for >1 minute
- **Logging**: Request logging with Morgan
- **Error handling**: Comprehensive error handling and logging
- **Stats endpoint**: `/v1/maylog-activity/stats` for monitoring

## Team Configuration

The API supports all teams that mayLOG recognizes:
- `Citizen` (default)
- `Fire Department`
- `Lander Police Department`
- `Mayflower National Guard`
- `Mayflower Parks & Wildlife`
- `Mayflower Postal Service`
- `Mayflower State Police`
- `New Haven Transit Authority`
- `Plymouth Police Department`
- `Public Broadcasting Service`
- `Sheriff's Office`
- `United Central Railroad`

## Troubleshooting

### Common Issues

1. **"Server not found" errors**: Check if Roblox script is running and API_BASE_URL is correct
2. **Authentication failures**: Verify ACTIVITY_TOKEN matches between API and Roblox script
3. **mayLOG bot can't find players**: Ensure API is accessible from bot's server
4. **Team validation fails**: Check team names match between Roblox and mayLOG configuration
5. **Activity logs not working**: Verify player is on correct team and API is responding

### Debugging

- Check server logs for error messages
- Use `/health` endpoint to verify API is running
- Test authentication with a simple GET request to `/v1/maylog-activity/servers`
- Verify Roblox script output in Studio's Output window
- Check mayLOG bot logs for API connection issues

### Discord Bot Integration Issues

- Ensure `ACTIVITY_TOKEN` environment variable matches in both API and bot
- Verify API server is accessible from where the Discord bot is hosted
- Check that MongoDB and Redis connections are working
- Confirm RoVer API key is valid for Discord-Roblox user linking

## License

MIT License - see LICENSE file for details