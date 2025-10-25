#!/usr/bin/env python3
"""
auth_module.py - MAC Address-based Authentication Module
"""

import json
import os
import uuid
import hashlib
from typing import Optional, Dict, Tuple

# Path to store user credentials
AUTH_DATA_FILE = "shadow_nexus_data/users_auth.json"

def get_mac_address() -> str:
    """Get the MAC address of the current device"""
    try:
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                       for elements in range(0,2*6,2)][::-1])
        return mac
    except Exception as e:
        print(f"[AUTH] Error getting MAC address: {e}")
        return "00:00:00:00:00:00"

def hash_password(password: str) -> str:
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def load_auth_data() -> Dict:
    """Load authentication data from file"""
    try:
        os.makedirs(os.path.dirname(AUTH_DATA_FILE), exist_ok=True)
        if os.path.exists(AUTH_DATA_FILE):
            with open(AUTH_DATA_FILE, 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"[AUTH] Error loading auth data: {e}")
        return {}

def save_auth_data(data: Dict) -> bool:
    """Save authentication data to file"""
    try:
        os.makedirs(os.path.dirname(AUTH_DATA_FILE), exist_ok=True)
        with open(AUTH_DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"[AUTH] Error saving auth data: {e}")
        return False

def check_mac_registered(mac_address: str) -> Tuple[bool, Optional[str]]:
    """
    Check if MAC address is registered
    Returns: (is_registered, username)
    """
    auth_data = load_auth_data()
    if mac_address in auth_data:
        return True, auth_data[mac_address]['username']
    return False, None

def register_user(mac_address: str, username: str, password: str) -> Tuple[bool, str]:
    """
    Register a new user with MAC address
    Returns: (success, message)
    """
    auth_data = load_auth_data()
    
    # Check if MAC is already registered
    if mac_address in auth_data:
        return False, "This device is already registered"
    
    # Check if username is already taken
    for mac, user_data in auth_data.items():
        if user_data['username'].lower() == username.lower():
            return False, "Username already taken"
    
    # Register the user
    auth_data[mac_address] = {
        'username': username,
        'password_hash': hash_password(password)
    }
    
    if save_auth_data(auth_data):
        return True, "Registration successful"
    return False, "Failed to save registration data"

def verify_login(mac_address: str, password: str) -> Tuple[bool, str, Optional[str]]:
    """
    Verify login credentials
    Returns: (success, message, username)
    """
    auth_data = load_auth_data()
    
    if mac_address not in auth_data:
        return False, "Device not registered", None
    
    user_data = auth_data[mac_address]
    password_hash = hash_password(password)
    
    if user_data['password_hash'] == password_hash:
        return True, "Login successful", user_data['username']
    return False, "Incorrect password", None

def get_username_by_mac(mac_address: str) -> Optional[str]:
    """Get username associated with MAC address"""
    auth_data = load_auth_data()
    if mac_address in auth_data:
        return auth_data[mac_address]['username']
    return None

def update_password(mac_address: str, new_password: str) -> bool:
    """
    Update password for a registered MAC address
    Returns: success status
    """
    auth_data = load_auth_data()
    
    if mac_address not in auth_data:
        print(f"[AUTH] MAC address {mac_address} not found for password update")
        return False
    
    # Update the password hash
    auth_data[mac_address]['password_hash'] = hash_password(new_password)
    
    if save_auth_data(auth_data):
        print(f"[AUTH] Password updated successfully for {auth_data[mac_address]['username']}")
        return True
    
    print(f"[AUTH] Failed to save updated password")
    return False
