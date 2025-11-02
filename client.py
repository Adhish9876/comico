#!/usr/bin/env python3
"""
client_eel.py - Eel-based Client with Extraordinary Sleek Dark UI
Updated for hotspot networking with correct server IP
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
import requests
import urllib3
from dotenv import load_dotenv

# Import certificate manager for automatic SSL setup
from cert_manager import setup_certificates, verify_and_fix_certificates

# Load environment variables - check multiple possible locations for .env
import sys
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    application_path = os.path.dirname(sys.executable)
    env_path = os.path.join(application_path, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"[CLIENT] Loaded .env from: {env_path}")
    else:
        # Try in _internal folder (PyInstaller extracts here)
        env_path = os.path.join(application_path, '_internal', '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"[CLIENT] Loaded .env from: {env_path}")
        else:
            print(f"[CLIENT] ⚠️ WARNING: .env file not found!")
else:
    # Running as Python script
    load_dotenv()
    print(f"[CLIENT] Loaded .env from script directory")

SERVER_IP = os.getenv('SERVER_IP', 'localhost')
print(f"[CLIENT] Using SERVER_IP: {SERVER_IP}")

# Ultra-lazy imports for fastest startup
_requests = None
_audio_module = None
_auth_module = None
_numpy = None
_cv2 = None

def get_requests():
    global _requests
    if _requests is None:
        import requests
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        _requests = requests
    return _requests

def get_audio_module():
    global _audio_module
    if _audio_module is None:
        import audio_module
        _audio_module = audio_module
    return _audio_module

def get_auth_module():
    global _auth_module
    if _auth_module is None:
        import auth_module
        _auth_module = auth_module
    return _auth_module

def get_numpy():
    global _numpy
    if _numpy is None:
        import numpy
        _numpy = numpy
    return _numpy

def get_cv2():
    global _cv2
    if _cv2 is None:
        import cv2
        _cv2 = cv2
    return _cv2

# Initialize Eel with web folder
eel.init('web')

# Global state
class ClientState:
    def __init__(self):
        self.username: Optional[str] = None
        self.server_host = SERVER_IP
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
    """Background thread to receive messages with reconnection logic"""
    state.buffer = b""
    print(f"[CLIENT] Starting receive thread for {state.username}")
    
    reconnect_attempts = 0
    max_reconnect_attempts = 5
    reconnect_delay = 5  # Start with 5 second delay
    
    while state.running and state.connected:
        try:
            if not state.socket:
                print("[CLIENT] No socket, breaking receive loop")
                break
            
            # Set a timeout to prevent blocking forever
            state.socket.settimeout(1.0)
            try:
                data = state.socket.recv(4096)
                if not data:
                    print("[CLIENT] Connection closed by server")
                    break
            except socket.timeout:
                # Timeout is normal, just continue
                continue
            
            # Reset reconnect counter on successful receive
            reconnect_attempts = 0
            
            state.buffer += data
            print(f"[CLIENT] Received {len(data)} bytes, buffer now {len(state.buffer)} bytes")
            
            while b'\n' in state.buffer:
                message_data, state.buffer = state.buffer.split(b'\n', 1)
                
                if message_data.strip():
                    try:
                        message = json.loads(message_data.decode('utf-8'))
                        
                        # Store data locally for frontend to retrieve
                        msg_type = message.get('type')
                        
                        # Handle ping messages from server - respond with pong to stay connected
                        if msg_type == 'ping':
                            try:
                                pong_msg = json.dumps({'type': 'pong', 'timestamp': datetime.now().strftime("%I:%M %p")}) + '\n'
                                state.socket.send(pong_msg.encode('utf-8'))
                                print("[CLIENT] Responded to server ping")
                            except Exception as e:
                                print(f"[CLIENT] Failed to send pong: {e}")
                            continue  # Don't forward ping to frontend
                        
                        # Handle pong responses (if we ever send pings)
                        if msg_type == 'pong':
                            print("[CLIENT] Received pong from server")
                            continue  # Don't forward pong to frontend
                        
                        if msg_type == 'chat_history':
                            state.last_chat_history = message.get('messages', [])
                        elif msg_type == 'user_list':
                            state.last_user_list = message.get('users', [])
                        
                        # Try to send to frontend (this might fail)
                        try:
                            eel.handleMessage(message)
                        except Exception as eel_error:
                            pass  # Silently ignore Eel errors
                    except json.JSONDecodeError as e:
                        print(f"[CLIENT] Invalid JSON: {e}")
        
        except (ConnectionResetError, BrokenPipeError) as e:
            print(f"[CLIENT] Connection lost: {e}")
            # Attempt to reconnect if network is temporarily down
            if state.running and reconnect_attempts < max_reconnect_attempts:
                reconnect_attempts += 1
                print(f"[CLIENT] Attempting reconnection ({reconnect_attempts}/{max_reconnect_attempts})...")
                print(f"[CLIENT] Waiting {reconnect_delay:.1f} seconds before retry...")
                
                for i in range(int(reconnect_delay)):
                    if not state.running:
                        break
                    time.sleep(1)
                
                if state.running:
                    try:
                        print(f"[CLIENT] Retrying connection to {state.server_host}:{state.server_port}...")
                        new_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        
                        # Enable TCP keepalive on reconnection too
                        new_socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                        if hasattr(socket, 'TCP_KEEPIDLE'):
                            new_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 120)
                            new_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 30)
                            new_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 8)
                        
                        new_socket.settimeout(5.0)
                        new_socket.connect((state.server_host, state.server_port))
                        
                        # Send username
                        username_msg = json.dumps({'username': state.username}) + '\n'
                        new_socket.send(username_msg.encode('utf-8'))
                        
                        state.socket = new_socket
                        state.buffer = b""
                        print(f"[CLIENT] ✅ Reconnected successfully!")
                        
                        # Increase delay for next attempt (exponential backoff)
                        reconnect_delay = min(reconnect_delay * 1.5, 60)  # Max 60 second delay
                        continue  # Try receiving again
                    except Exception as retry_error:
                        print(f"[CLIENT] Reconnection attempt {reconnect_attempts} failed: {retry_error}")
                        reconnect_delay = min(reconnect_delay * 1.5, 60)
                else:
                    break
            else:
                break
        except Exception as e:
            print(f"[CLIENT] Receive error: {e}")
            if state.running:
                break
    
    print(f"[CLIENT] Receive thread ending for {state.username}")
    state.running = False
    state.connected = False
    eel.onDisconnected()

@eel.expose
def connect_to_server(username: str, host: str, port: int):
    """Connect to the collaboration server"""
    try:
        # AUTO-SETUP: Verify/generate SSL certificates on first connect
        print(f"[CLIENT] Verifying SSL certificates...")
        try:
            project_dir = os.path.dirname(os.path.abspath(__file__))
            verify_and_fix_certificates(project_dir)
            print(f"[CLIENT] ✅ SSL certificates ready")
        except Exception as e:
            print(f"[CLIENT] ⚠️ Certificate setup warning: {e}")
            print(f"[CLIENT] Continuing without auto-setup...")
        
        # Clean up any existing connection
        if state.socket:
            try:
                state.socket.close()
            except:
                pass
            state.socket = None
        
        state.username = username
        state.server_host = host
        state.server_port = port
        state.running = False
        state.connected = False
        
        print(f"[CLIENT] Connecting to {host}:{port} as {username}")
        
        state.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        # Enable TCP keepalive to detect dead connections
        state.socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        
        # Platform-specific keepalive settings
        if hasattr(socket, 'TCP_KEEPIDLE'):  # Linux
            state.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 120)
            state.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 30)
            state.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 8)
        
        state.socket.settimeout(10.0)  # Increased timeout
        state.socket.connect((host, port))
        
        print(f"[CLIENT] Socket connected, sending username...")
        
        # Send username
        username_msg = json.dumps({'username': username}) + '\n'
        state.socket.send(username_msg.encode('utf-8'))
        
        print(f"[CLIENT] Username sent, setting up connection...")
        
        state.socket.settimeout(None)
        state.running = True
        state.connected = True
        
        # Small delay to ensure socket is ready
        time.sleep(0.1)
        
        # Initialize audio engine (lazy import)
        audio_module = get_audio_module()
        state.audio_engine = audio_module.AudioEngine(username, host, state.audio_port)
        
        # Set the global audio_engine reference
        import audio_module
        audio_module.audio_engine = state.audio_engine
        
        # Start receive thread
        thread = threading.Thread(target=receive_messages, daemon=True)
        thread.start()
        
        print(f"[CLIENT] Connected as {username}")
        
        # Wait for server to send initial data (chat history, user list, groups)
        # The server automatically sends these during welcome, so we don't need to request them
        print("[CLIENT] Waiting for server welcome data...")
        time.sleep(1.0)  # Give more time for welcome data
        
        # Check if we received any data
        if hasattr(state, 'last_chat_history') and state.last_chat_history:
            print(f"[CLIENT] Received {len(state.last_chat_history)} messages during welcome")
        else:
            print("[CLIENT] No welcome data received, will rely on polling")
        
        print("[CLIENT] Connection established, ready for use")
        
        return {'success': True, 'message': 'Connected successfully'}
    
    except socket.timeout:
        print(f"[CLIENT] Connection timeout to {host}:{port}")
        return {'success': False, 'message': 'Connection timeout'}
    except ConnectionRefusedError:
        print(f"[CLIENT] Connection refused to {host}:{port}")
        return {'success': False, 'message': 'Connection refused. Is the server running?'}
    except Exception as e:
        print(f"[CLIENT] Connection failed: {e}")
        return {'success': False, 'message': f'Connection error: {str(e)}'}

@eel.expose
def disconnect():
    """Disconnect from server"""
    print(f"[CLIENT] Disconnecting {state.username}")
    state.running = False
    state.connected = False
    
    if state.socket:
        try:
            state.socket.close()
        except:
            pass
        state.socket = None
    
    if state.audio_engine:
        try:
            state.audio_engine.cleanup()
        except:
            pass
        state.audio_engine = None

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
            'timestamp': datetime.now().strftime("%I:%M %p")
        }
        
        # Add extra parameters if provided
        if extra_params:
            message.update(extra_params)
        
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
        sock.settimeout(300.0)  # 5 minutes timeout to match server for large files
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
        sock.settimeout(300.0)  # 5 minutes timeout to match server for large files
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
            'timestamp': datetime.now().strftime("%I:%M %p")
        }
        state.socket.send((json.dumps(request_msg) + '\n').encode('utf-8'))
        print(f"[CLIENT] Requested private chat history with {chat_target}")
    elif chat_type == 'group' and chat_target:
        request_msg = {
            'type': 'request_group_history',
            'sender': state.username,
            'group_id': chat_target,
            'timestamp': datetime.now().strftime("%I:%M %p")
        }
        state.socket.send((json.dumps(request_msg) + '\n').encode('utf-8'))
        print(f"[CLIENT] Requested group chat history for {chat_target}")
    elif chat_type == 'global':
        request_msg = {
            'type': 'request_chat_history',
            'sender': state.username,
            'chat_type': 'global',
            'timestamp': datetime.now().strftime("%I:%M %p")
        }
        state.socket.send((json.dumps(request_msg) + '\n').encode('utf-8'))
        print(f"[CLIENT] Requested global chat history")
    
    return {'success': True}

@eel.expose
def start_video_call(chat_type, chat_id):
    """Start a video call"""
    try:
        requests = get_requests()
        
        # Determine session name
        if chat_type == 'global':
            session_name = 'Global Video Call'
        elif chat_type == 'private':
            session_name = f'Private Video Call'
        elif chat_type == 'group':
            session_name = f'Group Video Call - {chat_id}'
        else:
            session_name = 'Video Call'
        #print chat_id
        print(f"[CLIENT] Chat ID: {chat_id}")
        #print session_name
        print(f"[CLIENT] Session Name: {session_name}")
        #print chat_type
        print(f"[CLIENT] Chat Type: {chat_type}")
        # Call video server API to create session with chat_id
        response = requests.post(f'https://{SERVER_IP}:5000/api/create_session', json={
            'session_type': chat_type,
            'session_name': session_name,
            'creator': state.username,
            'chat_id': chat_id  # CRITICAL: Pass chat_id to video server
        }, verify=False)  # Disable SSL verification for self-signed certificate
        
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
                    'timestamp': datetime.now().strftime("%I:%M %p")
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
                    'timestamp': datetime.now().strftime("%I:%M %p")
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
                    'timestamp': datetime.now().strftime("%I:%M %p")
                }
                print(f"[CLIENT] Sending group video invite to group: {chat_id}")
            else:
                return {'success': False, 'error': 'Invalid chat type'}
            
            # Send the video invite message to server
            if state.connected and state.socket:
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
def start_audio_call(chat_type, chat_id):
    """Start an audio call"""
    try:
        requests = get_requests()
        
        # Determine session name
        if chat_type == 'global':
            session_name = 'Global Audio Call'
        elif chat_type == 'private':
            session_name = f'Private Audio Call'
        elif chat_type == 'group':
            session_name = f'Group Audio Call - {chat_id}'
        else:
            session_name = 'Audio Call'
        
        print(f"[CLIENT] Audio Chat ID: {chat_id}")
        print(f"[CLIENT] Audio Session Name: {session_name}")
        print(f"[CLIENT] Audio Chat Type: {chat_type}")
        
        # Call audio server API to create session with chat_id
        response = requests.post(f'https://{SERVER_IP}:5000/api/create_audio_session', json={
            'session_type': chat_type,
            'session_name': session_name,
            'creator': state.username,
            'chat_id': chat_id  # CRITICAL: Pass chat_id to audio server
        }, verify=False)  # Disable SSL verification for self-signed certificate
        
        if response.status_code != 200:
            return {'success': False, 'error': 'Failed to create audio session'}
        
        result = response.json()
        
        if result.get('success'):
            session_id = result['session_id']
            link = result['link']
            
            print(f"[CLIENT] Audio session created: {session_id}")
            print(f"[CLIENT] Audio link: {link}")
            print(f"[CLIENT] Chat type: {chat_type}, Chat ID: {chat_id}")
            
            # Send audio invite to appropriate recipients
            if chat_type == 'global':
                message_type = 'audio_invite'
                message_data = {
                    'type': message_type,
                    'sender': state.username,
                    'session_id': session_id,
                    'link': link,
                    'timestamp': datetime.now().strftime("%I:%M %p")
                }
                print(f"[CLIENT] Sending global audio invite")
            elif chat_type == 'private':
                message_type = 'audio_invite_private'
                message_data = {
                    'type': message_type,
                    'sender': state.username,
                    'receiver': chat_id,
                    'session_id': session_id,
                    'link': link,
                    'timestamp': datetime.now().strftime("%I:%M %p")
                }
                print(f"[CLIENT] Sending private audio invite to: {chat_id}")
            elif chat_type == 'group':
                message_type = 'audio_invite_group'
                message_data = {
                    'type': message_type,
                    'sender': state.username,
                    'group_id': chat_id,
                    'session_id': session_id,
                    'link': link,
                    'timestamp': datetime.now().strftime("%I:%M %p")
                }
                print(f"[CLIENT] Sending group audio invite to group: {chat_id}")
            else:
                return {'success': False, 'error': 'Invalid chat type'}
            
            # Send the audio invite message to server
            if state.connected and state.socket:
                state.socket.send((json.dumps(message_data) + '\n').encode('utf-8'))
                print(f"[CLIENT] Audio invite message sent successfully")
            else:
                print(f"[CLIENT] ERROR: Not connected or no socket available")
            
            return result
        else:
            return result
    except Exception as e:
        print(f"[CLIENT] Audio call error: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def get_chat_history():
    """Get current chat history"""
    print("[CLIENT] get_chat_history called")
    # Return the last few messages we received
    return {'success': True, 'messages': getattr(state, 'last_chat_history', [])}

@eel.expose
def get_user_list():
    """Get current user list"""
    print("[CLIENT] get_user_list called")
    # Return the last user list we received
    return {'success': True, 'users': getattr(state, 'last_user_list', [])}

@eel.expose
def test_connection():
    """Test if Eel bridge is working"""
    print("[CLIENT] Eel bridge test called")
    return {'success': True, 'message': 'Eel bridge is working', 'username': state.username}

# ===== AUTHENTICATION FUNCTIONS =====
@eel.expose
def get_device_mac():
    """Get the MAC address of the current device"""
    auth_module = get_auth_module()
    mac = auth_module.get_mac_address()
    print(f"[AUTH] MAC Address: {mac}")
    return {'success': True, 'mac_address': mac}

@eel.expose
def check_device_registration():
    """Check if the current device is registered"""
    auth_module = get_auth_module()
    mac = auth_module.get_mac_address()
    is_registered, username = auth_module.check_mac_registered(mac)
    print(f"[AUTH] Device registered: {is_registered}, Username: {username}")
    return {
        'success': True,
        'is_registered': is_registered,
        'username': username,
        'mac_address': mac
    }

@eel.expose
def signup_user(username: str, password: str):
    """Register a new user with the current device's MAC address"""
    auth_module = get_auth_module()
    mac = auth_module.get_mac_address()
    success, message = auth_module.register_user(mac, username, password)
    print(f"[AUTH] Signup attempt: {success}, {message}")
    return {
        'success': success,
        'message': message,
        'username': username if success else None
    }

