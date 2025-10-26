# Port Configuration Guide

## Overview
Shadow Nexus uses multiple ports for different services. This guide explains how ports are allocated and how to avoid conflicts.

## Port Allocation

### Server Ports (Fixed)
The server uses **fixed ports** that should be consistent across the network:

- **Port 5555**: Main chat server (TCP)
- **Port 5556**: File transfer server (TCP)
- **Port 5557**: Audio streaming server (TCP)
- **Port 5000**: Video call server (HTTPS)

**Important**: Only ONE server should run on the network. All clients connect to this single server.

### Client Ports (Dynamic)
Each client instance uses a **local web server port** for the Eel interface:

- **Default**: Port 8081
- **Auto-detection**: If 8081 is in use, automatically tries 8082, 8083, etc.
- **Range**: 8081-8090 (10 attempts)

## Multiple Users Scenarios

### Scenario 1: Multiple Users on Different Machines ✅
**No conflicts!** Each user runs the client on their own machine.
- User A on Machine 1: Uses port 8081
- User B on Machine 2: Uses port 8081
- User C on Machine 3: Uses port 8081

All connect to the same server (ports 5555-5557).

### Scenario 2: Multiple Users on the Same Machine ✅
**Automatically handled!** The client finds available ports.
- First instance: Uses port 8081
- Second instance: Automatically uses port 8082
- Third instance: Automatically uses port 8083

All still connect to the same server.

### Scenario 3: Multiple Servers (NOT RECOMMENDED) ⚠️
Running multiple servers will create separate chat rooms:
- Server 1 on Machine A: Ports 5555-5557
- Server 2 on Machine B: Ports 5555-5557

Clients connecting to Server 1 won't see messages from clients on Server 2.

## Port Conflict Resolution

### Client Port Conflicts
The client automatically handles port conflicts:

```python
# Automatic port detection
port = find_available_port(8081)  # Tries 8081, 8082, 8083...
```

If all ports (8081-8090) are in use, the client will fall back to 8081 and show an error.

### Server Port Conflicts
If the server fails to start with "Address already in use":

1. **Check if server is already running**:
   ```bash
   # Windows
   netstat -ano | findstr :5555
   
   # Linux/Mac
   lsof -i :5555
   ```

2. **Stop the existing server** or use a different port:
   ```python
   # In server.py, change the port
   server = CollaborationServer(host='0.0.0.0', port=5556)
   ```

3. **Update clients** to connect to the new port:
   ```python
   # In client.py
   self.server_port = 5556  # Match server port
   ```

## Firewall Configuration

### For Server Host
Open these ports in your firewall:
- TCP 5555 (Chat)
- TCP 5556 (Files)
- TCP 5557 (Audio)
- TCP 5000 (Video)

### For Clients
No incoming ports needed. Clients only make outbound connections.

## Testing Port Availability

Use the included test script:

```bash
python test_ports.py
```

This will check if all required ports are available.

## Troubleshooting

### "Port already in use" Error
**Solution**: The client will automatically try the next available port. No action needed.

### "Connection refused" Error
**Possible causes**:
1. Server is not running
2. Wrong server IP address
3. Firewall blocking connection
4. Server using different ports

**Solution**: Verify server is running and check IP/port configuration.

### Multiple Clients Can't Connect
**Possible cause**: Server port conflict

**Solution**: Ensure only one server instance is running on the network.

## Best Practices

1. ✅ Run ONE server per network
2. ✅ Let clients auto-detect available ports
3. ✅ Use default ports unless there's a conflict
4. ✅ Document any custom port changes
5. ❌ Don't run multiple servers unless you want separate chat rooms

## Advanced: Custom Port Configuration

### Running Client on Specific Port
```bash
python client.py 9000
```

### Running Server on Custom Ports
Edit `server.py`:
```python
if __name__ == '__main__':
    server = CollaborationServer(
        host='0.0.0.0',
        port=6000,      # Custom chat port
        file_port=6001  # Custom file port
    )
    server.start()
```

Then update `client.py` to match:
```python
self.server_port = 6000
self.file_port = 6001
```

## Summary

- **Server ports**: Fixed (5555-5557, 5000)
- **Client ports**: Dynamic (8081+)
- **Multiple users**: Automatically handled ✅
- **Port conflicts**: Auto-resolved for clients ✅
- **One server per network**: Recommended ✅
