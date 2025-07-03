# mayLOG Activity API - Railway Deployment

This is a standalone API server for the mayLOG Discord bot activity tracking system, optimized for Railway deployment.

## 🚀 Quick Railway Deployment

### 1. Deploy to Railway

1. **Fork/Clone this repository**
2. **Connect to Railway:**
   - Go to [Railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository

3. **Set Environment Variables in Railway:**
   ```
   ACTIVITY_TOKEN=your_secure_token_here
   NODE_ENV=production
   ```

4. **Deploy!** Railway will automatically:
   - Install dependencies
   - Start the server on the assigned port
   - Provide you with a public URL

### 2. Configure Your Roblox Script

1. **Copy `railway-roblox-script.lua` to ServerScriptService**
2. **Update the configuration:**
   ```lua
   local API_BASE_URL = "https://your-app-name.railway.app" -- Your Railway URL
   local API_TOKEN = "your_secure_token_here" -- Same as Railway env var
   ```

### 3. Configure Your mayLOG Discord Bot

Update your Discord bot's activity API endpoint to point to your Railway deployment:
```
https://your-app-name.railway.app/v1/maylog-activity
```

## 📋 Environment Variables

Set these in your Railway project settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `ACTIVITY_TOKEN` | ✅ | Secure token for API authentication |
| `NODE_ENV` | ✅ | Set to `production` |
| `ALLOWED_ORIGINS` | ❌ | CORS origins (comma-separated) |
| `ACTIVITY_RELAY_API_KEY` | ❌ | Additional API key for compatibility |

## 🔗 API Endpoints

### Health Check
```
GET /health
```
No authentication required. Returns server status.

### Discord Bot Integration
```
GET /v1/maylog-activity/player/:userId
```
**This is the main endpoint the mayLOG bot uses** to check if a player is in-game.

### Server Management
```
GET /v1/maylog-activity/servers
POST /v1/maylog-activity/servers/relay/create
GET /v1/maylog-activity/:serverId
DELETE /v1/maylog-activity/servers/:serverId
```

### Monitoring
```
GET /v1/maylog-activity/stats
GET /v1/maylog-activity/players
```

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp railway-env-example .env
# Edit .env with your values

# Start development server
npm run dev
```

## 🔒 Security Features

- **Rate limiting**: 100 requests per 15 minutes per IP
- **CORS protection**: Configurable allowed origins
- **Helmet.js**: Security headers
- **Token authentication**: Bearer token required for most endpoints
- **Input validation**: Request data validation

## 📊 Monitoring

- **Health endpoint**: `/health` for uptime monitoring
- **Stats endpoint**: `/v1/maylog-activity/stats` for detailed metrics
- **Automatic cleanup**: Removes inactive servers after 1 minute
- **Request logging**: Morgan HTTP request logger

## 🎯 mayLOG Bot Integration

This API is specifically designed for the mayLOG Discord bot:

1. **Player Activity Tracking**: Bot calls `/v1/maylog-activity/player/:userId`
2. **Team Validation**: Ensures players are on correct team for activity logs
3. **Real-time Updates**: Roblox script sends updates every 30 seconds
4. **Automatic Cleanup**: Inactive servers are removed automatically

## 🚨 Important Notes

- **Railway automatically assigns PORT** - don't set it manually
- **Use HTTPS URLs** - Railway provides SSL by default
- **Update Roblox script** with your Railway app URL
- **Keep ACTIVITY_TOKEN secure** - it's your API authentication

## 📞 Support

If you encounter issues:
1. Check Railway logs for errors
2. Verify environment variables are set correctly
3. Ensure Roblox script has correct API URL and token
4. Test the `/health` endpoint to verify deployment

---

**Ready to deploy!** 🎉 Your mayLOG activity tracking system will be live on Railway in minutes.