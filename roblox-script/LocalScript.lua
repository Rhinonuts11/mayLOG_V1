-- Optional LocalScript for client-side features
-- Place this in StarterPlayerScripts if you need client-side functionality

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer

-- This script can be used for client-side activity tracking features
-- such as UI updates, notifications, etc.

print("[Activity API Client] LocalScript loaded for player:", player.Name)

-- Example: Listen for team changes and show notifications
player:GetPropertyChangedSignal("Team"):Connect(function()
    local teamName = player.Team and player.Team.Name or "No Team"
    print("[Activity API Client] Your team changed to:", teamName)
    
    -- You could add GUI notifications here
    -- Example: Show a notification when team changes
end)

-- Example: Create a simple GUI to show activity status
local function createActivityGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "ActivityTracker"
    screenGui.Parent = player:WaitForChild("PlayerGui")
    
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0, 200, 0, 100)
    frame.Position = UDim2.new(1, -210, 0, 10)
    frame.BackgroundColor3 = Color3.fromRGB(50, 50, 50)
    frame.BorderSizePixel = 0
    frame.Parent = screenGui
    
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 8)
    corner.Parent = frame
    
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 30)
    title.Position = UDim2.new(0, 0, 0, 0)
    title.BackgroundTransparency = 1
    title.Text = "Activity Tracker"
    title.TextColor3 = Color3.fromRGB(255, 255, 255)
    title.TextScaled = true
    title.Font = Enum.Font.SourceSansBold
    title.Parent = frame
    
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(1, -10, 0, 25)
    statusLabel.Position = UDim2.new(0, 5, 0, 35)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "Status: Active"
    statusLabel.TextColor3 = Color3.fromRGB(0, 255, 0)
    statusLabel.TextScaled = true
    statusLabel.Font = Enum.Font.SourceSans
    statusLabel.Parent = frame
    
    local teamLabel = Instance.new("TextLabel")
    teamLabel.Size = UDim2.new(1, -10, 0, 25)
    teamLabel.Position = UDim2.new(0, 5, 0, 65)
    teamLabel.BackgroundTransparency = 1
    teamLabel.Text = "Team: " .. (player.Team and player.Team.Name or "None")
    teamLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
    teamLabel.TextScaled = true
    teamLabel.Font = Enum.Font.SourceSans
    teamLabel.Parent = frame
    
    -- Update team label when team changes
    player:GetPropertyChangedSignal("Team"):Connect(function()
        teamLabel.Text = "Team: " .. (player.Team and player.Team.Name or "None")
    end)
    
    return screenGui
end

-- Create the GUI
spawn(function()
    wait(2) -- Wait for player to fully load
    createActivityGUI()
end)