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
import base64
from datetime import datetime
from typing import Optional, Dict, List

# Import audio module
from audio_module import AudioEngine, audio_engine as global_audio_engine

# Initialize Eel with web folder
eel.init('web')

# Global state
class ClientState:
    def __init__(self):
        self.username: Optional[str] = None
        self.server_host = "localhost"
        self.server_port = 5555
        self.file_port = 5556
        self.audio_port = 5557
        self.socket: Optional[socket.socket] = None
        self.running = False
        self.buffer = b""
        self.connected = False
        self.files: Dict[str, Dict] = {}
        self.online_users: List[str] = []
        self.groups: Dict[str, Dict] = {}
        self.current_chat_type = 'global'
        self.current_chat_target = None
        self.audio_engine = None

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
        
        # Initialize audio engine
        state.audio_engine = AudioEngine(username, host, state.audio_port)
        
        # Set the global audio_engine reference
        import audio_module
        audio_module.audio_engine = state.audio_engine
        
        # Start receive thread
        thread = threading.Thread(target=receive_messages, daemon=True)
        thread.start()
        
        print(f"[CLIENT] Connected as {username}")
        
        # Wait a moment for connection to stabilize
        time.sleep(0.2)
        
        # Request chat history with proper parameters
        request_chat_history_msg = {
            'type': 'request_chat_history',
            'sender': username,
            'chat_type': 'global',
            'timestamp': datetime.now().strftime("%H:%M:%S")
        }
        state.socket.send((json.dumps(request_chat_history_msg) + '\n').encode('utf-8'))
        print("[CLIENT] Requested global chat history")
        
        # Wait a moment before requesting user list
        time.sleep(0.1)
        
        # Request online users list
        user_list_request = {
            'type': 'get_users',
            'sender': username,
            'timestamp': datetime.now().strftime("%H:%M:%S")
        }
        state.socket.send((json.dumps(user_list_request) + '\n').encode('utf-8'))
        print("[CLIENT] Requested user list")
        
        # Request groups list
        time.sleep(0.1)
        groups_request = {
            'type': 'request_groups',
            'sender': username,
            'timestamp': datetime.now().strftime("%H:%M:%S")
        }
        state.socket.send((json.dumps(groups_request) + '\n').encode('utf-8'))
        print("[CLIENT] Requested groups list")
        
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
    
    # Stop audio engine if running
    if state.audio_engine:
        try:
            state.audio_engine.stop()
        except:
            pass
    
    state.connected = False
    return {'success': True}

