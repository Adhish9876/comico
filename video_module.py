#!/usr/bin/env python3
"""
video_server.py - Flask WebRTC Signaling Server with Session Tracking
Handles WebRTC signaling and notifies when sessions become empty
"""

# Suppress all warnings for cleaner output
import warnings
warnings.filterwarnings('ignore', message='.*SSL.*')


from flask import Flask, render_template, request, jsonify
import json
from flask_socketio import SocketIO, emit, join_room, leave_room
import socket as py_socket
import uuid
from datetime import datetime
from typing import Dict, List
import os
import ssl
from dotenv import load_dotenv
import sys

# Load environment variables - check multiple possible locations for .env
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    application_path = os.path.dirname(sys.executable)
    env_path = os.path.join(application_path, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"[VIDEO] Loaded .env from: {env_path}")
    else:
        # Try in _internal folder (PyInstaller extracts here)
        env_path = os.path.join(application_path, '_internal', '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"[VIDEO] Loaded .env from: {env_path}")
        else:
            print(f"[VIDEO] ⚠️ WARNING: .env file not found! Using hardcoded server IP.")
else:
    # Running as Python script
    load_dotenv()
    print(f"[VIDEO] Loaded .env from script directory")

# Get SERVER_IP from .env or use hardcoded default (NOT localhost!)
SERVER_IP = os.getenv('SERVER_IP', '10.200.14.204')  # Hardcoded fallback to your server IP
print(f"[VIDEO] Using SERVER_IP: {SERVER_IP}")

app = Flask(__name__)
app.config['SECRET_KEY'] = 'shadow_nexus_video_secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# Active video sessions
video_sessions: Dict[str, Dict] = {}
# Active audio sessions
audio_sessions: Dict[str, Dict] = {}

# Track users in each session/room
_users_in_room = {}  # room_id -> [sid, sid, ...]
_room_of_sid = {}    # sid -> room_id
_name_of_sid = {}    # sid -> display_name

@app.route('/')
def index():
    return "Shadow Nexus Media Server Running - Video & Audio Calls"

@app.route('/video/<session_id>')
def video_room(session_id):
    """Video conference room page"""
    if session_id not in video_sessions:
        return "Invalid session", 404
    
    session = video_sessions[session_id]
    return render_template('video_room.html', 
                         session_id=session_id,
                         session_type=session.get('type', 'global'),
                         session_name=session.get('name', 'Video Call'),
                         server_ip=SERVER_IP)

@app.route('/audio/<session_id>')
def audio_room(session_id):
    """Audio call room page"""
    if session_id not in audio_sessions:
        return "Invalid session", 404
    
    session = audio_sessions[session_id]
    return render_template('audio_room.html', 
                         session_id=session_id,
                         session_type=session.get('type', 'global'),
                         session_name=session.get('name', 'Audio Call'),
                         server_ip=SERVER_IP)

@app.route('/api/create_session', methods=['POST'])
def api_create_session():
    """API endpoint to create video session"""
    data = request.get_json()
    session_type = data.get('session_type', 'global')
    session_name = data.get('session_name', 'Video Call')
    creator = data.get('creator', 'Unknown')
    chat_id = data.get('chat_id', 'global')
    
    session_id = create_video_session(session_type, session_name, creator, chat_id)
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'link': f'https://{SERVER_IP}:5000/video/{session_id}'
    })

@app.route('/api/session_status/<session_id>', methods=['GET'])
def api_session_status(session_id):
    """API endpoint to check if a session has active participants"""
    has_participants = session_id in _users_in_room and len(_users_in_room[session_id]) > 0
    is_valid = session_id in video_sessions or session_id in audio_sessions
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'is_valid': is_valid,
        'has_participants': has_participants,
        'participant_count': len(_users_in_room.get(session_id, []))
    })

@app.route('/api/create_audio_session', methods=['POST'])
def api_create_audio_session():
    """API endpoint to create audio session"""
    data = request.get_json()
    session_type = data.get('session_type', 'global')
    session_name = data.get('session_name', 'Audio Call')
    creator = data.get('creator', 'Unknown')
    chat_id = data.get('chat_id', 'global')
    
    session_id = create_audio_session(session_type, session_name, creator, chat_id)
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'link': f'https://{SERVER_IP}:5000/audio/{session_id}'
    })

