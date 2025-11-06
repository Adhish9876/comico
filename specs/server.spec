# -*- mode: python ; coding: utf-8 -*-

"""
FIXED PyInstaller spec for Shadow Nexus Server Executable
Addresses application initialization error 0xc0000142

This spec file is identical to ShadowNexusServer.spec for consistency.
Use either file, but ShadowNexusServer.spec is recommended.
"""

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules
import platform

# Disable UPX compression - known to cause DLL loading issues on Windows
block_cipher = None

# Get current platform
is_windows = platform.system() == 'Windows'

# Essential data files that MUST be included
datas = [
    ('web', 'web'),
    ('templates', 'templates'), 
    ('shadow_nexus_data', 'shadow_nexus_data'),
    ('static', 'static'),
]

# Only include certificates if they exist
if os.path.exists('cert.pem'):
    datas.append(('cert.pem', '.'))
if os.path.exists('key.pem'):
    datas.append(('key.pem', '.'))
if os.path.exists('.env'):
    datas.append(('.env', '.'))

# Critical hidden imports to prevent initialization failures
hiddenimports = [
    # Core Python modules (Windows compatibility)
    'threading',
    'socket',
    'json',
    'base64',
    'uuid',
    'datetime',
    'time',
    'os',
    'sys',
    'signal',
    'ssl',
    'hashlib',
    'warnings',
    'logging',
    'queue',
    'typing',
    
    # Network & web framework essentials
    'flask',
    'flask_socketio',
    'eventlet',
    'eventlet.wsgi',
    'eventlet.green',
    'eventlet.green.threading',
    'eventlet.green.socket',
    'eventlet.green.ssl',
    'gevent',
    'gevent._socket2',
    'gevent._socket3',
    'socketio',
    'engineio',
    
    # Security & crypto
    'cryptography',
    'cryptography.hazmat',
    'cryptography.hazmat.primitives',
    'cryptography.hazmat.primitives.hashes',
    'cryptography.hazmat.primitives.serialization',
    'cryptography.hazmat.backends',
    'cryptography.hazmat.backends.openssl',
    
    # HTTP & requests
    'requests',
    'urllib3',
    'urllib3.util',
    'urllib3.util.retry',
    'urllib3.util.connection',
    
    # Audio/Video processing
    'pyaudio',
    'numpy',
    'cv2',
    
    # Environment & configuration  
    'dotenv',
    
    # Windows-specific modules
    'winsound',
    'msvcrt',
    'winreg',
    '_winapi',
    
    # Additional required modules found in warnings
    'pkg_resources',
    'setuptools',
    'distutils',
    'collections.abc',
    'importlib.metadata',
    'zipp',
]

# Windows-specific imports
if is_windows:
    hiddenimports.extend([
        'win32api',
        'win32con', 
        'win32file',
        'win32pipe',
        'win32process',
        'win32security',
        'pywintypes',
    ])

# Binaries to include (compiled extensions)
binaries = []

# Try to collect essential compiled modules
try:
    import pyaudio
    pyaudio_path = os.path.dirname(pyaudio.__file__)
    for file in os.listdir(pyaudio_path):
        if file.endswith(('.pyd', '.dll')):
            binaries.append((os.path.join(pyaudio_path, file), '.'))
except:
    pass

try:
    import numpy
    # Include numpy DLLs for Windows
    if is_windows:
        numpy_path = os.path.dirname(numpy.__file__)
        for root, dirs, files in os.walk(numpy_path):
            for file in files:
                if file.endswith('.dll'):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(root, numpy_path)
                    if rel_path == '.':
                        rel_path = 'numpy'
                    else:
                        rel_path = f'numpy/{rel_path}'
                    binaries.append((full_path, rel_path))
except:
    pass

# Modules to exclude (reduce size, prevent conflicts)
excludes = [
    'matplotlib',
    'scipy', 
    'pandas',
    'tkinter',
    'turtle',
    'test',
    'unittest',
    'doctest',
    'pdb',
    'profile',
    'pstats',
    'cProfile',
    'tracemalloc',
    # Problematic modules that cause initialization issues
    '_frozen_importlib',
    '_frozen_importlib_external',
]

a = Analysis(
    ['server_launcher.py'],  # Main entry point
    pathex=['..\\backend'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={
        # Disable problematic hooks
        'gi': {'module-versions': {'Gtk': '3.0'}},
    },
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
    # Critical: Use more lenient module collection
    module_collection_mode={
        'pkg_resources': 'py',
        'setuptools': 'py',
        'distutils': 'py',
    },
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ShadowNexusServer',
    debug=False,  # Keep False for production
    bootloader_ignore_signals=False,
    strip=False,  # Don't strip symbols - can cause issues
    upx=False,  # CRITICAL: Disable UPX compression to prevent DLL loading failures
    console=True,  # Show console for server output
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # Add manifest for Windows compatibility
    manifest=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,  # Don't strip
    upx=False,   # CRITICAL: No UPX compression
    upx_exclude=[],
    name='ShadowNexusServer',
)
