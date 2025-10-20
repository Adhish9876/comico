#!/usr/bin/env python3
"""
storage.py - Persistent storage for Shadow Nexus
Saves all chats to JSON files for recovery on server restart
No SQLite needed for LAN - JSON is simpler and sufficient
"""

import json
import os
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

class Storage:
    def __init__(self, data_dir: str = 'shadow_nexus_data'):
        """Initialize storage with file persistence"""
        self.data_dir = data_dir
        self.ensure_directory()
        
        # In-memory storage
        self.global_chat: List[Dict] = []
        self.private_chats: Dict[Tuple[str, str], List[Dict]] = {}
        self.group_chats: Dict[str, List[Dict]] = {}
        self.file_metadata: Dict[str, Dict] = {}
        self.users: Dict[str, Dict] = {}
        
        # Load existing data on startup
        self.load_all()
        print("Storage initialized with persistence")

    def ensure_directory(self) -> None:
        """Create data directory if it doesn't exist"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
            print(f"Created directory: {self.data_dir}")

    # ===== GLOBAL CHAT =====
    def add_global_message(self, message: Dict[str, Any]) -> None:
        """Add global message and persist"""
        self.global_chat.append(message)
        self.save_global_chat()

    def get_global_chat(self, limit: int = 100) -> List[Dict]:
        """Get global chat history"""
        # Process audio messages to avoid storing large base64 data in memory
        processed_history = []
        for msg in self.global_chat[-limit:]:
            if msg.get('type') == 'audio_message' and 'audio_data' in msg:
                # Keep audio_data only for last 10 messages, older ones need re-download
                if len(processed_history) < (limit - 10):
                    msg = msg.copy()
                    msg['audio_data'] = None
                    msg['has_audio'] = True
            processed_history.append(msg)
        return processed_history

    def save_global_chat(self) -> None:
        """Save global chat to file"""
        try:
            path = os.path.join(self.data_dir, 'global_chat.json')
            with open(path, 'w') as f:
                json.dump(self.global_chat, f, indent=2)
        except Exception as e:
            print(f"Error saving global chat: {e}")

    def load_global_chat(self) -> None:
        """Load global chat from file"""
        try:
            path = os.path.join(self.data_dir, 'global_chat.json')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    self.global_chat = json.load(f)
                print(f"Loaded {len(self.global_chat)} global messages")
        except Exception as e:
            print(f"Error loading global chat: {e}")
            self.global_chat = []

    # ===== PRIVATE CHATS =====
    def add_private_message(self, user1: str, user2: str, message: Dict) -> None:
        """Add private message and persist"""
        key = tuple(sorted([user1, user2]))
        if key not in self.private_chats:
            self.private_chats[key] = []
        self.private_chats[key].append(message)
        self.save_private_chats()

    def get_private_chat(self, user1: str, user2: str, limit: int = 100) -> List[Dict]:
        """Get private chat between two users"""
        key = tuple(sorted([user1, user2]))
        messages = self.private_chats.get(key, [])
        return messages[-limit:]

    def save_private_chats(self) -> None:
        """Save all private chats"""
        try:
            path = os.path.join(self.data_dir, 'private_chats.json')
            # Convert tuple keys to strings for JSON
            serializable = {f"{k[0]}_{k[1]}": v for k, v in self.private_chats.items()}
            with open(path, 'w') as f:
                json.dump(serializable, f, indent=2)
        except Exception as e:
            print(f"Error saving private chats: {e}")

    def load_private_chats(self) -> None:
        """Load private chats from file"""
        try:
            path = os.path.join(self.data_dir, 'private_chats.json')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    data = json.load(f)
                # Convert string keys back to tuples
                for key_str, messages in data.items():
                    users = key_str.split('_')
                    key = tuple(sorted(users))
                    self.private_chats[key] = messages
                total = sum(len(m) for m in self.private_chats.values())
                print(f"Loaded {len(self.private_chats)} private chats ({total} messages)")
        except Exception as e:
            print(f"Error loading private chats: {e}")
            self.private_chats = {}

    # ===== GROUP CHATS =====
    def add_group_message(self, group_id: str, message: Dict) -> None:
        """Add group message and persist"""
        if group_id not in self.group_chats:
            self.group_chats[group_id] = []
        self.group_chats[group_id].append(message)
        self.save_group_chats()

    def get_group_chat(self, group_id: str, limit: int = 100) -> List[Dict]:
        """Get group chat history"""
        messages = self.group_chats.get(group_id, [])
        return messages[-limit:]

    def save_group_chats(self) -> None:
        """Save all group chats"""
        try:
            path = os.path.join(self.data_dir, 'group_chats.json')
            with open(path, 'w') as f:
                json.dump(self.group_chats, f, indent=2)
        except Exception as e:
            print(f"Error saving group chats: {e}")

    def load_group_chats(self) -> None:
        """Load group chats from file"""
        try:
            path = os.path.join(self.data_dir, 'group_chats.json')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    self.group_chats = json.load(f)
                total = sum(len(m) for m in self.group_chats.values())
                print(f"Loaded {len(self.group_chats)} group chats ({total} messages)")
        except Exception as e:
            print(f"Error loading group chats: {e}")
            self.group_chats = {}

    # ===== FILES =====
    def add_file(self, file_id: str, metadata: Dict) -> None:
        """Add file metadata and persist"""
        self.file_metadata[file_id] = metadata
        self.save_files()

    def get_files(self) -> Dict[str, Dict]:
        """Get all file metadata"""
        return self.file_metadata

    def save_files(self) -> None:
        """Save file metadata"""
        try:
            path = os.path.join(self.data_dir, 'files.json')
            with open(path, 'w') as f:
                json.dump(self.file_metadata, f, indent=2)
        except Exception as e:
            print(f"Error saving files: {e}")

    def load_files(self) -> None:
        """Load file metadata"""
        try:
            path = os.path.join(self.data_dir, 'files.json')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    self.file_metadata = json.load(f)
                print(f"Loaded {len(self.file_metadata)} files")
        except Exception as e:
            print(f"Error loading files: {e}")
            self.file_metadata = {}

    # ===== USERS =====
    def update_user(self, username: str, ip: str) -> None:
        """Update user info"""
        self.users[username] = {
            'ip': ip,
            'last_seen': datetime.now().isoformat()
        }
        self.save_users()

    def get_users(self) -> Dict[str, Dict]:
        """Get all users"""
        return self.users

    def save_users(self) -> None:
        """Save users"""
        try:
            path = os.path.join(self.data_dir, 'users.json')
            with open(path, 'w') as f:
                json.dump(self.users, f, indent=2)
        except Exception as e:
            print(f"Error saving users: {e}")

    def load_users(self) -> None:
        """Load users"""
        try:
            path = os.path.join(self.data_dir, 'users.json')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    self.users = json.load(f)
                print(f"Loaded {len(self.users)} user records")
        except Exception as e:
            print(f"Error loading users: {e}")
            self.users = {}

    # ===== LOAD/SAVE ALL =====
    def load_all(self) -> None:
        """Load all data on startup"""
        print("\nLoading persistent data...")
        self.load_global_chat()
        self.load_private_chats()
        self.load_group_chats()
        self.load_files()
        self.load_users()
        print("Data loaded successfully\n")

    def clear_all(self) -> None:
        """Clear all storage"""
        self.global_chat = []
        self.private_chats = {}
        self.group_chats = {}
        self.file_metadata = {}
        self.users = {}
        
        for filename in ['global_chat.json', 'private_chats.json', 'group_chats.json', 'files.json', 'users.json']:
            try:
                path = os.path.join(self.data_dir, filename)
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                print(f"Error deleting {filename}: {e}")
        
        print("All storage cleared")


# Singleton instance
storage = Storage()