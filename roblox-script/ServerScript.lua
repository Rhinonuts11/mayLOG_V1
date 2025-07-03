-- Place this script in ServerScriptService
-- This script handles server registration and player tracking

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Teams = game:GetService("Teams")

-- Configuration
local API_BASE_URL = "https://your-api-domain.com" -- Replace with your actual API URL
local API_TOKEN = "your_secure_token_here" -- Replace with your actual token
local UPDATE_INTERVAL = 30 -- seconds
local MAX_RETRIES = 3

-- State
local isRunning = false
local lastUpdate = 0
local retryCount = 0

-- Get server ID (unique identifier for this server instance)
local function getServerId()
    return game.JobId
end

-- Get player's team name
local function getPlayerTeam(player)
    if player.Team then
        return player.Team.Name
    end
    return "No Team"
end

-- Get all current players data
local function getCurrentPlayersData()
    local playersData = {}
    
    for _, player in pairs(Players:GetPlayers()) do
        if player.UserId > 0 then -- Exclude guests/invalid users
            table.insert(playersData, {
                name = player.Name,
                userId = player.UserId,
                team = getPlayerTeam(player),
                joinedAt = os.time() * 1000 -- Convert to milliseconds
            })
        end
    end
    
    return playersData
end

-- Send data to API
local function sendServerData()
    local success, result = pcall(function()
        local playersData = getCurrentPlayersData()
        
        local requestData = {
            serverId = getServerId(),
            players = playersData
        }
        
        local jsonData = HttpService:JSONEncode(requestData)
        
        local response = HttpService:RequestAsync({
            Url = API_BASE_URL .. "/v1/maylog-activity/servers/relay/create",
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["Authorization"] = "Bearer " .. API_TOKEN
            },
            Body = jsonData
        })
        
        if response.Success and response.StatusCode == 200 then
            local responseData = HttpService:JSONDecode(response.Body)
            print("[Activity API] Server data sent successfully:", responseData.message)
            retryCount = 0
            return true
        else
            warn("[Activity API] Failed to send data. Status:", response.StatusCode, "Body:", response.Body)
            return false
        end
    end)
    
    if not success then
        warn("[Activity API] Error sending server data:", result)
        return false
    end
    
    return result
end

-- Main update loop
local function updateLoop()
    if not isRunning then
        return
    end
    
    local currentTime = tick()
    
    if currentTime - lastUpdate >= UPDATE_INTERVAL then
        local success = sendServerData()
        
        if success then
            lastUpdate = currentTime
        else
            retryCount = retryCount + 1
            if retryCount >= MAX_RETRIES then
                warn("[Activity API] Max retries reached. Waiting for next cycle.")
                lastUpdate = currentTime -- Reset timer even on failure
                retryCount = 0
            else
                -- Retry sooner on failure
                lastUpdate = currentTime - UPDATE_INTERVAL + 5
            end
        end
    end
end

-- Start the activity tracking
local function startActivityTracking()
    if isRunning then
        warn("[Activity API] Activity tracking is already running")
        return
    end
    
    print("[Activity API] Starting activity tracking for server:", getServerId())
    isRunning = true
    lastUpdate = 0 -- Force immediate first update
    
    -- Connect to heartbeat for regular updates
    RunService.Heartbeat:Connect(updateLoop)
    
    -- Send initial data
    spawn(function()
        wait(2) -- Small delay to ensure everything is loaded
        sendServerData()
    end)
end

-- Stop the activity tracking
local function stopActivityTracking()
    if not isRunning then
        return
    end
    
    print("[Activity API] Stopping activity tracking")
    isRunning = false
end

-- Event handlers
Players.PlayerAdded:Connect(function(player)
    print("[Activity API] Player joined:", player.Name)
    -- Send update when player joins (with small delay)
    spawn(function()
        wait(1)
        if isRunning then
            sendServerData()
        end
    end)
end)

Players.PlayerRemoving:Connect(function(player)
    print("[Activity API] Player leaving:", player.Name)
    -- Send update when player leaves
    spawn(function()
        wait(1)
        if isRunning then
            sendServerData()
        end
    end)
end)

-- Handle team changes
local function onPlayerTeamChanged(player)
    print("[Activity API] Player team changed:", player.Name, "->", getPlayerTeam(player))
    -- Send update when team changes
    spawn(function()
        wait(0.5)
        if isRunning then
            sendServerData()
        end
    end)
end

-- Connect team change events for existing players
for _, player in pairs(Players:GetPlayers()) do
    player:GetPropertyChangedSignal("Team"):Connect(function()
        onPlayerTeamChanged(player)
    end)
end

-- Connect team change events for new players
Players.PlayerAdded:Connect(function(player)
    player:GetPropertyChangedSignal("Team"):Connect(function()
        onPlayerTeamChanged(player)
    end)
end)

-- Cleanup on server shutdown
game:BindToClose(function()
    stopActivityTracking()
    wait(1) -- Give time for final cleanup
end)

-- Auto-start tracking
startActivityTracking()

-- Expose functions globally for manual control if needed
_G.ActivityAPI = {
    start = startActivityTracking,
    stop = stopActivityTracking,
    sendData = sendServerData,
    getServerId = getServerId,
    isRunning = function() return isRunning end
}

print("[Activity API] Script loaded successfully")