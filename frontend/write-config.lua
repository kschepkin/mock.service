-- Lua script for writing configuration file
-- This script handles PUT requests to write config data to a file

-- Get request method
local method = ngx.var.request_method

-- Only allow PUT method for writing
if method ~= "PUT" then
    ngx.status = 405
    ngx.header.content_type = "application/json"
    ngx.say('{"success": false, "error": "Method not allowed"}')
    return
end

-- Check for config write header
local config_write = ngx.var.http_x_config_write
if not config_write or config_write ~= "true" then
    ngx.status = 403
    ngx.header.content_type = "application/json"  
    ngx.say('{"success": false, "error": "Missing config write header"}')
    return
end

-- Read request body
ngx.req.read_body()
local body = ngx.req.get_body_data()

if not body then
    ngx.status = 400
    ngx.header.content_type = "application/json"
    ngx.say('{"success": false, "error": "No data provided"}')
    return
end

-- Validate JSON
local cjson = require "cjson"
local success, config = pcall(cjson.decode, body)
if not success then
    ngx.status = 400
    ngx.header.content_type = "application/json"
    ngx.say('{"success": false, "error": "Invalid JSON"}')
    return
end

-- Validate required fields
if not config.domain or not config.protocol then
    ngx.status = 400
    ngx.header.content_type = "application/json"
    ngx.say('{"success": false, "error": "Missing required fields"}')
    return
end

-- Validate protocol
if config.protocol ~= "http" and config.protocol ~= "https" then
    ngx.status = 400
    ngx.header.content_type = "application/json"
    ngx.say('{"success": false, "error": "Invalid protocol"}')
    return
end

-- Validate port if provided and not empty
if config.port and config.port ~= "" then
    local port = tonumber(config.port)
    if not port or port < 1 or port > 65535 then
        ngx.status = 400
        ngx.header.content_type = "application/json"
        ngx.say('{"success": false, "error": "Invalid port"}')
        return
    end
end

-- Validate basePath if provided
if config.basePath and config.basePath ~= "" then
    if not string.match(config.basePath, "^[a-zA-Z0-9/_-]*$") then
        ngx.status = 400
        ngx.header.content_type = "application/json"
        ngx.say('{"success": false, "error": "Invalid basePath"}')
        return
    end
end

-- Write to file
local config_file = "/usr/local/openresty/nginx/html/config/api-settings.json"
local file = io.open(config_file, "w")

if not file then
    ngx.status = 500
    ngx.header.content_type = "application/json"
    ngx.say('{"success": false, "error": "Cannot write to config file"}')
    return
end

file:write(body)
file:close()

-- Return success response
ngx.status = 200
ngx.header.content_type = "application/json"
ngx.say('{"success": true, "message": "Configuration saved successfully"}')