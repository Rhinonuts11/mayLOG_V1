-- Place this script in ServerScriptService
-- This script handles server registration and player tracking for mayLOG Discord bot

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Teams = game:GetService("Teams")

-- Configuration - UPDATE THESE VALUES
local API_BASE_URL = "https://your-api-domain.com" -- Replace with your actual API URL
local API_TOKEN = "your_secure_token_here" -- Replace with your ACTIVITY_TOKEN from .env
local UPDATE_INTERVAL = 30 -- seconds (matches mayLOG bot expectations)
local MAX_RETRIES = 3

-- State
local isRunning = false
local lastUpdate = 0
local retryCount = 0
local playersCache = {}

-- Get server ID (unique identifier for this server instance)
local function getServerId()
    return game.JobId
end

-- Get player's team name (matches mayLOG bot team checking)
local function getPlayerTeam(player)
    if player.Team then
        return player.Team.Name
    end
    return "Citizen" -- Default team name that mayLOG recognizes
end

-- Get all current players data (format matches mayLOG expectations)
local function getCurrentPlayersData()
    local playersData = {}
    
    for _, player in pairs(Players:GetPlayers()) do
        if player.UserId > 0 then -- Exclude guests/invalid users
            local playerData = {
                name = player.Name,
                userId = player.UserId,
                team = getPlayerTeam(player),
                joinedAt = playersCache[player.UserId] or (os.time() * 1000) -- Preserve join time
            }
            
            -- Cache join time for this player
            if not playersCache[player.UserId] then
                playersCache[player.UserId] = playerData.joinedAt
            else
                playerData.joinedAt = playersCache[player.UserId]
            end
            
            table.insert(playersData, playerData)
        end
    end
    
    return playersData
end

-- Send data to API (matches mayLOG relay endpoint)
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
            print("[mayLOG Activity] Server data sent successfully:", responseData.message or "OK")
            retryCount = 0
            return true
        else
            warn("[mayLOG Activity] Failed to send data. Status:", response.StatusCode, "Body:", response.Body)
            return false
        end
    end)
    
    if not success then
        warn("[mayLOG Activity] Error sending server data:", result)
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
                warn("[mayLOG Activity] Max retries reached. Waiting for next cycle.")
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
        warn("[mayLOG Activity] Activity tracking is already running")
        return
    end
    
    print("[mayLOG Activity] Starting activity tracking for server:", getServerId())
    print("[mayLOG Activity] API Endpoint:", API_BASE_URL)
    print("[mayLOG Activity] Update Interval:", UPDATE_INTERVAL, "seconds")
    
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
    
    print("[mayLOG Activity] Stopping activity tracking")
    isRunning = false
end

-- Event handlers
Players.PlayerAdded:Connect(function(player)
    print("[mayLOG Activity] Player joined:", player.Name, "(" .. player.UserId .. ")")
    
    -- Cache join time
    playersCache[player.UserId] = os.time() * 1000
    
    -- Send update when player joins (with small delay)
    spawn(function()
        wait(1)
        if isRunning then
            sendServerData()
        end
    end)
end)

Players.PlayerRemoving:Connect(function(player)
    print("[mayLOG Activity] Player leaving:", player.Name, "(" .. player.UserId .. ")")
    
    -- Remove from cache
    playersCache[player.UserId] = nil
    
    -- Send update when player leaves
    spawn(function()
        wait(1)
        if isRunning then
            sendServerData()
        end
    end)
end)

-- Handle team changes (important for mayLOG activity tracking)
local function onPlayerTeamChanged(player)
    local teamName = getPlayerTeam(player)
    print("[mayLOG Activity] Player team changed:", player.Name, "->", teamName)
    
    -- Send update when team changes (mayLOG needs this for activity validation)
    spawn(function()
        wait(0.5)
        if isRunning then
            sendServerData()
        end
    end)
end

-- Connect team change events for existing players
for _, player in pairs(Players:GetPlayers()) do
    if player.UserId > 0 then
        playersCache[player.UserId] = os.time() * 1000
        player:GetPropertyChangedSignal("Team"):Connect(function()
            onPlayerTeamChanged(player)
        end)
    end
end

-- Connect team change events for new players
Players.PlayerAdded:Connect(function(player)
    if player.UserId > 0 then
        player:GetPropertyChangedSignal("Team"):Connect(function()
            onPlayerTeamChanged(player)
        end)
    end
end)

-- Cleanup on server shutdown
game:BindToClose(function()
    print("[mayLOG Activity] Server shutting down, stopping activity tracking")
    stopActivityTracking()
    wait(1) -- Give time for final cleanup
end)

-- Auto-start tracking
startActivityTracking()

-- Expose functions globally for manual control if needed
_G.MayLOGActivity = {
    start = startActivityTracking,
    stop = stopActivityTracking,
    sendData = sendServerData,
    getServerId = getServerId,
    isRunning = function() return isRunning end,
    getPlayers = getCurrentPlayersData,
    config = {
        apiUrl = API_BASE_URL,
        updateInterval = UPDATE_INTERVAL,
        hasToken = API_TOKEN ~= "your_secure_token_here"
    }
}

print("[mayLOG Activity] Script loaded successfully")
print("[mayLOG Activity] Use _G.MayLOGActivity for manual control")

-- Validation warnings
if API_TOKEN == "your_secure_token_here" then
    warn("[mayLOG Activity] WARNING: Please update API_TOKEN in the script!")
end

if API_BASE_URL == "https://your-api-domain.com" then
    warn("[mayLOG Activity] WARNING: Please update API_BASE_URL in the script!")
end