@socketio.on('connect')
def handle_connect():
    sid = request.sid
    print(f"[MEDIA SERVER] Client connected: {sid}")
    emit('connected', {'sid': sid})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    print(f"[MEDIA SERVER] Client disconnected: {sid}")
    
    # Remove from room
    if sid in _room_of_sid:
        room_id = _room_of_sid[sid]
        display_name = _name_of_sid.get(sid, 'Unknown')
        
        if room_id in _users_in_room and sid in _users_in_room[room_id]:
            _users_in_room[room_id].remove(sid)
            
            # Notify others in room
            emit('user-disconnect', {'sid': sid}, room=room_id, skip_sid=sid)
            
            # CHECK IF ROOM IS NOW EMPTY
            if len(_users_in_room[room_id]) == 0:
                print(f"[MEDIA SERVER] Room {room_id} is now empty - notifying chat server")
                _users_in_room.pop(room_id)
                # Notify chat server that session is empty
                notify_chat_server_session_empty(room_id)
        
        _room_of_sid.pop(sid)
        _name_of_sid.pop(sid)
        
        print(f"[MEDIA SERVER] User <{sid}> left room <{room_id}>")

@socketio.on('join_session')
def handle_join_session(data):
    """Handle user joining video or audio session (room) - mesh topology"""
    sid = request.sid
    room_id = data.get('session_id')
    username = data.get('username', 'Guest')
    
    # Check if session exists in either video or audio sessions
    if room_id not in video_sessions and room_id not in audio_sessions:
        emit('error', {'message': 'Invalid session'})
        return
    
    # Join the room
    join_room(room_id)
    _room_of_sid[sid] = room_id
    _name_of_sid[sid] = username
    
    # Determine session type for logging
    session_type = "VIDEO" if room_id in video_sessions else "AUDIO"
    print(f"[{session_type} SERVER] {username} <{sid}> joined session {room_id}")
    
    # Initialize room user list if needed
    if room_id not in _users_in_room:
        _users_in_room[room_id] = [sid]
        # First user in room
        emit('user-list', {'my_id': sid}, room=sid)
        print(f"[{session_type} SERVER] First user in room {room_id}")
    else:
        # Existing users in room - send them to new user
        existing_users = {u_id: _name_of_sid[u_id] for u_id in _users_in_room[room_id]}
        emit('user-list', {'list': existing_users, 'my_id': sid}, room=sid)
        
        # Notify existing users about new user
        emit('user-connect', {'sid': sid, 'name': username}, room=room_id, skip_sid=sid)
        
        # Add new user to room
        _users_in_room[room_id].append(sid)
        print(f"[{session_type} SERVER] New user joined. Room {room_id} now has {len(_users_in_room[room_id])} users")

@socketio.on('leave_session')
def handle_leave_session(data):
    """Handle user leaving video session"""
    sid = request.sid
    room_id = data.get('session_id')
    
    if room_id in _users_in_room and sid in _users_in_room[room_id]:
        _users_in_room[room_id].remove(sid)
        leave_room(room_id)
        emit('user-disconnect', {'sid': sid}, room=room_id)
        
        # Check if room is now empty
        if len(_users_in_room[room_id]) == 0:
            print(f"[MEDIA SERVER] Room {room_id} is now empty after leave")
            _users_in_room.pop(room_id)
            notify_chat_server_session_empty(room_id)
        
        print(f"[MEDIA SERVER] User {sid} left room {room_id}")

@socketio.on('data')
def handle_data(msg):
    """Forward WebRTC signaling data (offer/answer/ICE) between peers"""
    sender_sid = msg.get('sender_id')
    target_sid = msg.get('target_id')
    msg_type = msg.get('type')
    
    if sender_sid != request.sid:
        print(f"[MEDIA SERVER] WARNING: sender_id mismatch!")
        return
    
    if msg_type != 'new-ice-candidate':
        print(f"[MEDIA SERVER] {msg_type} from {sender_sid} to {target_sid}")
    
    # Forward to target
    socketio.emit('data', msg, room=target_sid)
    
    
