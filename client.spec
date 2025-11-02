# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

import os
import sys

# Get PyAudio DLL path
pyaudio_path = None
try:
    import pyaudio
    pyaudio_path = os.path.dirname(pyaudio.__file__)
except:
    pass

# Collect binaries
binaries_list = []
if pyaudio_path:
    # Add PyAudio DLLs if they exist
    portaudio_dll = os.path.join(pyaudio_path, '_portaudio.pyd')
    if os.path.exists(portaudio_dll):
        binaries_list.append((portaudio_dll, '.'))

a = Analysis(
    ['client.py'],
    pathex=[],
    binaries=binaries_list,
    datas=[
        ('web', 'web'),
        ('shadow_nexus_data', 'shadow_nexus_data'),
        ('templates', 'templates'),
        ('cert.pem', '.'),
        ('key.pem', '.'),
        ('.env', '.'),  # Include .env file for server configuration
    ],
    hiddenimports=[
        'eel',
        # Core modules only - others loaded on demand
        'socket',
        'threading',
        'json',
        'base64',
        'datetime',
        'typing',
        'os',
        'time',
        'sys',
        'queue',
    ],
    excludes=[
        # Exclude heavy modules that aren't immediately needed
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
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],  # Empty - we'll use COLLECT for onedir mode
    exclude_binaries=True,  # Don't bundle binaries in exe
    name='ShadowNexusClient',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='ShadowNexusClient',
)