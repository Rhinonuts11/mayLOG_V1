-- ActivityTracker.lua
-- Roblox server script for tracking player activity and sending to mayLOG Activity API

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Teams = game:GetService("Teams")

-- Configuration
local CONFIG = {
    API_URL = "https://your-activity-api-domain.com/v1/maylog-activity/servers/relay/create",
    API_TOKEN = "your_activity_token_here", -- Should match ACTIVITY_TOKEN in your API
    UPDATE_INTERVAL = 30, -- seconds between updates
    RETRY_ATTEMPTS = 3,
    RETRY_DELAY = 5 -- seconds
}

-- State management
local ActivityTracker = {
    serverId = game.JobId,
    players = {},
    lastUpdate = 0,
    isRunning = false,
    connection = nil
}

-- Utility functions
local function log(message)
    print("[ActivityTracker] " .. message)
end

local function warn(message)
    warn("[ActivityTracker] " .. message)
end

-- Get player's current team name
local function getPlayerTeam(player)
    if player.Team then
        return player.Team.Name
    end
    return "None"
end

-- Get current player data
local function getCurrentPlayers()
    local playerData = {}
    
    for _, player in pairs(Players:GetPlayers()) do
        if player.UserId > 0 then -- Exclude guests/invalid users
            table.insert(playerData, {
                userId = player.UserId,
                name = player.Name,
                team = getPlayerTeam(player),
                joinedAt = os.time() * 1000 -- Convert to milliseconds
            })
        end
    end
    
    return playerData
end

-- Send data to API with retry logic
local function sendToAPI(data, attempt)
    attempt = attempt or 1
    
    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = CONFIG.API_URL,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["Authorization"] = "Bearer " .. CONFIG.API_TOKEN
            },
            Body = HttpService:JSONEncode(data)
        })
    end)
    
    if success and response.Success and response.StatusCode == 200 then
        log("Successfully sent data to API")
        return true
    else
        local errorMsg = "Failed to send data to API"
        if response then
            errorMsg = errorMsg .. " (Status: " .. tostring(response.StatusCode) .. ")"
            if response.Body then
                errorMsg = errorMsg .. " Body: " .. tostring(response.Body)
            end
        else
            errorMsg = errorMsg .. " (Network error)"
        end
        
        warn(errorMsg)
        
        -- Retry logic
        if attempt < CONFIG.RETRY_ATTEMPTS then
            log("Retrying in " .. CONFIG.RETRY_DELAY .. " seconds... (Attempt " .. (attempt + 1) .. "/" .. CONFIG.RETRY_ATTEMPTS .. ")")
            wait(CONFIG.RETRY_DELAY)
            return sendToAPI(data, attempt + 1)
        else
            warn("Max retry attempts reached. Giving up.")
            return false
        end
    end
end

-- Update server data
local function updateServerData()
    local currentTime = os.time()
    
    -- Don't update too frequently
    if currentTime - ActivityTracker.lastUpdate < CONFIG.UPDATE_INTERVAL then
        return
    end
    
    ActivityTracker.lastUpdate = currentTime
    ActivityTracker.players = getCurrentPlayers()
    
    local data = {
        serverId = ActivityTracker.serverId,
        players = ActivityTracker.players,
        renewCreate = false
    }
    
    log("Updating server data with " .. #ActivityTracker.players .. " players")
    sendToAPI(data)
end

-- Event handlers
local function onPlayerAdded(player)
    log("Player joined: " .. player.Name .. " (ID: " .. player.UserId .. ")")
    -- Update immediately when a player joins
    spawn(function()
        wait(1) -- Small delay to ensure team assignment is complete
        updateServerData()
    end)
end

local function onPlayerRemoving(player)
    log("Player leaving: " .. player.Name .. " (ID: " .. player.UserId .. ")")
    -- Update immediately when a player leaves
    spawn(function()
        wait(1) -- Small delay to ensure cleanup is complete
        updateServerData()
    end)
end

local function onPlayerTeamChanged(player)
    log("Player team changed: " .. player.Name .. " -> " .. getPlayerTeam(player))
    -- Update when team changes
    spawn(function()
        updateServerData()
    end)
end

-- Initialize the tracker
function ActivityTracker:Initialize()
    if self.isRunning then
        warn("ActivityTracker is already running!")
        return
    end
    
    log("Initializing ActivityTracker...")
    log("Server ID: " .. self.serverId)
    
    -- Connect event handlers
    Players.PlayerAdded:Connect(onPlayerAdded)
    Players.PlayerRemoving:Connect(onPlayerRemoving)
    
    -- Monitor team changes for existing players
    for _, player in pairs(Players:GetPlayers()) do
        if player:FindFirstChild("Team") then
            player:GetPropertyChangedSignal("Team"):Connect(function()
                onPlayerTeamChanged(player)
            end)
        end
    end
    
    -- Monitor team changes for new players
    Players.PlayerAdded:Connect(function(player)
        player:GetPropertyChangedSignal("Team"):Connect(function()
            onPlayerTeamChanged(player)
        end)
    end)
    
    -- Set up periodic updates
    self.connection = RunService.Heartbeat:Connect(function()
        updateServerData()
    end)
    
    self.isRunning = true
    
    -- Send initial data
    spawn(function()
        wait(2) -- Wait a bit for everything to initialize
        updateServerData()
    end)
    
    log("ActivityTracker initialized successfully!")
end

-- Stop the tracker
function ActivityTracker:Stop()
    if not self.isRunning then
        warn("ActivityTracker is not running!")
        return
    end
    
    log("Stopping ActivityTracker...")
    
    if self.connection then
        self.connection:Disconnect()
        self.connection = nil
    end
    
    self.isRunning = false
    log("ActivityTracker stopped.")
end

-- Cleanup when server shuts down
game:BindToClose(function()
    if ActivityTracker.isRunning then
        log("Server shutting down, cleaning up...")
        ActivityTracker:Stop()
        
        -- Send final update to remove server from API
        local data = {
            serverId = ActivityTracker.serverId,
            players = {},
            renewCreate = false
        }
        sendToAPI(data)
    end
end)

-- Auto-start the tracker
ActivityTracker:Initialize()

return ActivityTracker