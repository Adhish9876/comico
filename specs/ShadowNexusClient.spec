# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files
from PyInstaller.utils.hooks import copy_metadata

datas = [('web', 'web'), ('static', 'static')]
datas += collect_data_files('eel')
datas += copy_metadata('eel')


a = Analysis(
    ['..\\backend\\client.py'],
    pathex=['..\\backend'],
    binaries=[],
    datas=datas,
    hiddenimports=['bottle', 'bottle_websocket', 'whichcraft', 'pyparsing', 'pkg_resources', 'socketio', 'flask', 'requests', 'urllib3'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas', 'PIL'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
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
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='ShadowNexusClient',
)
