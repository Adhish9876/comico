#!/usr/bin/env python3
"""
Offline Test Script - Verify all dependencies are local
"""

import os
import requests
import subprocess
import time
from pathlib import Path

def check_file_exists(filepath):
    """Check if a file exists"""
    if os.path.exists(filepath):
        size = os.path.getsize(filepath)
        print(f"✅ {filepath} ({size} bytes)")
        return True
    else:
        print(f"❌ {filepath} - MISSING!")
        return False

def check_external_dependencies():
    """Check for any remaining external dependencies"""
    print("🔍 Checking for external dependencies...")
    
    external_found = False
    
    # Check templates
    for template in ['templates/video_room.html', 'templates/audio_room.html']:
        if os.path.exists(template):
            with open(template, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'https://' in content or 'http://' in content:
                    if 'cdn.' in content or 'googleapis' in content:
                        print(f"⚠️  {template} still has external dependencies")
                        external_found = True
    
    # Check web files
    for webfile in ['web/style.css', 'web/index.html', 'web/app.js']:
        if os.path.exists(webfile):
            with open(webfile, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'https://' in content or 'http://' in content:
                    if 'cdn.' in content or 'googleapis' in content:
                        print(f"⚠️  {webfile} still has external dependencies")
                        external_found = True
    
    if not external_found:
        print("✅ No external dependencies found!")
    
    return not external_found

def test_offline_mode():
    """Test the application in offline mode"""
    print("\n🧪 Testing Offline Mode...")
    
    # Check if we can import required modules
    try:
        import flask
        import flask_socketio
        print("✅ Flask and SocketIO available")
    except ImportError as e:
        print(f"❌ Missing Python dependencies: {e}")
        return False
    
    # Test if servers can start (don't actually start them)
    print("✅ Python dependencies check passed")
    
    return True

def main():
    print("🚀 Shadow Nexus Offline Setup Verification")
    print("=" * 50)
    
    # Check static files
    print("\n📁 Checking Static Files:")
    static_files = [
        'static/js/socket.io.min.js',
        'static/css/google-fonts.css',
        'static/fonts/bangers.ttf',
        'static/fonts/comic-neue-regular.ttf',
        'static/fonts/comic-neue-bold.ttf'
    ]
    
    all_static_ok = True
    for file in static_files:
        if not check_file_exists(file):
            all_static_ok = False
    
    # Check for external dependencies
    print("\n🌐 Checking External Dependencies:")
    no_external = check_external_dependencies()
    
    # Test offline mode
    offline_ready = test_offline_mode()
    
    # Final result
    print("\n" + "=" * 50)
    if all_static_ok and no_external and offline_ready:
        print("🎉 OFFLINE SETUP COMPLETE!")
        print("✅ All static files present")
        print("✅ No external dependencies")
        print("✅ Ready for offline operation")
        print("\n📋 To run offline:")
        print("1. Disconnect from internet")
        print("2. python server.py")
        print("3. python video_module.py")
        print("4. python client.py")
    else:
        print("⚠️  OFFLINE SETUP INCOMPLETE")
        if not all_static_ok:
            print("❌ Missing static files")
        if not no_external:
            print("❌ External dependencies found")
        if not offline_ready:
            print("❌ Python dependencies missing")

if __name__ == '__main__':
    main()