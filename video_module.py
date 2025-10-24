#!/usr/bin/env python3
"""
video_server.py - Flask WebRTC Signaling Server with Session Tracking
Handles WebRTC signaling and notifies when sessions become empty
"""

from flask import Flask, render_template, request, jsonify
import json
from flask_socketio import SocketIO, emit, join_room, leave_room
import socket as py_socket
import uuid
from datetime import datetime
from typing import Dict, List
import os
import ssl

app = Flask(__name__)
app.config['SECRET_KEY'] = 'shadow_nexus_video_secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# Active video sessions
video_sessions: Dict[str, Dict] = {}

# Track users in each session/room
_users_in_room = {}  # room_id -> [sid, sid, ...]
_room_of_sid = {}    # sid -> room_id
_name_of_sid = {}    # sid -> display_name

@app.route('/')
def index():
    return "Shadow Nexus Video Server Running"

@app.route('/video/<session_id>')
def video_room(session_id):
    """Video conference room page"""
    if session_id not in video_sessions:
        return "Invalid session", 404
    
    session = video_sessions[session_id]
    return render_template('video_room.html', 
                         session_id=session_id,
                         session_type=session.get('type', 'global'),
                         session_name=session.get('name', 'Video Call'))

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
        'link': f'https://10.200.14.204:5000/video/{session_id}'
    })

@socketio.on('connect')
def handle_connect():
    sid = request.sid
    print(f"[VIDEO SERVER] Client connected: {sid}")
    emit('connected', {'sid': sid})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    print(f"[VIDEO SERVER] Client disconnected: {sid}")
    
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
                print(f"[VIDEO SERVER] Room {room_id} is now empty - notifying chat server")
                _users_in_room.pop(room_id)
                # Notify chat server that session is empty
                notify_chat_server_session_empty(room_id)
        
        _room_of_sid.pop(sid)
        _name_of_sid.pop(sid)
        
        print(f"[VIDEO SERVER] User <{sid}> left room <{room_id}>")

@socketio.on('join_session')
def handle_join_session(data):
    """Handle user joining video session (room) - mesh topology"""
    sid = request.sid
    room_id = data.get('session_id')
    username = data.get('username', 'Guest')
    
    if room_id not in video_sessions:
        emit('error', {'message': 'Invalid session'})
        return
    
    # Join the room
    join_room(room_id)
    _room_of_sid[sid] = room_id
    _name_of_sid[sid] = username
    
    print(f"[VIDEO SERVER] {username} <{sid}> joined session {room_id}")
    
    # Initialize room user list if needed
    if room_id not in _users_in_room:
        _users_in_room[room_id] = [sid]
        # First user in room
        emit('user-list', {'my_id': sid}, room=sid)
        print(f"[VIDEO SERVER] First user in room {room_id}")
    else:
        # Existing users in room - send them to new user
        existing_users = {u_id: _name_of_sid[u_id] for u_id in _users_in_room[room_id]}
        emit('user-list', {'list': existing_users, 'my_id': sid}, room=sid)
        
        # Notify existing users about new user
        emit('user-connect', {'sid': sid, 'name': username}, room=room_id, skip_sid=sid)
        
        # Add new user to room
        _users_in_room[room_id].append(sid)
        print(f"[VIDEO SERVER] New user joined. Room {room_id} now has {len(_users_in_room[room_id])} users")

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
            print(f"[VIDEO SERVER] Room {room_id} is now empty after leave")
            _users_in_room.pop(room_id)
            notify_chat_server_session_empty(room_id)
        
        print(f"[VIDEO SERVER] User {sid} left room {room_id}")

@socketio.on('data')
def handle_data(msg):
    """Forward WebRTC signaling data (offer/answer/ICE) between peers"""
    sender_sid = msg.get('sender_id')
    target_sid = msg.get('target_id')
    msg_type = msg.get('type')
    
    if sender_sid != request.sid:
        print(f"[VIDEO SERVER] WARNING: sender_id mismatch!")
        return
    
    if msg_type != 'new-ice-candidate':
        print(f"[VIDEO SERVER] {msg_type} from {sender_sid} to {target_sid}")
    
    # Forward to target
    socketio.emit('data', msg, room=target_sid)
    
    