@socketio.on('hand_raise')
def handle_hand_raise(data):
    session_id = data['session_id']
    user_id = data['user_id']
    raised = data['raised']
    
    print(f"[MEDIA SERVER] Hand {'raised' if raised else 'lowered'} by {user_id}")
    
    emit('hand_raise', {
        'user_id': user_id,
        'raised': raised
    }, room=session_id, skip_sid=request.sid)
    
@socketio.on('screen_share')
def handle_screen_share(data):
    session_id = data['session_id']
    user_id = data['user_id']
    sharing = data['sharing']
    
    print(f"[MEDIA SERVER] Screen {'share' if sharing else 'stop'} by {user_id}")
    
    emit('screen_share', {
        'user_id': user_id,
        'sharing': sharing
    }, room=session_id, skip_sid=request.sid)

@socketio.on('reaction')
def handle_reaction(data):
    session_id = data['session_id']
    user_id = data['user_id']
    emoji = data['emoji']
    
    print(f"[MEDIA SERVER] Reaction {emoji} from {user_id}")
    
    emit('reaction', {
        'user_id': user_id,
        'emoji': emoji
    }, room=session_id, skip_sid=request.sid)

@socketio.on('audio_level')
def handle_audio_level(data):
    session_id = data['session_id']
    user_id = data['user_id']
    level = data['level']
    is_speaking = data['is_speaking']
    
    # Broadcast audio level to other participants for speaking indicator
    emit('audio_level', {
        'user_id': user_id,
        'level': level,
        'is_speaking': is_speaking
    }, room=session_id, skip_sid=request.sid)

def create_video_session(session_type: str, session_name: str, creator: str, chat_id: str) -> str:
    """Create a new video session"""
    session_id = str(uuid.uuid4())[:8]
    video_sessions[session_id] = {
        'id': session_id,
        'type': session_type,
        'name': session_name,
        'creator': creator,
        'chat_id': chat_id,
        'created_at': datetime.now().isoformat()
    }
    print(f"[MEDIA SERVER] Created session {session_id} ({session_type}) for chat {chat_id}")
    return session_id

def create_audio_session(session_type: str, session_name: str, creator: str, chat_id: str) -> str:
    """Create a new audio session"""
    session_id = str(uuid.uuid4())[:8]
    audio_sessions[session_id] = {
        'id': session_id,
        'type': session_type,
        'name': session_name,
        'creator': creator,
        'chat_id': chat_id,
        'created_at': datetime.now().isoformat()
    }
    print(f"[AUDIO SERVER] Created session {session_id} ({session_type}) for chat {chat_id}")
    return session_id

def notify_chat_server_session_empty(session_id: str):
    
    try:
        # Check if it's a video session first
        session = video_sessions.get(session_id)
        session_type_prefix = 'video'
        server_name = 'VideoServer'
        
        # If not found in video sessions, check audio sessions
        if not session:
            session = audio_sessions.get(session_id)
            session_type_prefix = 'audio'
            server_name = 'AudioServer'
        
        if not session:
            print(f"[SERVER] Session {session_id} not found in video or audio sessions")
            return

        payload = {
            'type': f'{session_type_prefix}_missed',
            'sender': server_name,
            'session_id': session_id,
            'session_type': session.get('type', 'global'),
            'chat_id': session.get('chat_id', 'global'),
            'timestamp': datetime.now().strftime('%I:%M %p')
        }

        print(f"[{server_name.upper()}] Notifying chat server about empty session: {payload}")

        # Connect to chat server TCP socket
        chat_host = SERVER_IP
        chat_port = 5555
        s = py_socket.socket(py_socket.AF_INET, py_socket.SOCK_STREAM)
        s.settimeout(5.0)
        s.connect((chat_host, chat_port))
        
        # Send FAKE username first (server requires it) but mark as system
        s.send((json.dumps({'username': f'_{server_name}_System_'}) + '\n').encode('utf-8'))
        
        # Wait a tiny bit for server to process username
        import time as pytime
        pytime.sleep(0.1)
        
        # Send the missed call notification
        s.send((json.dumps(payload) + '\n').encode('utf-8'))
        
        # Wait for confirmation
        pytime.sleep(0.2)
        
        s.close()
    except Exception as e:
        print(f"[MEDIA SERVER] Error notifying chat server: {str(e)}")