@eel.expose
def login_user(password: str):
    """Login with password for the current device"""
    auth_module = get_auth_module()
    mac = auth_module.get_mac_address()
    success, message, username = auth_module.verify_login(mac, password)
    print(f"[AUTH] Login attempt: {success}, {message}")
    return {
        'success': success,
        'message': message,
        'username': username
    }

@eel.expose
def reset_password(new_password: str):
    """Reset password for the current device"""
    try:
        auth_module = get_auth_module()
        mac = auth_module.get_mac_address()
        success = auth_module.update_password(mac, new_password)
        print(f"[AUTH] Password reset: {success}")
        return {
            'success': success,
            'message': 'Password reset successfully' if success else 'Failed to reset password'
        }
    except Exception as e:
        print(f"[AUTH] Password reset error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def close_application():
    """Close the application forcefully"""
    try:
        print("[APP] 🚫 UNAUTHORIZED ACCESS - CLOSING APPLICATION...")
        
        # Try multiple methods to ensure closure
        import sys
        import os
        import threading
        
        def force_exit():
            try:
                # Force exit after short delay
                import time
                time.sleep(0.5)
                os._exit(1)  # Force exit
            except:
                pass
        
        # Start force exit in background
        threading.Thread(target=force_exit, daemon=True).start()
        
        # Try graceful exit first
        sys.exit(0)
        
    except Exception as e:
        print(f"[APP] Error during closure: {e}")
        try:
            import os
            os._exit(1)  # Force exit as last resort
        except:
            pass

@eel.expose
def refresh_user_list():
    """Refresh user list by requesting from server"""
    if state.connected and state.socket:
        try:
            # Request user list from server
            request = {
                'type': 'get_users',
                'sender': state.username,
                'timestamp': datetime.now().strftime("%I:%M %p")
            }
            state.socket.send((json.dumps(request) + '\n').encode('utf-8'))
            print("[CLIENT] Refreshing user list")
            return {'success': True}
        except Exception as e:
            print(f"Refresh error: {e}")
            return {'success': False, 'message': str(e)}
    return {'success': False, 'message': 'Not connected'}

@eel.expose
def delete_message(message_id: str, chat_type: str, chat_target: str = None):
    """Delete a message for everyone"""
    if not state.connected or not state.socket:
        return {'success': False, 'message': 'Not connected'}
    
    try:
        # Send delete request to server
        request = {
            'type': 'delete_message',
            'message_id': message_id,
            'chat_type': chat_type,
            'chat_target': chat_target,
            'sender': state.username,
            'timestamp': datetime.now().strftime("%I:%M %p")
        }
        state.socket.send((json.dumps(request) + '\n').encode('utf-8'))
        print(f"[CLIENT] Delete message request sent: {message_id}")
        return {'success': True}
    except Exception as e:
        print(f"Delete message error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def delete_private_chat(chat_key: str):
    """Delete entire private chat history from server"""
    try:
        from storage import storage
        result = storage.delete_private_chat(chat_key)
        if result:
            print(f"[CLIENT] Deleted private chat: {chat_key}")
            return {'success': True}
        else:
            print(f"[CLIENT] Failed to delete private chat: {chat_key}")
            return {'success': False, 'message': 'Chat not found'}
    except Exception as e:
        print(f"[CLIENT] Error deleting private chat: {e}")
        return {'success': False, 'message': str(e)}

# Fast startup - minimal initialization
def find_available_port(start_port=8081, max_attempts=10):
    """Find an available port starting from start_port"""
    import socket
    for port in range(start_port, start_port + max_attempts):
        try:
            # Try to bind to the port
            test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_socket.bind((SERVER_IP, port))
            test_socket.close()
            return port
        except OSError:
            # Port is in use, try next one
            continue
    return start_port  # Fallback to original port

def start_application():
    """Start the application with minimal initial loading"""
    import sys
    import time
    
    # Check if port is provided as argument, otherwise find available port
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            port = find_available_port(8081)
    else:
        port = find_available_port(8081)
    
    print(f"[CLIENT] Starting ShadowNexus Client on port {port}...")
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Start Eel immediately without heavy imports
            eel.start('index.html', size=(1600, 1000), port=port, block=True)
            break  # Success, exit loop
        except OSError as e:
            if "address already in use" in str(e).lower() or "10048" in str(e):
                print(f"[CLIENT] Port {port} is already in use.")
                if attempt < max_retries - 1:
                    # Try next port
                    port = find_available_port(port + 1)
                    print(f"[CLIENT] Retrying with port: {port}")
                    time.sleep(0.5)  # Brief delay before retry
                else:
                    print(f"[CLIENT] ERROR: Could not find available port after {max_retries} attempts")
                    print(f"[CLIENT] Please close other instances of the application")
                    # Don't use input() in exe - just exit after delay
                    time.sleep(5)
                    sys.exit(1)
            else:
                print(f"[CLIENT] Error starting application: {e}")
                time.sleep(5)
                sys.exit(1)
        except Exception as e:
            print(f"[CLIENT] Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(5)
            sys.exit(1)

if __name__ == '__main__':
    start_application()