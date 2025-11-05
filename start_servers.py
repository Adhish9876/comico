#!/usr/bin/env python3
"""
Shadow Nexus - Start All Servers
Runs Chat Server (8082) and Video Server (5000) with SSL warnings suppressed
"""

import subprocess
import sys
import time
import os
import signal
import socket

# Suppress SSL warnings globally
import warnings
warnings.filterwarnings('ignore', message='.*SSL.*')
warnings.filterwarnings('ignore', category=DeprecationWarning)

def is_port_in_use(port):
    """Check if port is already in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def kill_port(port):
    """Kill process using specified port"""
    try:
        if sys.platform == 'win32':
            os.system(f'netstat -ano | findstr :{port} | for /f "tokens=5" %a in (\'findstr /r /c:":{port}"\') do taskkill /PID %a /F 2>nul')
        else:
            os.system(f'lsof -ti:{port} | xargs kill -9 2>/dev/null')
        print(f"✓ Freed port {port}")
    except Exception as e:
        pass

def filter_output(line):
    """Filter out SSL and SSL-related warnings"""
    ignore_keywords = [
        'ssl', 'SSL', 'warning', 'Warning', 'DeprecationWarning',
        'HTTP_REQUEST', '_ssl.c', 'eventlet', 'Traceback',
        'File "C:\\Users', 'File "\\', 'OSError', 'ssl.SSLError'
    ]
    
    for keyword in ignore_keywords:
        if keyword in line:
            return False
    
    return True

def run_chat_server():
    """Run chat server with output filtering"""
    print("\n📡 Starting Chat Server on port 8082...")
    print("=" * 50)
    
    env = os.environ.copy()
    env['PYTHONWARNINGS'] = 'ignore'
    
    try:
        process = subprocess.Popen(
            [sys.executable, 'server.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )
        
        for line in process.stdout:
            if filter_output(line):
                print(line.rstrip())
    except KeyboardInterrupt:
        process.terminate()
    except Exception as e:
        print(f"❌ Error running chat server: {e}")

def run_video_server():
    """Run video server with output filtering"""
    print("\n📹 Starting Video Server on port 5000...")
    print("=" * 50)
    
    env = os.environ.copy()
    env['PYTHONWARNINGS'] = 'ignore'
    
    try:
        process = subprocess.Popen(
            [sys.executable, '-W', 'ignore', 'video_module.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )
        
        for line in process.stdout:
            if filter_output(line):
                print(line.rstrip())
    except KeyboardInterrupt:
        process.terminate()
    except Exception as e:
        print(f"❌ Error running video server: {e}")

def main():
    print("\n" + "=" * 60)
    print("🚀 Shadow Nexus - Starting All Servers")
    print("=" * 60)
    
    # Clean up old processes
    print("\n🧹 Cleaning up old processes...")
    if is_port_in_use(5000):
        print("⏳ Port 5000 is in use, killing process...")
        kill_port(5000)
        time.sleep(1)
    
    if is_port_in_use(8082):
        print("⏳ Port 8082 is in use, killing process...")
        kill_port(8082)
        time.sleep(1)
    
    # Start servers in separate processes
    import concurrent.futures
    
    print("\n" + "=" * 60)
    print("Starting servers...")
    print("=" * 60)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both server tasks
        chat_future = executor.submit(run_chat_server)
        video_future = executor.submit(run_video_server)
        
        # Wait for both
        try:
            concurrent.futures.wait([chat_future, video_future])
        except KeyboardInterrupt:
            print("\n\n⏹️  Shutting down servers...")
            executor.shutdown(wait=False)
            sys.exit(0)

if __name__ == '__main__':
    main()
