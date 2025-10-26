#!/usr/bin/env python3
"""
Test script to check if required ports are available
"""

import socket

def check_port(port, description):
    """Check if a port is available"""
    try:
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        test_socket.settimeout(1)
        result = test_socket.connect_ex(('localhost', port))
        test_socket.close()
        
        if result == 0:
            print(f"❌ Port {port} ({description}): IN USE")
            return False
        else:
            print(f"✅ Port {port} ({description}): Available")
            return True
    except Exception as e:
        print(f"⚠️  Port {port} ({description}): Error checking - {e}")
        return False

def main():
    print("=" * 60)
    print("Shadow Nexus Port Availability Check")
    print("=" * 60)
    print()
    
    print("Server Ports:")
    print("-" * 60)
    server_ports = [
        (5555, "Chat Server"),
        (5556, "File Transfer Server"),
        (5557, "Audio Server"),
        (5000, "Video Server")
    ]
    
    server_available = True
    for port, desc in server_ports:
        if not check_port(port, desc):
            server_available = False
    
    print()
    print("Client Ports:")
    print("-" * 60)
    client_ports = [
        (8081, "Client Web UI (Default)"),
        (8082, "Client Web UI (Fallback 1)"),
        (8083, "Client Web UI (Fallback 2)")
    ]
    
    client_available = 0
    for port, desc in client_ports:
        if check_port(port, desc):
            client_available += 1
    
    print()
    print("=" * 60)
    print("Summary:")
    print("=" * 60)
    
    if server_available:
        print("✅ All server ports are available")
        print("   You can start the server without conflicts")
    else:
        print("⚠️  Some server ports are in use")
        print("   Check if the server is already running")
        print("   Or another application is using these ports")
    
    print()
    
    if client_available > 0:
        print(f"✅ {client_available} client port(s) available")
        print("   You can run the client without conflicts")
    else:
        print("⚠️  No client ports available")
        print("   Close some applications or use a custom port")
    
    print()
    print("=" * 60)

if __name__ == '__main__':
    main()
    input("\nPress Enter to exit...")
