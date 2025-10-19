#!/usr/bin/env python3
"""
client_eel.py - Eel-based Client with Extraordinary Sleek Dark UI
"""

import eel
import socket
import threading
import json
import time
import os
from datetime import datetime
from typing import Optional, Dict, List

# Initialize Eel with web folder
eel.init('web')

# Global state
class ClientState:
    def __init__(self):
        self.username: Optional[str] = None
        self.server_host = "localhost"
        self.server_port = 5555
        self.file_port = 5556
        self.socket: Optional[socket.socket] = None
        self.running = False
        self.buffer = b""
        self.connected = False
        self.files: Dict[str, Dict] = {}
        self.online_users: List[str] = []
        self.groups: Dict[str, Dict] = {}
        self.current_chat_type = 'global'
        self.current_chat_target = None

state = ClientState()

# Socket receive thread
def receive_messages():
    """Background thread to receive messages"""
    state.buffer = b""
    while state.running:
        try:
            data = state.socket.recv(4096)
            if not data:
                break
            
            state.buffer += data
            
            while b'\n' in state.buffer:
                message_data, state.buffer = state.buffer.split(b'\n', 1)
                
                if message_data.strip():
                    try:
                        message = json.loads(message_data.decode('utf-8'))
                        print(f"[CLIENT] Received: {message.get('type')}")
                        # Send to frontend
                        eel.handleMessage(message)
                    except json.JSONDecodeError as e:
                        print(f"Invalid JSON: {e}")
        
        except (ConnectionResetError, BrokenPipeError):
            if state.running:
                eel.showError("Connection lost")
            break
        except Exception as e:
            if state.running:
                print(f"Receive error: {e}")
            break
    
    state.running = False
    state.connected = False
    eel.onDisconnected()

@eel.expose
def connect_to_server(username: str, host: str, port: int):
    """Connect to the collaboration server"""
    try:
        state.username = username
        state.server_host = host
        state.server_port = port
        
        state.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        state.socket.settimeout(5.0)
        state.socket.connect((host, port))
        
        # Send username
        state.socket.send((json.dumps({
            'username': username
        }) + '\n').encode('utf-8'))
        
        state.socket.settimeout(None)
        state.running = True
        state.connected = True
        
        # Start receive thread
        thread = threading.Thread(target=receive_messages, daemon=True)
        thread.start()
        
        print(f"[CLIENT] Connected as {username}")
        return {'success': True, 'message': 'Connected successfully'}
    
    except socket.timeout:
        return {'success': False, 'message': 'Connection timeout'}
    except ConnectionRefusedError:
        return {'success': False, 'message': 'Connection refused. Is the server running?'}
    except Exception as e:
        return {'success': False, 'message': f'Connection error: {str(e)}'}

@eel.expose
def send_message(message_type: str, content: str, extra_params: dict = None):
    """Send a message to the server"""
    if not state.running or not state.socket:
        print("[CLIENT] Not connected or socket unavailable")
        return {'success': False, 'message': 'Not connected'}
    
    try:
        message = {
            'type': message_type,
            'sender': state.username,
            'content': content,
            'timestamp': datetime.now().strftime("%H:%M:%S")
        }
        
        # Add extra parameters if provided
        if extra_params:
            message.update(extra_params)
        
        print(f"[CLIENT] Sending {message_type}: {content[:30] if content else 'empty'}")
        state.socket.send((json.dumps(message) + '\n').encode('utf-8'))
        return {'success': True}
    except Exception as e:
        print(f"Send error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def disconnect_from_server():
    """Disconnect from server"""
    state.running = False
    if state.socket:
        try:
            state.socket.close()
        except:
            pass
    state.connected = False
    return {'success': True}

@eel.expose
def upload_file(file_path: str):
    """Upload a file to the server"""
    if not state.connected:
        return {'success': False, 'message': 'Not connected'}
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(30.0)
        sock.connect((state.server_host, state.file_port))
        
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        # Send metadata
        metadata = {
            'file_name': file_name,
            'file_size': file_size,
            'sender': state.username
        }
        sock.send(json.dumps(metadata).encode('utf-8'))
        
        # Wait for ready signal
        response = json.loads(sock.recv(1024).decode('utf-8'))
        if response.get('status') != 'ready':
            sock.close()
            return {'success': False, 'message': 'Server not ready'}
        
        file_id = response.get('file_id')
        
        # Send file data
        with open(file_path, 'rb') as f:
            bytes_sent = 0
            while bytes_sent < file_size:
                chunk = f.read(4096)
                if not chunk:
                    break
                sock.sendall(chunk)
                bytes_sent += len(chunk)
                progress = int((bytes_sent / file_size) * 100)
                eel.updateProgress(progress)
        
        sock.close()
        print(f"[CLIENT] File uploaded: {file_name}")
        return {'success': True, 'file_id': file_id, 'file_name': file_name}
    
    except Exception as e:
        print(f"Upload error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def download_file(file_id: str):
    """Download a file from the server"""
    if not state.connected:
        return {'success': False, 'message': 'Not connected'}
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(30.0)
        sock.connect((state.server_host, state.file_port))
        
        # Request file
        request = {
            'file_id': file_id,
            'requester': state.username
        }
        sock.send(json.dumps(request).encode('utf-8'))
        
        # Get file metadata
        response = json.loads(sock.recv(1024).decode('utf-8'))
        if response.get('status') == 'error':
            sock.close()
            return {'success': False, 'message': response.get('message', 'Unknown error')}
        
        file_name = response.get('file_name')
        file_size = response.get('file_size')
        
        # Send ready signal
        sock.send(b'ready')
        
        # Receive file
        file_data = b''
        bytes_received = 0
        while bytes_received < file_size:
            chunk = sock.recv(4096)
            if not chunk:
                break
            file_data += chunk
            bytes_received += len(chunk)
        
        # Save file
        downloads_dir = os.path.expanduser('~/Downloads')
        file_path = os.path.join(downloads_dir, file_name)
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        sock.close()
        print(f"[CLIENT] File downloaded: {file_name}")
        return {'success': True, 'file_path': file_path}
    
    except Exception as e:
        print(f"Download error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def get_state():
    """Get current client state"""
    return {
        'username': state.username,
        'connected': state.connected,
        'users': state.online_users,
        'files': state.files,
        'groups': state.groups
    }

@eel.expose
def refresh_user_list():
    """Refresh user list by requesting from server"""
    if state.connected and state.socket:
        try:
            # Request user list from server
            request = {
                'type': 'request_user_list',
                'sender': state.username,
                'timestamp': datetime.now().strftime("%H:%M:%S")
            }
            state.socket.send((json.dumps(request) + '\n').encode('utf-8'))
            return {'success': True}
        except Exception as e:
            print(f"Refresh error: {e}")
            return {'success': False, 'message': str(e)}
    return {'success': False, 'message': 'Not connected'}

# Start the Eel app
if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    try:
        eel.start('index.html', size=(1600, 1000), port=port)
    except Exception as e:
        print(f"Error starting Eel: {e}")