@eel.expose
def send_audio_message(audio_data, duration):
    """Send audio message to current chat context"""
    if not state.connected or not state.socket:
        return {'success': False, 'message': 'Not connected'}
    
    try:
        print(f"[CLIENT] Sending audio message ({len(audio_data) // 1024} KB)")
        
        # Create message based on current chat context
        if state.current_chat_type == 'private' and state.current_chat_target:
            message_type = 'private_audio'
            extra_params = {'receiver': state.current_chat_target}
        elif state.current_chat_type == 'group' and state.current_chat_target:
            message_type = 'group_audio'
            extra_params = {'group_id': state.current_chat_target}
        else:
            message_type = 'audio_share'  # Global audio
            extra_params = {}
            
        # Add audio metadata
        extra_params['audio_data'] = audio_data
        extra_params['duration'] = duration
        
        # Send the message
        result = send_message(message_type, '', extra_params)
        return result
    except Exception as e:
        print(f"[CLIENT] Send audio error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def upload_file(file_name: str, file_size: int, file_data):
    """Upload a file to the server"""
    if not state.connected:
        return {'success': False, 'message': 'Not connected'}
    
    if not file_name or not file_data:
        return {'success': False, 'message': 'No file selected'}
    
    # Check file size limit (2GB = 2 * 1024 * 1024 * 1024 bytes)
    MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB
    if file_size > MAX_FILE_SIZE:
        return {'success': False, 'message': f'File too large. Maximum size is 2GB'}
    
    try:
        import base64
        
        # Decode base64 data if it's a string
        if isinstance(file_data, str):
            file_bytes = base64.b64decode(file_data)
        else:
            file_bytes = file_data
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(120.0)  # Increase timeout to 2 minutes for large files
        sock.connect((state.server_host, state.file_port))
        
        print(f"[CLIENT] Uploading file: {file_name} ({file_size} bytes)")
        
        # Send metadata
        metadata = {
            'file_name': file_name,
            'file_size': file_size,
            'sender': state.username
        }
        sock.send(json.dumps(metadata).encode('utf-8') + b'\n')
        
        # Wait for ready signal
        response = json.loads(sock.recv(1024).decode('utf-8'))
        if response.get('status') != 'ready':
            sock.close()
            return {'success': False, 'message': 'Server not ready'}
        
        file_id = response.get('file_id')
        
        # Send file data
        sock.sendall(file_bytes)
        
        print(f"[CLIENT] File upload complete: {file_name}")
        print(f"[CLIENT] File uploaded successfully: {file_name}")
        return {'success': True, 'file_id': file_id, 'file_name': file_name}
    
    except FileNotFoundError:
        return {'success': False, 'message': 'File not found on disk'}
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
def set_current_chat(chat_type: str, chat_target: str = None):
    """Set the current chat context for sending messages"""
    state.current_chat_type = chat_type
    state.current_chat_target = chat_target
    print(f"[CLIENT] Chat context set to: {chat_type} -> {chat_target}")
    
    # When switching chats, request the chat history for that context
    if chat_type == 'private' and chat_target:
        request_msg = {
            'type': 'request_private_history',
            'sender': state.username,
            'receiver': chat_target,
            'timestamp': datetime.now().strftime("%H:%M:%S")
        }
        state.socket.send((json.dumps(request_msg) + '\n').encode('utf-8'))
        print(f"[CLIENT] Requested private chat history with {chat_target}")
    elif chat_type == 'group' and chat_target:
        request_msg = {
            'type': 'request_group_history',
            'sender': state.username,
            'group_id': chat_target,
            'timestamp': datetime.now().strftime("%H:%M:%S")
        }
        state.socket.send((json.dumps(request_msg) + '\n').encode('utf-8'))
        print(f"[CLIENT] Requested group chat history for {chat_target}")
    elif chat_type == 'global':
        request_msg = {
            'type': 'request_chat_history',
            'sender': state.username,
            'chat_type': 'global',
            'timestamp': datetime.now().strftime("%H:%M:%S")
        }
        state.socket.send((json.dumps(request_msg) + '\n').encode('utf-8'))
        print(f"[CLIENT] Requested global chat history")
    
    return {'success': True}

@eel.expose
def start_video_call(chat_type, chat_id):
    """Start a video call"""
    try:
        import requests
        
        # Determine session name
        if chat_type == 'global':
            session_name = 'Global Video Call'
        elif chat_type == 'private':
            session_name = f'Private Video Call'
        elif chat_type == 'group':
            session_name = f'Group Video Call - {chat_id}'
        else:
            session_name = 'Video Call'
        
        # Call video server API to create session with chat_id
        response = requests.post('http://localhost:5000/api/create_session', json={
            'session_type': chat_type,
            'session_name': session_name,
            'creator': state.username,
            'chat_id': chat_id  # CRITICAL: Pass chat_id to video server
        })
        
        if response.status_code != 200:
            return {'success': False, 'error': 'Failed to create video session'}
        
        result = response.json()
        
        if result.get('success'):
            session_id = result['session_id']
            link = result['link']
            
            print(f"[CLIENT] Video session created: {session_id}")
            print(f"[CLIENT] Video link: {link}")
            print(f"[CLIENT] Chat type: {chat_type}, Chat ID: {chat_id}")
            
            # Send video invite to appropriate recipients
            if chat_type == 'global':
                message_type = 'video_invite'
                message_data = {
                    'type': message_type,
                    'sender': state.username,
                    'session_id': session_id,
                    'link': link,
                    'timestamp': datetime.now().strftime("%H:%M:%S")
                }
                print(f"[CLIENT] Sending global video invite")
            elif chat_type == 'private':
                message_type = 'video_invite_private'
                message_data = {
                    'type': message_type,
                    'sender': state.username,
                    'receiver': chat_id,
                    'session_id': session_id,
                    'link': link,
                    'timestamp': datetime.now().strftime("%H:%M:%S")
                }
                print(f"[CLIENT] Sending private video invite to: {chat_id}")
            elif chat_type == 'group':
                message_type = 'video_invite_group'
                message_data = {
                    'type': message_type,
                    'sender': state.username,
                    'group_id': chat_id,
                    'session_id': session_id,
                    'link': link,
                    'timestamp': datetime.now().strftime("%H:%M:%S")
                }
                print(f"[CLIENT] Sending group video invite to group: {chat_id}")
            else:
                return {'success': False, 'error': 'Invalid chat type'}
            
            # Send the video invite message to server
            if state.connected and state.socket:
                print(f"[CLIENT] Sending video invite message: {message_type}")
                print(f"[CLIENT] Message data: {message_data}")
                state.socket.send((json.dumps(message_data) + '\n').encode('utf-8'))
                print(f"[CLIENT] Video invite message sent successfully")
            else:
                print(f"[CLIENT] ERROR: Not connected or no socket available")
            
            return result
        else:
            return result
    except Exception as e:
        print(f"[CLIENT] Video call error: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def refresh_user_list():
    """Refresh user list by requesting from server"""
    if state.connected and state.socket:
        try:
            # Request user list from server
            request = {
                'type': 'get_users',
                'sender': state.username,
                'timestamp': datetime.now().strftime("%H:%M:%S")
            }
            state.socket.send((json.dumps(request) + '\n').encode('utf-8'))
            print("[CLIENT] Refreshing user list")
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