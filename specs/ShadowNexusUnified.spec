# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['..\\backend\\unified_server.py'],
    pathex=['..\\backend'],
    binaries=[],
    datas=[('templates', 'templates'), ('static', 'static'), ('web', 'web'), ('certs', 'certs')],
    hiddenimports=['socketio', 'flask', 'flask_socketio', 'eventlet', 'dns.resolver', 'ssl', 'json', 'sqlite3', 'storage', 'auth_module', 'audio_module', 'video_module', 'cert_manager', 'server', 'werkzeug', 'jinja2', 'markupsafe', 'itsdangerous', 'click', 'engineio', 'socketio.server', 'socketio.client', 'eventlet.wsgi', 'eventlet.green', 'eventlet.green.socket', 'eventlet.green.ssl', 'socketio.namespace', 'engineio.async_drivers.threading', 'dotenv', 'cryptography', 'cryptography.hazmat', 'cryptography.hazmat.primitives', 'cryptography.hazmat.primitives.hashes', 'cryptography.hazmat.primitives.serialization', 'cryptography.x509'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas', 'PIL', 'cv2', 'tensorflow', 'torch', 'scipy'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ShadowNexusUnified',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
