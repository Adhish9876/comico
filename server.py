#!/usr/bin/env python3
"""
server.py - Shadow Nexus Server with Persistent Storage
All messages are saved and restored on restart
"""

import socket
import threading
import json
import time
import signal
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

# Import storage
from storage import storage

class CollaborationServer:
    """Main server class for handling chat, files, and groups"""
    
    def __init__(self, host='0.0.0.0', port=5555, file_port=5556):
        self.host = host
        self.port = port
        self.file_port = file_port
        
        self.server_socket = self._create_socket()
        self.file_server_socket = self._create_socket()
        
        self.clients: Dict[socket.socket, Dict[str, Any]] = {}
        self.groups: Dict[str, Dict[str, Any]] = {}
        # Load chat history from storage instead of starting empty
        self.chat_history: List[Dict] = storage.get_global_chat(1000)
        self.private_messages: Dict[Tuple[str, str], List[Dict]] = {}
        self.group_messages: Dict[str, List[Dict]] = {}
        self.file_metadata: Dict[str, Dict[str, Any]] = storage.get_files()
        self.recent_chats: Dict[str, List[str]] = {}
        
        self.lock = threading.Lock()
        self.running = True
        
        print(f"Server initializing on {host}:{port} (chat) and {host}:{file_port} (files)")
        print(f"Loaded {len(self.chat_history)} historical global messages")
        print(f"Loaded {len(self.file_metadata)} historical files")

    def _create_socket(self) -> socket.socket:
    
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    # Add TCP keepalive to detect dead connections
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        
        # Platform-specific keepalive settings
        if hasattr(socket, 'TCP_KEEPIDLE'):  # Linux
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 60)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 10)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 5)
        
        return sock

    def start(self):
        """Start the server and listen for connections"""
        try:
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(10)
            print(f"✓ Chat server started on {self.host}:{self.port}")
            
            self.file_server_socket.bind((self.host, self.file_port))
            self.file_server_socket.listen(10)
            print(f"✓ File server started on {self.host}:{self.file_port}")
            
            file_thread = threading.Thread(target=self.accept_file_connections, daemon=True)
            file_thread.start()
            
            self.accept_connections()
            
        except OSError as e:
            print(f"❌ Error starting server (port may be in use): {e}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
        finally:
            self.cleanup()

    def accept_connections(self):
        """Accept incoming client connections for chat"""
        print("✓ Waiting for connections... (Press Ctrl+C to stop)\n")
        while self.running:
            try:
                self.server_socket.settimeout(1.0)
                try:
                    client_socket, address = self.server_socket.accept()
                    print(f"📥 New connection from {address}")
                    
                    thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, address),
                        daemon=True
                    )
                    thread.start()
                except socket.timeout:
                    continue
            except Exception as e:
                if self.running:
                    print(f"❌ Error accepting connection: {e}")

    def accept_file_connections(self):
        """Accept incoming file transfer connections"""
        while self.running:
            try:
                self.file_server_socket.settimeout(1.0)
                try:
                    client_socket, address = self.file_server_socket.accept()
                    print(f"📁 File transfer connection from {address}")
                    
                    thread = threading.Thread(
                        target=self.handle_file_transfer,
                        args=(client_socket, address),
                        daemon=True
                    )
                    thread.start()
                except socket.timeout:
                    continue
            except Exception as e:
                if self.running:
                    print(f"❌ Error accepting file connection: {e}")

    def handle_client(self, client_socket: socket.socket, address: Tuple):
        """Handle communication with a connected client"""
        username = None
        recv_buffer = ""
        
        try:
            client_socket.settimeout(10.0)
            username, leftover = self._receive_username_with_buffer(client_socket)
            if not username:
                return
            
            with self.lock:
                self.clients[client_socket] = {
                    'username': username,
                    'address': address,
                    'connected_at': datetime.now()
                }
                if username not in self.recent_chats:
                    self.recent_chats[username] = []
            
            print(f"✓ User '{username}' connected from {address}")
            
            # Update in storage
            storage.update_user(username, str(address[0]))
            
            # Prime buffer with any leftover data that arrived alongside the username
            recv_buffer = leftover or ""

            # Small delay to ensure client receive thread is ready
            import time
            time.sleep(0.2)
            
            self._send_welcome_messages(client_socket, username)
            
            client_socket.settimeout(None)
            
            while self.running:
                try:
                    data = client_socket.recv(4096)
                    if not data:
                        break
                    
                    recv_buffer += data.decode('utf-8')
                    recv_buffer = self._process_messages(client_socket, recv_buffer)
                    
                except ConnectionResetError:
                    break
                except Exception as e:
                    print(f"❌ Error handling message from {username}: {e}")
                    break
                    
        except socket.timeout:
            print(f"⏱️ Connection timeout for {address}")
        except Exception as e:
            print(f"❌ Error handling client {username or address}: {e}")
        finally:
            self.handle_disconnect(client_socket, username)

    def _receive_username_with_buffer(self, client_socket: socket.socket) -> Tuple[Optional[str], str]:
        """Receive username line and return (username, leftover_buffer)."""
        buffer = ""
        while '\n' not in buffer:
            chunk = client_socket.recv(1024).decode('utf-8')
            if not chunk:
                return None, ""
            buffer += chunk

        first_line, remainder = buffer.split('\n', 1)
        try:
            data = json.loads(first_line)
            username = data.get('username', f"User_{int(time.time())}")
            return username, remainder
        except (json.JSONDecodeError, ValueError):
            return None, remainder

    def _send_welcome_messages(self, client_socket: socket.socket, username: str):
        # SKIP welcome messages for system users like VideoServer
        if username.startswith('_') and username.endswith('_System_'):
            print(f"[SERVER] System connection from {username} - skipping broadcasts")
            # Just send them minimal data
            self.send_chat_history(client_socket)
            # DON'T broadcast to other users
            # DON'T add to user list
            return
        
        print(f"[SERVER] Sending welcome messages to {username}")
        print(f"[SERVER] Client socket: {client_socket}")
        
        # First, send chat history to the NEW user (so they see old messages)
        print(f"[SERVER] About to send chat history to {username}")
        self.send_chat_history(client_socket)
        print(f"[SERVER] Sent chat history to {username}")
        
        # Send file metadata
        print(f"[SERVER] About to send file metadata to {username}")
        self.send_file_metadata(client_socket)
        print(f"[SERVER] Sent file metadata to {username}")
        
        # Send group list
        print(f"[SERVER] About to send group list to {username}")
        self.send_group_list(client_socket)
        print(f"[SERVER] Sent group list to {username}")
        
        # Also send a tailored user list directly to this client
        print(f"[SERVER] About to send user list to {username}")
        self.send_user_list_to_client(client_socket)
        print(f"[SERVER] Sent user list to {username}")
        
        # Send any private chat histories involving this user so the client can populate local state
        try:
            print(f"[SERVER] Sending private chat histories to {username} if any exist")
            # storage.private_chats keys are tuples (user1, user2)
            for key, msgs in getattr(storage, 'private_chats', {}).items():
                try:
                    userA, userB = key
                except Exception:
                    # If keys are serialized strings like 'a_b', handle that
                    if isinstance(key, str) and '_' in key:
                        parts = key.split('_')
                        userA, userB = parts[0], parts[1]
                    else:
                        continue
                if username == userA or username == userB:
                    other = userB if username == userA else userA
                    messages = storage.get_private_chat(username, other, 200)
                    history_msg = {
                        'type': 'private_history',
                        'target_user': other,
                        'messages': messages
                    }
                    self._send_to_client(client_socket, history_msg)
            print(f"[SERVER] Finished sending private chat histories to {username}")
        except Exception as e:
            print(f"[SERVER] Error sending private histories: {e}")

        # Send all group messages to the new user
        with self.lock:
            for group_id in self.groups.keys():
                messages = storage.get_group_chat(group_id, 100)
                response = {
                    'type': 'group_history',
                    'group_id': group_id,
                    'messages': messages
                }
                self._send_to_client(client_socket, response)
        
        # NOW broadcast to all OTHER clients that someone joined
        welcome_msg = {
            'type': 'system',
            'sender': 'Server',
            'content': f"{username} joined the chat",
            'timestamp': self._timestamp()
        }
        self.broadcast(json.dumps(welcome_msg), exclude=client_socket)
        print(f"[SERVER] Broadcasted join message for {username}")
        
        # Send welcome message to the new user themselves
        welcome_msg_self = {
            'type': 'system',
            'sender': 'Server',
            'content': f"Welcome {username}! You joined the chat",
            'timestamp': self._timestamp()
        }
        self._send_to_client(client_socket, welcome_msg_self)
        
        # Broadcast updated user list to EVERYONE (including new user)
        self.broadcast_user_list()
        print(f"[SERVER] Broadcasted user list to all clients")

    def _process_messages(self, client_socket: socket.socket, buffer: str) -> str:
        """Process received messages from buffer"""
        parts = buffer.split('\n')
        remaining = parts[-1]
        
        for part in parts[:-1]:
            if not part.strip():
                continue
            
            try:
                message = json.loads(part)
                self._route_message(client_socket, message)
            except json.JSONDecodeError as e:
                username = self.clients.get(client_socket, {}).get('username', 'Unknown')
                print(f"⚠️ Invalid JSON from {username}: {e}")
        
        return remaining

    def _route_message(self, client_socket: socket.socket, message: Dict):
        """Route message to appropriate handler"""
        if 'timestamp' not in message:
            message['timestamp'] = self._timestamp()
        msg_type = message.get('type', 'chat')
        
        # Debug logging for video invites
        if 'video_invite' in msg_type:
            print(f"[SERVER] Routing video message: {msg_type}")
            print(f"[SERVER] Message details: {message}")
        
        handlers = {
            'chat': self._handle_chat_message,
            'private': self._handle_private_message,
            'private_file': self._handle_private_file,
            'private_audio': self._handle_private_audio,
            'group_create': self._handle_group_create,
            'group_message': self._handle_group_message,
            'group_file': self._handle_group_file,
            'group_audio': self._handle_group_audio,
            'group_add_member': self._handle_group_add_member,
            'group_remove_member': self._handle_group_remove_member,
            'request_private_history': self._handle_private_history_request,
            'request_group_history': self._handle_group_history_request,
            'screen_share': self._handle_screen_share,
            'save_recent_chat': self._handle_save_recent_chat,
            'request_chat_history': self._handle_chat_history_request,
            'file_share': self._handle_global_file_share,
            'audio_share': self._handle_global_audio_share,
            'video_invite': self._handle_video_invite,
            'video_invite_private': self._handle_video_invite_private,
            'video_invite_group': self._handle_video_invite_group,
            'video_missed': self._handle_video_missed,
            'get_users': self._handle_get_users,  # NEW HANDLER
            'request_groups': self._handle_request_groups,  # NEW HANDLER
        }
        handler = handlers.get(msg_type)
        if handler:
            if 'video_invite' in msg_type:
                print(f"[SERVER] Found handler for {msg_type}, calling it")
            handler(client_socket, message)
        else:
            if 'video_invite' in msg_type:
                print(f"[SERVER] ERROR: No handler found for {msg_type}")
            else:
                print(f"[SERVER] No handler for message type: {msg_type}")

    def _handle_get_users(self, client_socket: socket.socket, message: Dict):
        """Handle explicit request for user list"""
        print(f"[SERVER] Received get_users request")
        self.send_user_list_to_client(client_socket)

    def _handle_request_groups(self, client_socket: socket.socket, message: Dict):
        """Handle explicit request for groups list"""
        print(f"[SERVER] Received request_groups request")
        self.send_group_list(client_socket)

    def _handle_global_file_share(self, client_socket: socket.socket, message: Dict):
        """Handle global file sharing"""
        sender = message.get('sender')
        file_id = message.get('file_id')
        file_name = message.get('file_name')
        file_size = message.get('file_size')
        
        if not file_id:
            return
        
        print(f"📨 Global file share from {sender}: {file_name}")
        
        # Create message object for storage
        file_notification = {
            'type': 'file_notification',
            'sender': sender,
            'file_id': file_id,
            'file_name': file_name,
            'size': file_size,
            'file_size': file_size,
            'timestamp': message.get('timestamp', self._timestamp())
        }
        
        # Add to global chat history
        self.chat_history.append(file_notification)
        storage.add_global_message(file_notification)
        
        if len(self.chat_history) > 1000:
            self.chat_history = self.chat_history[-1000:]
        
        # Broadcast to ALL clients
        print(f"📢 Broadcasting file notification to all clients")
        self.broadcast(json.dumps(file_notification))
        
    def _handle_global_audio_share(self, client_socket: socket.socket, message: Dict):
        """Handle global audio sharing"""
        sender = message.get('sender')
        audio_data = message.get('audio_data')
        duration = message.get('duration', 0)
        
        if not audio_data:
            return
        
        print(f"🎵 Global audio message from {sender} ({duration}s)")
        
        # Create message object for storage - strip audio data to save space in chat history
        audio_message = {
            'type': 'audio_message',
            'sender': sender,
            'duration': duration,
            'has_audio': True,
            'audio_data': audio_data,  # Include audio data for storage
            'timestamp': message.get('timestamp', self._timestamp())
        }
        
        # Add to global chat history
        self.chat_history.append(audio_message)
        storage.add_global_message(audio_message)
        
        if len(self.chat_history) > 1000:
            self.chat_history = self.chat_history[-1000:]
        
        # Broadcast to ALL clients
        print(f"📢 Broadcasting audio message to all clients")
        self.broadcast(json.dumps(audio_message))
        
    def _handle_private_audio(self, client_socket: socket.socket, message: Dict):
        """Handle private audio message"""
        sender = message.get('sender')
        receiver = message.get('receiver')
        audio_data = message.get('audio_data')
        duration = message.get('duration', 0)
        
        if not receiver or not audio_data:
            return
        
        print(f"🎵 Private audio from {sender} to {receiver} ({duration}s)")
        
        # Create audio message for private chat
        audio_message = {
            'type': 'private_audio',
            'sender': sender,
            'receiver': receiver,
            'duration': duration,
            'has_audio': True,
            'audio_data': audio_data,
            'timestamp': message.get('timestamp', self._timestamp())
        }
        
        # Store in private chat history
        storage.add_private_message(sender, receiver, audio_message)
        
        # Update recent chats
        with self.lock:
            if sender not in self.recent_chats:
                self.recent_chats[sender] = []
            if receiver not in self.recent_chats:
                self.recent_chats[receiver] = []
                
            if receiver not in self.recent_chats[sender]:
                self.recent_chats[sender].insert(0, receiver)
                if len(self.recent_chats[sender]) > 5:
                    self.recent_chats[sender].pop()
            
            if sender not in self.recent_chats[receiver]:
                self.recent_chats[receiver].insert(0, sender)
                if len(self.recent_chats[receiver]) > 5:
                    self.recent_chats[receiver].pop()
        
        # Send to receiver if online
        receiver_socket = self._find_client_socket(receiver)
        if receiver_socket:
            self._send_to_client(receiver_socket, audio_message)
            print(f"   ✓ Sent audio to {receiver}")
        else:
            print(f"   ℹ️  {receiver} is offline, audio saved to history")
        
        # Send back to sender for confirmation
        self._send_to_client(client_socket, audio_message)
        
    def _handle_group_audio(self, client_socket: socket.socket, message: Dict):
        """Handle group audio message"""
        group_id = message.get('group_id')
        sender = message.get('sender')
        audio_data = message.get('audio_data')
        duration = message.get('duration', 0)
        
        if group_id not in self.groups or not audio_data:
            return
        
        if sender not in self.groups[group_id]['members']:
            return
        
        print(f"🎵 Group audio from {sender} in group {group_id} ({duration}s)")
        
        # Create audio message for group
        audio_message = {
            'type': 'group_audio',
            'sender': sender,
            'group_id': group_id,
            'duration': duration,
            'has_audio': True,
            'audio_data': audio_data,
            'timestamp': message.get('timestamp', self._timestamp())
        }
        
        # Store in group chat history
        self.group_messages[group_id].append(audio_message)
        storage.add_group_message(group_id, audio_message)
        
        # Send to all group members (including sender for confirmation)
        with self.lock:
            for sock, info in self.clients.items():
                if info['username'] in self.groups[group_id]['members']:
                    self._send_to_client(sock, audio_message)
        
    def _handle_chat_history_request(self, client_socket: socket.socket, message: Dict):
        """Handle request for global chat history"""
        print(f"[SERVER] Received request for chat history")
        self.send_chat_history(client_socket)

    def _handle_chat_message(self, client_socket: socket.socket, message: Dict):
        """Handle public chat message"""
        sender = message.get('sender')
        content = message.get('content', '')
        
        print(f"💬 Global message from {sender}: {content[:50]}")
        
        self.chat_history.append(message)
        storage.add_global_message(message)
        
        if len(self.chat_history) > 1000:
            self.chat_history = self.chat_history[-1000:]
        
        # Broadcast to ALL clients (no exclude)
        print(f"📢 Broadcasting to all {len(self.clients)} connected clients")
        self.broadcast(json.dumps(message))

    def _handle_private_message(self, client_socket: socket.socket, message: Dict):
   
        sender = message.get('sender')
        receiver = message.get('receiver')
        
        if not receiver:
            return
        
        key = tuple(sorted([sender, receiver]))
        if key not in self.private_messages:
            self.private_messages[key] = []
        self.private_messages[key].append(message)
        
        # PERSIST TO STORAGE
        storage.add_private_message(sender, receiver, message)
        
        with self.lock:
            if sender in self.recent_chats and receiver not in self.recent_chats[sender]:
                self.recent_chats[sender].insert(0, receiver)
                if len(self.recent_chats[sender]) > 5:
                    self.recent_chats[sender].pop()
            
            if receiver in self.recent_chats and sender not in self.recent_chats[receiver]:
                self.recent_chats[receiver].insert(0, sender)
                if len(self.recent_chats[receiver]) > 5:
                    self.recent_chats[receiver].pop()
        
        # Send to receiver
        receiver_socket = self._find_client_socket(receiver)
        if receiver_socket:
            self._send_to_client(receiver_socket, message)
        else:
            error_msg = {
                'type': 'system',
                'sender': 'Server',
                #'content': f"User {receiver} is offline. Message saved.",
                'timestamp': self._timestamp()
            }
            self._send_to_client(client_socket, error_msg)
        
        # SEND MESSAGE BACK TO SENDER SO THEY SEE IT TOO
        self._send_to_client(client_socket, message)

    def _handle_private_file(self, client_socket: socket.socket, message: Dict):
        """Handle private file sharing"""
        sender = message.get('sender')
        receiver = message.get('receiver')
        file_id = message.get('file_id')
        file_name = message.get('file_name')
        file_size = message.get('file_size')
        
        if not receiver or not file_id:
            return
        
        print(f"📨 Private file from {sender} to {receiver}: {file_name}")
        
        # Create message object for storage - PRIVATE ONLY, don't broadcast
        file_message = {
            'type': 'private_file',
            'sender': sender,
            'receiver': receiver,
            'file_id': file_id,
            'file_name': file_name,
            'size': file_size,
            'file_size': file_size,
            'timestamp': message.get('timestamp', self._timestamp())
        }
        
        # Store in private chat history ONLY
        storage.add_private_message(sender, receiver, file_message)
        
        # Update recent chats
        with self.lock:
            if sender not in self.recent_chats:
                self.recent_chats[sender] = []
            if receiver not in self.recent_chats:
                self.recent_chats[receiver] = []
                
            if receiver not in self.recent_chats[sender]:
                self.recent_chats[sender].insert(0, receiver)
                if len(self.recent_chats[sender]) > 5:
                    self.recent_chats[sender].pop()
            
            if sender not in self.recent_chats[receiver]:
                self.recent_chats[receiver].insert(0, sender)
                if len(self.recent_chats[receiver]) > 5:
                    self.recent_chats[receiver].pop()
        
        # Send ONLY to receiver if online - don't broadcast to everyone
        receiver_socket = self._find_client_socket(receiver)
        if receiver_socket:
            self._send_to_client(receiver_socket, file_message)
            print(f"   ✓ Sent file to {receiver}")
        else:
            print(f"   ℹ️  {receiver} is offline, file saved to history")
        
        # Send acknowledgment back to sender
        self._send_to_client(client_socket, file_message)
        print(f"   ✓ Sent file acknowledgment to {sender}")

    def _handle_group_create(self, client_socket: socket.socket, message: Dict):
        """Handle group creation"""
        group_name = message.get('group_name')
        members = message.get('members', [])
        creator = message.get('sender')
        
        if not group_name:
            return
        
        group_id = f"group_{int(time.time() * 1000)}"
        
        with self.lock:
            members_set = set(members)
            members_set.add(creator)
            
            self.groups[group_id] = {
                'id': group_id,
                'name': group_name,
                'members': list(members_set),
                'created_by': creator,
                'created_at': self._timestamp()
            }
            self.group_messages[group_id] = []
        
        notification = {
            'type': 'group_created',
            'group_id': group_id,
            'group_name': group_name,
            'members': list(members_set),
            'created_by': creator,
            'timestamp': self._timestamp()
        }
        
        self._notify_group_members(group_id, notification)
        self.broadcast_group_list()
        
        print(f"✓ Group '{group_name}' created by {creator} ({len(members_set)} members)")

    def _handle_group_message(self, client_socket: socket.socket, message: Dict):
        """Handle group message"""
        group_id = message.get('group_id')
        sender = message.get('sender')
        
        if group_id not in self.groups:
            return
        
        if sender not in self.groups[group_id]['members']:
            return
        
        self.group_messages[group_id].append(message)
        storage.add_group_message(group_id, message)  # PERSIST TO STORAGE
        
        # Send to ALL group members including sender
        with self.lock:
            for sock, info in self.clients.items():
                if info['username'] in self.groups[group_id]['members']:
                    self._send_to_client(sock, message)

    def _handle_group_file(self, client_socket: socket.socket, message: Dict):
        """Handle group file sharing"""
        group_id = message.get('group_id')
        sender = message.get('sender')
        file_id = message.get('file_id')
        file_name = message.get('file_name')
        file_size = message.get('file_size')
        
        if group_id not in self.groups or not file_id:
            return
        
        if sender not in self.groups[group_id]['members']:
            return
        
        print(f"📨 Group file from {sender} in group {group_id}: {file_name}")
        
        # Create file message for group
        file_message = {
            'type': 'group_file',
            'sender': sender,
            'group_id': group_id,
            'file_id': file_id,
            'file_name': file_name,
            'size': file_size,
            'file_size': file_size,
            'timestamp': message.get('timestamp', self._timestamp())
        }
        
        # Store in group chat history
        self.group_messages[group_id].append(file_message)
        storage.add_group_message(group_id, file_message)
        
        # Send to all group members
        with self.lock:
            for sock, info in self.clients.items():
                if info['username'] in self.groups[group_id]['members']:
                    self._send_to_client(sock, file_message)

    def _handle_group_add_member(self, client_socket: socket.socket, message: Dict):
        """Handle adding member to group"""
        group_id = message.get('group_id')
        username = message.get('username')
        requester = message.get('sender')
        
        if not self._validate_group_operation(client_socket, group_id, requester, require_membership=True):
            return
        
        with self.lock:
            if username not in self.groups[group_id]['members']:
                self.groups[group_id]['members'].append(username)
                
                notification = {
                    'type': 'group_member_added',
                    'group_id': group_id,
                    'group_name': self.groups[group_id]['name'],
                    'username': username,
                    'added_by': requester,
                    'timestamp': self._timestamp()
                }
                
                self._notify_group_members(group_id, notification)
                self.broadcast_group_list()

    def _handle_group_remove_member(self, client_socket: socket.socket, message: Dict):
        """Handle removing member from group"""
        group_id = message.get('group_id')
        username = message.get('username')
        requester = message.get('sender')
        
        if group_id not in self.groups:
            return
        
        if requester != self.groups[group_id]['created_by'] and requester != username:
            self._send_error(client_socket, "Only the group creator can remove members")
            return
        
        with self.lock:
            if username in self.groups[group_id]['members']:
                self.groups[group_id]['members'].remove(username)
                
                notification = {
                    'type': 'group_member_removed',
                    'group_id': group_id,
                    'group_name': self.groups[group_id]['name'],
                    'username': username,
                    'removed_by': requester,
                    'timestamp': self._timestamp()
                }
                
                self._notify_group_members(group_id, notification, include_removed=username)
                self.broadcast_group_list()

    def _handle_private_history_request(self, client_socket: socket.socket, message: Dict):
        """Handle request for private message history"""
        username = self.clients.get(client_socket, {}).get('username')
        receiver = message.get('receiver')
        
        if not username or not receiver:
            return
        
        # GET FROM STORAGE FIRST
        messages = storage.get_private_chat(username, receiver, 100)
        
        response = {
            'type': 'private_history',
            'receiver': receiver,
            'messages': messages
        }
        self._send_to_client(client_socket, response)

    def _handle_group_history_request(self, client_socket: socket.socket, message: Dict):
        """Handle request for group message history"""
        username = self.clients.get(client_socket, {}).get('username')
        group_id = message.get('group_id')
        
        if not self._validate_group_operation(client_socket, group_id, username, require_membership=True):
            return
        
        # GET FROM STORAGE FIRST
        messages = storage.get_group_chat(group_id, 100)
        
        response = {
            'type': 'group_history',
            'group_id': group_id,
            'messages': messages
        }
        self._send_to_client(client_socket, response)

    def _handle_screen_share(self, client_socket: socket.socket, message: Dict):
        """Handle screen sharing message"""
        self.broadcast(json.dumps(message), exclude=client_socket)

    def _handle_save_recent_chat(self, client_socket: socket.socket, message: Dict):
        """Handle saving recent chat"""
        username = message.get('sender')
        target = message.get('target')
        
        if username and target:
            with self.lock:
                if username in self.recent_chats:
                    if target in self.recent_chats[username]:
                        self.recent_chats[username].remove(target)
                    self.recent_chats[username].insert(0, target)
                    if len(self.recent_chats[username]) > 5:
                        self.recent_chats[username].pop()

    def _handle_video_invite(self, client_socket: socket.socket, message: Dict):
        """Handle global video call invite"""
        sender = message.get('sender')
        session_id = message.get('session_id')
        link = message.get('link')
        
        print(f"[SERVER] Received global video invite from {sender}")
        print(f"[SERVER] Session ID: {session_id}")
        print(f"[SERVER] Link: {link}")
        
        if not session_id or not link:
            print(f"[SERVER] ERROR: Missing session_id or link in video invite")
            return
        
        print(f"📹 Global video invite from {sender}")

        # Create video invite message
        video_invite = {
            'type': 'video_invite',
            'sender': sender,
            'session_id': session_id,
            'link': link,
            'chat_type': 'global',
            'timestamp': message.get('timestamp', self._timestamp())
        }

        # Persist to global chat history
        self.chat_history.append(video_invite)
        storage.add_global_message(video_invite)
        if len(self.chat_history) > 1000:
            self.chat_history = self.chat_history[-1000:]

        print(f"[SERVER] Broadcasting global video invite to all clients")
        print(f"[SERVER] Connected clients count: {len(self.clients)}")

        # Broadcast to all clients including sender (so sender can see join button)
        self.broadcast(json.dumps(video_invite), exclude=None)

    def _handle_video_invite_private(self, client_socket: socket.socket, message: Dict):
        """Handle private video call invite"""
        sender = message.get('sender')
        receiver = message.get('receiver')
        session_id = message.get('session_id')
        link = message.get('link')

        if not receiver or not session_id or not link:
            print(f"[SERVER] ERROR: Missing receiver, session_id or link in private video invite")
            return

        print(f"📹 Private video invite from {sender} to {receiver}")

        # Create the primary video invite message
        video_invite_message = {
            'type': 'video_invite_private',
            'sender': sender,
            'receiver': receiver,
            'session_id': session_id,
            'link': link,
            'chat_type': 'private',
            'timestamp': message.get('timestamp', self._timestamp())
        }

        # Persist the single invite message to the shared private history
        storage.add_private_message(sender, receiver, video_invite_message)

        # Send the full invite to the receiver if they are online
        receiver_socket = self._find_client_socket(receiver)
        if receiver_socket:
            print(f"[SERVER] Found receiver socket, sending video invite to {receiver}")
            self._send_to_client(receiver_socket, video_invite_message)
            print(f"   ✓ Sent video invite to {receiver}")
        else:
            print(f"   ℹ️  {receiver} is offline - message will be in history.")

        # Send the full invite to the sender as well (so they can see the join button)
        print(f"[SERVER] Sending full video invite to sender {sender}")
        self._send_to_client(client_socket, video_invite_message)
        print(f"[SERVER] Sent video invite to sender {sender}")

    def _handle_video_invite_group(self, client_socket: socket.socket, message: Dict):
        """Handle group video call invite"""
        sender = message.get('sender')
        group_id = message.get('group_id')
        session_id = message.get('session_id')
        link = message.get('link')
        
        print(f"[SERVER] ========== GROUP VIDEO INVITE ==========")
        print(f"[SERVER] Received group video invite from {sender} for group {group_id}")
        print(f"[SERVER] Session ID: {session_id}")
        print(f"[SERVER] Link: {link}")
        print(f"[SERVER] Available groups: {list(self.groups.keys())}")
        
        # Validate group_id
        if not group_id:
            print(f"[SERVER] ERROR: group_id is None or empty!")
            self._send_to_client(client_socket, {
                'type': 'system',
                'content': 'Error: Invalid group ID for video call'
            })
            return
            
        if group_id not in self.groups:
            print(f"[SERVER] ERROR: Group {group_id} does not exist!")
            print(f"[SERVER] Available groups: {list(self.groups.keys())}")
            self._send_to_client(client_socket, {
                'type': 'system',
                'content': f'Error: Group {group_id} not found'
            })
            return
        
        if not session_id or not link:
            print(f"[SERVER] ERROR: Missing session_id or link in group video invite")
            self._send_to_client(client_socket, {
                'type': 'system',
                'content': 'Error: Invalid video session data'
            })
            return
        
        if sender not in self.groups[group_id]['members']:
            print(f"[SERVER] ERROR: Sender {sender} is not a member of group {group_id}")
            print(f"[SERVER] Group members: {self.groups[group_id]['members']}")
            self._send_to_client(client_socket, {
                'type': 'system',
                'content': 'Error: You are not a member of this group'
            })
            return
        
        print(f"📹 Group video invite from {sender} in group {group_id}")
        print(f"[SERVER] Group has {len(self.groups[group_id]['members'])} members")
        
        # Create the primary video invite message
        video_invite_message = {
            'type': 'video_invite_group',
            'sender': sender,
            'group_id': group_id,
            'session_id': session_id,
            'link': link,
            'chat_type': 'group',
            'timestamp': message.get('timestamp', self._timestamp())
        }
        
        print(f"[SERVER] Sending group video invite to {len(self.groups[group_id]['members'])} members")
        
        # Persist to group history (single message for all)
        storage.add_group_message(group_id, video_invite_message)
        print(f"[SERVER] Persisted video invite to group history")

        # Send to all group members including sender
        sent_count = 0
        with self.lock:
            for sock, info in self.clients.items():
                if info['username'] in self.groups[group_id]['members']:
                    print(f"[SERVER] Sending video invite to group member: {info['username']}")
                    self._send_to_client(sock, video_invite_message)
                    sent_count += 1
        
        print(f"[SERVER] Successfully sent video invite to {sent_count} members")
        print(f"[SERVER] ========================================")

    def _handle_video_missed(self, client_socket: socket.socket, message: Dict):
        """Handle missed video call notifications"""
        session_id = message.get('session_id')
        session_type = message.get('session_type', 'global')
        chat_id = message.get('chat_id')
        sender = message.get('sender', 'VideoServer')
        timestamp = message.get('timestamp', self._timestamp())

        missed_msg = {
            'type': 'video_missed',
            'sender': sender,
            'session_id': session_id,
            'session_type': session_type,
            'chat_id': chat_id,
            'content': f"Missed video call (session {session_id}) at {timestamp}",
            'timestamp': timestamp
        }

        if session_type == 'global':
            # Persist to global chat
            self.chat_history.append(missed_msg)
            storage.add_global_message(missed_msg)
            if len(self.chat_history) > 1000:
                self.chat_history = self.chat_history[-1000:]

            # Broadcast to all
            self.broadcast(json.dumps(missed_msg))

        elif session_type == 'private':
            # chat_id should be the other user's username
            other = chat_id
            if not other:
                return

            # Store in private history for both participants
            storage.add_private_message(sender, other, missed_msg)

            # Send to both if online
            with self.lock:
                for sock, info in self.clients.items():
                    if info['username'] in [sender, other]:
                        self._send_to_client(sock, missed_msg)

        elif session_type == 'group':
            group_id = chat_id
            if group_id not in self.groups:
                return

            # Persist to group history
            self.group_messages[group_id].append(missed_msg)
            storage.add_group_message(group_id, missed_msg)

            # Notify group members
            self._notify_group_members(group_id, missed_msg)

    def handle_file_transfer(self, client_socket: socket.socket, address: Tuple):
        """Handle file upload or download"""
        try:
            client_socket.settimeout(30.0)
            
            first_data = client_socket.recv(4096).decode('utf-8')
            first_msg = json.loads(first_data)
            
            if 'file_name' in first_msg:
                self._handle_file_upload(client_socket, first_msg)
            elif 'file_id' in first_msg:
                self._handle_file_download(client_socket, first_msg)
            
        except socket.timeout:
            print(f"⏱️ File transfer timeout from {address}")
        except json.JSONDecodeError as e:
            print(f"⚠️ Invalid file transfer JSON: {e}")
        except Exception as e:
            print(f"❌ File transfer error: {e}")
        finally:
            try:
                client_socket.close()
            except:
                pass

    def _handle_file_upload(self, client_socket: socket.socket, metadata: Dict):
        """Handle file upload"""
        file_name = metadata.get('file_name')
        file_size = metadata.get('file_size')
        sender = metadata.get('sender')
        file_id = f"{int(time.time() * 1000)}_{file_name}"
        
        print(f"📤 Receiving: {file_name} ({self._format_bytes(file_size)}) from {sender}")
        
        self.file_metadata[file_id] = {
            'file_id': file_id,
            'file_name': file_name,
            'name': file_name,
            'size': file_size,
            'file_size': file_size,
            'sender': sender,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # PERSIST TO STORAGE
        storage.add_file(file_id, self.file_metadata[file_id])
        
        client_socket.send(json.dumps({
            'status': 'ready',
            'file_id': file_id
        }).encode('utf-8'))
        
        file_data = b''
        bytes_received = 0
        
        while bytes_received < file_size:
            remaining = file_size - bytes_received
            chunk_size = min(4096, remaining)
            chunk = client_socket.recv(chunk_size)
            if not chunk:
                break
            file_data += chunk
            bytes_received += len(chunk)
        
        self.file_metadata[file_id]['data'] = file_data
        
        if bytes_received == file_size:
            print(f"✓ File received: {file_name} ({self._format_bytes(bytes_received)})")
            
            # Don't broadcast file_notification here anymore
            # Let the client send private_file, group_file, or explicit global broadcast
            # This prevents files from appearing in wrong chat contexts
            
        else:
            print(f"⚠️ Incomplete file transfer: {bytes_received}/{file_size} bytes")

    def _handle_file_download(self, client_socket: socket.socket, request: Dict):
        """Handle file download"""
        file_id = request.get('file_id')
        requester = request.get('requester')
        
        if file_id not in self.file_metadata:
            client_socket.send(json.dumps({
                'status': 'error',
                'message': 'File not found'
            }).encode('utf-8'))
            return
        
        file_info = self.file_metadata[file_id]
        
        client_socket.send(json.dumps({
            'status': 'sending',
            'file_name': file_info['file_name'],
            'file_size': file_info['size']
        }).encode('utf-8'))
        
        try:
            client_socket.recv(1024)
        except:
            pass
        
        file_data = file_info.get('data', b'')
        try:
            client_socket.sendall(file_data)
            print(f"✓ File sent: {file_info['file_name']} to {requester}")
        except Exception as e:
            print(f"❌ Error sending file: {e}")

    def send_chat_history(self, client_socket: socket.socket):
        """Send recent chat history to client"""
        try:
            # GET FROM STORAGE (send a larger slice to feel buffered even after idle)
            messages = storage.get_global_chat(300)
            
            print(f"📜 Sending {len(messages)} chat history messages to client")
            print(f"📜 First few messages: {messages[:3] if messages else 'No messages'}")
            
            history_msg = {
                'type': 'chat_history',
                'messages': messages
            }
            print(f"📜 History message: {history_msg}")
            self._send_to_client(client_socket, history_msg)
            print(f"📜 Successfully sent history to client")
        except Exception as e:
            print(f"❌ Error sending chat history: {e}")

    def send_file_metadata(self, client_socket: socket.socket):
        """Send file metadata to client"""
        try:
            # GET FROM STORAGE
            all_files = storage.get_files()
            
            files = [
                {
                    'file_id': fid,
                    'file_name': meta['file_name'],
                    'name': meta.get('name', meta['file_name']),
                    'size': meta['size'],
                    'file_size': meta['size'],
                    'sender': meta['sender'],
                    'timestamp': meta['timestamp']
                }
                for fid, meta in all_files.items()
            ]
            
            self._send_to_client(client_socket, {
                'type': 'file_metadata',
                'files': files
            })
        except Exception as e:
            print(f"❌ Error sending file metadata: {e}")

    def send_group_list(self, client_socket: socket.socket):
        """Send group list to client"""
        try:
            with self.lock:
                groups = [
                    {
                        'id': gid,
                        'name': ginfo['name'],
                        'members': ginfo['members'],
                        'created_by': ginfo['created_by']
                    }
                    for gid, ginfo in self.groups.items()
                ]
            
            self._send_to_client(client_socket, {
                'type': 'group_list',
                'groups': groups
            })
        except Exception as e:
            print(f"❌ Error sending group list: {e}")

    def send_user_list_to_client(self, client_socket: socket.socket):
        """Send user list to a specific client"""
        try:
            with self.lock:
                requester = self.clients.get(client_socket, {}).get('username')
                # Filter out system users and the requester themselves
                users = [info['username'] for info in self.clients.values()
                         if not (info['username'].startswith('_') and info['username'].endswith('_System_'))
                         and info['username'] != requester]

            # Send outside the lock to avoid deadlock
            self._send_to_client(client_socket, {
                'type': 'user_list',
                'users': sorted(users)
            })
            print(f"📋 Sent user list to client '{requester}': {users}")
        except Exception as e:
            print(f"❌ Error sending user list: {e}")

    def broadcast(self, message: str, exclude: Optional[socket.socket] = None):
        """Broadcast message to all clients except excluded one"""
        with self.lock:
            total_clients = len(self.clients)
            excluded_str = "excluding 1" if exclude else "to all"
            print(f"📤 Broadcasting {excluded_str} {total_clients} client(s)")
            
            disconnected = []
            sent_count = 0
            
            for sock in list(self.clients.keys()):
                if sock != exclude:
                    try:
                        sock.send((message + '\n').encode('utf-8'))
                        sent_count += 1
                        username = self.clients[sock].get('username', 'Unknown')
                        print(f"   ✓ Sent to {username}")
                    except Exception as e:
                        print(f"   ❌ Failed to send to {self.clients.get(sock, {}).get('username', 'Unknown')}: {e}")
                        disconnected.append(sock)
            
            print(f"   Total sent: {sent_count}/{total_clients}")
            
            for sock in disconnected:
                username = self.clients.get(sock, {}).get('username', 'Unknown')
                self.handle_disconnect(sock, username)

    def broadcast_user_list(self):
        """Broadcast current user list to all clients"""
        with self.lock:
            # Prepare a base set of non-system users
            non_system_users = [info['username'] for info in self.clients.values()
                                if not (info['username'].startswith('_') and info['username'].endswith('_System_'))]

            # Send a tailored list to each client (exclude themselves)
            for sock, info in list(self.clients.items()):
                requester = info.get('username')
                users_for_client = sorted([u for u in non_system_users if u != requester])
                try:
                    sock.send((json.dumps({
                        'type': 'user_list',
                        'users': users_for_client
                    }) + '\n').encode('utf-8'))
                    print(f"📋 Sent tailored user list to '{requester}': {users_for_client}")
                except Exception as e:
                    print(f"   ❌ Failed to send user list to {requester}: {e}")

    def broadcast_group_list(self):
        """Broadcast group list to all clients"""
        with self.lock:
            groups = [
                {
                    'id': gid,
                    'name': ginfo['name'],
                    'members': ginfo['members'],
                    'created_by': ginfo['created_by']
                }
                for gid, ginfo in self.groups.items()
            ]
        
        self.broadcast(json.dumps({
            'type': 'group_list',
            'groups': groups
        }))

    def handle_disconnect(self, client_socket: socket.socket, username: Optional[str] = None):
        """Handle client disconnection"""
        print(f"[SERVER] Handling disconnect for socket: {client_socket}")
        
        # First, remove from clients list
        with self.lock:
            if client_socket in self.clients:
                if username is None:
                    username = self.clients[client_socket]['username']
                del self.clients[client_socket]
                print(f"👋 User '{username}' disconnected")
            else:
                print(f"[SERVER] Socket not found in clients list")
                return
        
        # Then handle broadcasts outside the lock to avoid deadlock
        if username and not (username.startswith('_') and username.endswith('_System_')):
            # Send disconnect message to remaining clients
            disconnect_msg = {
                'type': 'system',
                'sender': 'Server',
                'content': f"{username} left the chat",
                'timestamp': self._timestamp()
            }
            print(f"[SERVER] Broadcasting disconnect message for {username}")
            self.broadcast(json.dumps(disconnect_msg))
            
            # Update user list for all remaining clients
            print(f"[SERVER] Broadcasting updated user list after {username} disconnect")
            self.broadcast_user_list()
        
        print(f"[SERVER] Disconnect handling complete for {username}")
        
        try:
            client_socket.close()
            print(f"[SERVER] Closed socket for {username}")
        except Exception as e:
            print(f"[SERVER] Error closing socket for {username}: {e}")

    def _send_to_client(self, client_socket: socket.socket, message: Dict):
        """Send message to a specific client"""
        try:
            message_str = json.dumps(message) + '\n'
            print(f"[SERVER] Sending to client: {message.get('type')} ({len(message_str)} bytes)")
            client_socket.send(message_str.encode('utf-8'))
            print(f"[SERVER] Successfully sent {message.get('type')} to client")
        except Exception as e:
            print(f"❌ Error sending to client: {e}")
            print(f"❌ Message type: {message.get('type')}")
            print(f"❌ Client socket: {client_socket}")

    def _send_error(self, client_socket: socket.socket, error_message: str):
        """Send error message to client"""
        self._send_to_client(client_socket, {
            'type': 'system',
            'sender': 'Server',
            'content': error_message,
            'timestamp': self._timestamp()
        })

    def _find_client_socket(self, username: str) -> Optional[socket.socket]:
        """Find socket for given username"""
        with self.lock:
            for sock, info in self.clients.items():
                if info['username'] == username:
                    return sock
        return None

    def _notify_group_members(self, group_id: str, message: Dict, include_removed: Optional[str] = None):
        """Send notification to all group members"""
        if group_id not in self.groups:
            return
        
        members = set(self.groups[group_id]['members'])
        if include_removed:
            members.add(include_removed)
        
        with self.lock:
            for sock, info in self.clients.items():
                if info['username'] in members:
                    self._send_to_client(sock, message)

    def _validate_group_operation(self, client_socket: socket.socket, group_id: str, 
                                   username: str, require_membership: bool = False) -> bool:
        """Validate group operation"""
        if group_id not in self.groups:
            self._send_error(client_socket, "Group not found")
            return False
        
        if require_membership and username not in self.groups[group_id]['members']:
            self._send_error(client_socket, "You are not a member of this group")
            return False
        
        return True

    def _timestamp(self) -> str:
        """Get current timestamp"""
        return datetime.now().strftime("%H:%M:%S")

    def _format_bytes(self, size: int) -> str:
        """Format bytes to human-readable string"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"

    def cleanup(self):
        """Clean up resources"""
        print("\n🧹 Cleaning up resources...")
        
        with self.lock:
            for sock in list(self.clients.keys()):
                try:
                    sock.close()
                except:
                    pass
            self.clients.clear()
        
        try:
            self.server_socket.close()
        except:
            pass
        
        try:
            self.file_server_socket.close()
        except:
            pass

    def shutdown(self):
        """Gracefully shutdown the server"""
        print("\n🛑 Shutting down server...")
        self.running = False
        
        shutdown_msg = {
            'type': 'system',
            'sender': 'Server',
            'content': 'Server is shutting down',
            'timestamp': self._timestamp()
        }
        self.broadcast(json.dumps(shutdown_msg))
        
        self.cleanup()
        print("✅ Server stopped successfully")


def signal_handler(sig, frame):
    """Handle Ctrl+C signal"""
    if 'server' in globals():
        server.shutdown()
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    
    print("\n" + "="*60)
    print("🚀 Shadow Nexus Collaboration Server")
    print("="*60)
    print("Press Ctrl+C to stop the server\n")
    
    server = CollaborationServer()
    try:
        server.start()
    except KeyboardInterrupt:
        server.shutdown()
    except Exception as e:
        print(f"❌ Server error: {e}")
        import traceback
        traceback.print_exc()
        if 'server' in locals():
            server.shutdown()