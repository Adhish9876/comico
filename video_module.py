#!/usr/bin/env python3
"""
video_server.py - Flask WebRTC Signaling Server for Shadow Nexus
Handles WebRTC signaling for video conferencing
"""

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import uuid
from datetime import datetime
from typing import Dict, List

app = Flask(__name__)
app.config['SECRET_KEY'] = 'shadow_nexus_video_secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# Active video sessions
video_sessions: Dict[str, Dict] = {}
# Participants in each session
session_participants: Dict[str, List[str]] = {}

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
    
    session_id = create_video_session(session_type, session_name, creator)
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'link': f'http://localhost:5000/video/{session_id}'
    })

@socketio.on('connect')
def handle_connect():
    print(f"[VIDEO SERVER] Client connected: {request.sid}")
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[VIDEO SERVER] Client disconnected: {request.sid}")
    # Remove from all sessions
    for session_id, participants in session_participants.items():
        if request.sid in participants:
            participants.remove(request.sid)
            emit('participant_left', {'sid': request.sid}, room=session_id, skip_sid=request.sid)

@socketio.on('join_session')
def handle_join_session(data):
    """Handle user joining video session"""
    session_id = data.get('session_id')
    username = data.get('username')
    
    if session_id not in video_sessions:
        emit('error', {'message': 'Invalid session'})
        return
    
    join_room(session_id)
    
    if session_id not in session_participants:
        session_participants[session_id] = []
    
    session_participants[session_id].append(request.sid)
    
    # Notify others in the room
    emit('participant_joined', {
        'sid': request.sid,
        'username': username
    }, room=session_id, skip_sid=request.sid)
    
    # Send existing participants to new user
    emit('existing_participants', {
        'participants': [p for p in session_participants[session_id] if p != request.sid]
    })
    
    print(f"[VIDEO SERVER] {username} joined session {session_id}")

@socketio.on('leave_session')
def handle_leave_session(data):
    """Handle user leaving video session"""
    session_id = data.get('session_id')
    
    if session_id in session_participants:
        if request.sid in session_participants[session_id]:
            session_participants[session_id].remove(request.sid)
        
        leave_room(session_id)
        emit('participant_left', {'sid': request.sid}, room=session_id)
    
    print(f"[VIDEO SERVER] Client left session {session_id}")

@socketio.on('offer')
def handle_offer(data):
    """Forward WebRTC offer"""
    target_sid = data.get('target')
    offer = data.get('offer')
    
    emit('offer', {
        'offer': offer,
        'sender': request.sid
    }, room=target_sid)
    
    print(f"[VIDEO SERVER] Forwarded offer from {request.sid} to {target_sid}")

@socketio.on('answer')
def handle_answer(data):
    """Forward WebRTC answer"""
    target_sid = data.get('target')
    answer = data.get('answer')
    
    emit('answer', {
        'answer': answer,
        'sender': request.sid
    }, room=target_sid)
    
    print(f"[VIDEO SERVER] Forwarded answer from {request.sid} to {target_sid}")

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    """Forward ICE candidate"""
    target_sid = data.get('target')
    candidate = data.get('candidate')
    
    emit('ice_candidate', {
        'candidate': candidate,
        'sender': request.sid
    }, room=target_sid)

def create_video_session(session_type: str, session_name: str, creator: str) -> str:
    """Create a new video session"""
    session_id = str(uuid.uuid4())[:8]
    video_sessions[session_id] = {
        'id': session_id,
        'type': session_type,
        'name': session_name,
        'creator': creator,
        'created_at': datetime.now().isoformat()
    }
    session_participants[session_id] = []
    print(f"[VIDEO SERVER] Created session {session_id} ({session_type})")
    return session_id

def start_video_call(chat_type: str, chat_id: str) -> dict:
    """
    Start a video call for the specified chat context
    Returns a dict with session info
    """
    try:
        session_id = str(uuid.uuid4())[:8]
        
        # Determine session name based on type
        if chat_type == 'global':
            session_name = 'Global Video Call'
        elif chat_type == 'private':
            session_name = f'Private Video Call'
        elif chat_type == 'group':
            session_name = f'Group Video Call - {chat_id}'
        else:
            session_name = 'Video Call'
        
        # Create session in our local sessions dict
        video_sessions[session_id] = {
            'id': session_id,
            'type': chat_type,
            'name': session_name,
            'chat_id': chat_id,
            'created_at': datetime.now().isoformat()
        }
        session_participants[session_id] = []
        
        # Generate the video conference link
        join_link = f"http://localhost:5000/video/{session_id}"
        
        print(f"[VIDEO] Started {chat_type} call (ID: {chat_id}, Session: {session_id})")
        
        return {
            'success': True,
            'session_id': session_id,
            'link': join_link,
            'chat_type': chat_type,
            'chat_id': chat_id
        }
    except Exception as e:
        print(f"[VIDEO] Error starting call: {e}")
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎥 Shadow Nexus Video Server (WebRTC)")
    print("="*60)
    print("Video server starting on http://localhost:5000\n")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)