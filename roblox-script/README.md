# Roblox Activity Tracker

This script tracks player activity on Roblox game servers and sends the data to the mayLOG Activity API.

## Setup Instructions

### 1. Configure the Script

Edit the `CONFIG` table in `ActivityTracker.lua`:

```lua
local CONFIG = {
    API_URL = "https://your-activity-api-domain.com/v1/maylog-activity/servers/relay/create",
    API_TOKEN = "your_activity_token_here", -- Should match ACTIVITY_TOKEN in your API
    UPDATE_INTERVAL = 30, -- seconds between updates
    RETRY_ATTEMPTS = 3,
    RETRY_DELAY = 5 -- seconds
}
```

### 2. Enable HTTP Requests

In your Roblox game settings:
1. Go to Game Settings > Security
2. Enable "Allow HTTP Requests"
3. Save the settings

### 3. Install the Script

1. Open Roblox Studio
2. Place the `ActivityTracker.lua` script in `ServerScriptService`
3. The script will automatically start tracking when the server starts

## Features

- **Automatic Player Tracking**: Monitors when players join/leave
- **Team Change Detection**: Updates when players change teams
- **Retry Logic**: Automatically retries failed API calls
- **Error Handling**: Comprehensive error logging
- **Graceful Shutdown**: Cleans up when server shuts down

## Data Tracked

For each player, the script tracks:
- User ID
- Username
- Current team
- Join timestamp

## Troubleshooting

### Common Issues

1. **HTTP 403 Errors**: Check that your API_TOKEN matches the one in your Activity API
2. **Network Errors**: Ensure HTTP requests are enabled and your API URL is correct
3. **No Data**: Check the output window for error messages

### Debug Mode

To enable more verbose logging, you can modify the `log` function to include timestamps:

```lua
local function log(message)
    print("[ActivityTracker " .. os.date("%X") .. "] " .. message)
end
```