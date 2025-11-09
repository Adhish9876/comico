#!/usr/bin/env python3
"""
unified_server.py - Combined Chat + Video Server
Single executable that runs both servers with automatic IP detection
"""

import subprocess
import sys
import os
import signal
import socket
import time
import threading
from pathlib import Path
import warnings
import traceback
import multiprocessing

warnings.filterwarnings('ignore')

class UnifiedShadowNexusServer:
    def __init__(self):
        self.chat_process = None
        self.video_process = None
        self.running = True
        self.server_ip = self.detect_lan_ip()
        
        # Setup .env file
        self.setup_environment()
        
    def detect_lan_ip(self):
        """Detect the LAN IP address automatically"""
        try:
            # Connect to a remote address to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
                return local_ip
        except Exception:
            # Fallback methods
            try:
                hostname = socket.gethostname()
                local_ip = socket.gethostbyname(hostname)
                if local_ip.startswith("127."):
                    # Try getting all network interfaces
                    import subprocess
                    result = subprocess.run(['ipconfig'], capture_output=True, text=True, shell=True)
                    lines = result.stdout.split('\n')
                    for i, line in enumerate(lines):
                        if 'IPv4 Address' in line and '192.168.' in line:
                            return line.split(':')[1].strip()
                return local_ip
            except:
                return "127.0.0.1"  # Ultimate fallback
    
    def setup_environment(self):
        """Create/update .env file with detected IP"""
        env_content = f"""# Shadow Nexus Server Configuration
SERVER_IP={self.server_ip}
CHAT_PORT=5555
FILE_PORT=5556
VIDEO_PORT=5000
AUDIO_PORT=5001
"""
        
        # Determine where to write .env file
        if getattr(sys, 'frozen', False):
            # Running as PyInstaller executable - write .env next to the .exe
            env_path = os.path.join(os.path.dirname(sys.executable), '.env')
        else:
            # Running as Python script
            env_path = os.path.join(os.path.dirname(__file__), '.env')
        
        try:
            with open(env_path, 'w') as f:
                f.write(env_content)
            print(f"✓ Created .env at: {env_path}")
            print(f"✓ SERVER_IP: {self.server_ip}")
        except Exception as e:
            print(f"⚠️ Warning: Could not create .env file: {e}")
    
    def start_chat_server(self):
        """Start the chat server in a separate thread"""
        print("🚀 Starting Chat Server...")
        
        try:
            # Import and run chat server directly
            from backend import server
            chat_server = server.CollaborationServer()
            chat_server.start()
        except Exception as e:
            print(f"❌ Chat server error: {e}")
            traceback.print_exc()
    
    def start_video_server(self):
        """Start the video server in a separate thread"""
        print("📹 Starting Video Server...")
        
        try:
            # Import video module first to check compatibility
            from backend import video_module
            print("✓ Video module loaded successfully")
            
            # Run video server
            video_module.run_server()
            
        except Exception as e:
            print(f"❌ Video server error: {e}")
            print("✓ Chat server will continue running without video functionality")
            # Don't crash the whole server if video fails
    
    def start(self):
        """Start both servers"""
        print("=" * 60)
        print("🚀 Shadow Nexus Unified Server")
        print("=" * 60)
        print(f"🌐 Detected Server IP: {self.server_ip}")
        print(f"📡 Chat Server: {self.server_ip}:5555")
        print(f"📁 File Server: {self.server_ip}:5556") 
        print(f"📹 Video Server: {self.server_ip}:5000")
        print(f"🔊 Audio Server: {self.server_ip}:5001")
        print("=" * 60)
        
        # Start video server in background thread
        video_thread = threading.Thread(target=self.start_video_server, daemon=True)
        video_thread.start()
        
        # Wait a moment for video server to initialize
        time.sleep(2)
        
        # Start chat server in main thread (this will block)
        try:
            self.start_chat_server()
        except KeyboardInterrupt:
            print("\n🛑 Shutting down servers...")
            self.running = False
        except Exception as e:
            print(f"❌ Server error: {e}")
            traceback.print_exc()
        
        print("✅ All servers stopped")

def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully"""
    print("\n🛑 Received shutdown signal...")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start unified server
    server = UnifiedShadowNexusServer()
    server.start()