def regenerate_certificates_if_needed():
    """Regenerate certificates if SERVER_IP has changed"""
    cert_file = 'cert.pem'
    key_file = 'key.pem'
    
    # Check if we need to regenerate (SERVER_IP mismatch)
    needs_regeneration = False
    
    if os.path.exists(cert_file):
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            with open(cert_file, 'rb') as f:
                cert_data = f.read()
                cert = x509.load_pem_x509_certificate(cert_data, default_backend())
                san_ext = cert.extensions.get_extension_for_oid(x509.oid.ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
                san_names = []
                for name in san_ext.value:
                    if isinstance(name, x509.IPAddress):
                        san_names.append(str(name.value))
                
                # Check if SERVER_IP is in SAN
                if SERVER_IP not in san_names:
                    print(f"[MEDIA SERVER] ⚠️  Certificate SAN doesn't include {SERVER_IP}")
                    print(f"[MEDIA SERVER] Current SAN IPs: {san_names}")
                    needs_regeneration = True
        except Exception as e:
            print(f"[MEDIA SERVER] Could not read certificate SAN: {e}")
            needs_regeneration = True
    else:
        needs_regeneration = True
    
    if needs_regeneration:
        print("[MEDIA SERVER] Regenerating SSL certificates with current SERVER_IP...")
        generate_self_signed_cert(cert_file, key_file)
    
    return cert_file, key_file

def generate_self_signed_cert(cert_file, key_file):
    """Generate self-signed certificate with proper SAN"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        from datetime import datetime, timedelta
        import ipaddress
        
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        # Generate certificate with all necessary SANs
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, u"ShadowNexus"),
        ])
        
        # Build SAN list - include localhost, 127.0.0.1, SERVER_IP, and common private IPs
        san_list = [
            x509.DNSName(u"localhost"),
            x509.DNSName(u"*.local"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            x509.IPAddress(ipaddress.IPv4Address("0.0.0.0")),
        ]
        
        # Add SERVER_IP if it's a valid IP
        try:
            san_list.append(x509.IPAddress(ipaddress.IPv4Address(SERVER_IP)))
            print(f"[MEDIA SERVER] Added {SERVER_IP} to certificate SAN")
        except:
            pass
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=3650)  # 10 years
        ).add_extension(
            x509.SubjectAlternativeName(san_list),
            critical=False,
        ).add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        # Write certificate
        with open(cert_file, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        # Write private key
        with open(key_file, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print("[MEDIA SERVER] ✅ Self-signed certificate generated (valid 10 years)")
        print(f"[MEDIA SERVER] Certificate includes: localhost, 127.0.0.1, {SERVER_IP}")
        print("[MEDIA SERVER] ⚠️  Browser will show security warnings (use mkcert for trusted certs)\n")
        
    except ImportError:
        print("[MEDIA SERVER] ERROR: cryptography library not found")
        print("[MEDIA SERVER] Installing cryptography...")
        os.system("pip install cryptography")
        print("[MEDIA SERVER] Please run the server again after installation\n")
        exit(1)
    except Exception as e:
        print(f"[MEDIA SERVER] ERROR generating certificate: {e}")
        exit(1)

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎥🎙️ Shadow Nexus Media Server (WebRTC)")
    print("="*60)
    print(f"Server IP: {SERVER_IP}")
    print("Media server starting on https://0.0.0.0:5000")
    print("Supports both Video and Audio calls\n")
    
    # SSL Certificate setup - with regeneration check
    cert_file, key_file = regenerate_certificates_if_needed()
    
    # Run with HTTPS using Flask-SocketIO built-in server
    print("[MEDIA SERVER] Server running on https://0.0.0.0:5000")
    print(f"[MEDIA SERVER] Access at: https://{SERVER_IP}:5000\n")
    
    # Run with SSL certificates (certfile and keyfile parameters)
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, certfile=cert_file, keyfile=key_file)