@socketio.on('hand_raise')
def handle_hand_raise(data):
    session_id = data['session_id']
    user_id = data['user_id']
    raised = data['raised']
    
    print(f"[VIDEO SERVER] Hand {'raised' if raised else 'lowered'} by {user_id}")
    
    emit('hand_raise', {
        'user_id': user_id,
        'raised': raised
    }, room=session_id, skip_sid=request.sid)
    
@socketio.on('screen_share')
def handle_screen_share(data):
    session_id = data['session_id']
    user_id = data['user_id']
    sharing = data['sharing']
    
    print(f"[VIDEO SERVER] Screen {'share' if sharing else 'stop'} by {user_id}")
    
    emit('screen_share', {
        'user_id': user_id,
        'sharing': sharing
    }, room=session_id, skip_sid=request.sid)

@socketio.on('reaction')
def handle_reaction(data):
    session_id = data['session_id']
    user_id = data['user_id']
    emoji = data['emoji']
    
    print(f"[VIDEO SERVER] Reaction {emoji} from {user_id}")
    
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
    print(f"[VIDEO SERVER] Created session {session_id} ({session_type}) for chat {chat_id}")
    return session_id

def notify_chat_server_session_empty(session_id: str):
    
    try:
        session = video_sessions.get(session_id)
        if not session:
            print(f"[VIDEO SERVER] Session {session_id} not found in video_sessions")
            return

        payload = {
            'type': 'video_missed',
            'sender': 'VideoServer',
            'session_id': session_id,
            'session_type': session.get('type', 'global'),
            'chat_id': session.get('chat_id', 'global'),
            'timestamp': datetime.now().strftime('%H:%M:%S')
        }

        print(f"[VIDEO SERVER] Notifying chat server about empty session: {payload}")

        # Connect to chat server TCP socket
        chat_host = '10.200.14.204'
        chat_port = 5555
        s = py_socket.socket(py_socket.AF_INET, py_socket.SOCK_STREAM)
        s.settimeout(5.0)
        s.connect((chat_host, chat_port))
        
        # Send FAKE username first (server requires it) but mark as system
        s.send((json.dumps({'username': '_VideoServer_System_'}) + '\n').encode('utf-8'))
        
        # Wait a tiny bit for server to process username
        import time as pytime
        pytime.sleep(0.1)
        
        # Send the missed call notification
        s.send((json.dumps(payload) + '\n').encode('utf-8'))
        
        # Wait for confirmation
        pytime.sleep(0.2)
        
        s.close()
    except Exception as e:
        print(f"[VIDEO SERVER] Error notifying chat server: {str(e)}")

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎥 Shadow Nexus Video Server (WebRTC)")
    print("="*60)
    print("Video server starting on https://0.0.0.0:5000\n")
    
    # Create self-signed certificate if it doesn't exist
    cert_file = 'cert.pem'
    key_file = 'key.pem'
    
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print("[VIDEO SERVER] Generating self-signed certificate...")
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
            
            # Generate certificate
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COMMON_NAME, u"10.200.14.204"),
            ])
            
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
                datetime.utcnow() + timedelta(days=365)
            ).add_extension(
                x509.SubjectAlternativeName([
                    x509.IPAddress(ipaddress.IPv4Address("10.200.14.204")),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                ]),
                critical=False,
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
            
            print("[VIDEO SERVER] Certificate generated successfully\n")
        except ImportError:
            print("[VIDEO SERVER] Installing cryptography library...")
            os.system("pip install cryptography")
            print("[VIDEO SERVER] Please run the server again after installation\n")
            exit(1)
    
    # Run with HTTPS using SSL context
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(cert_file, key_file)
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True, 
                 ssl_context=ssl_context)