# Quick EXE Generation

## One Command to Create .EXE

Run this in PowerShell (as Administrator):

```powershell
Install-Module ps2exe -Force; ps2exe -inputFile ShadowNexus_Install_Certificate.ps1 -outputFile ShadowNexus_Install_Certificate.exe -requireAdmin -title "ShadowNexus Certificate Installer"
```

Done! Your `.exe` will be created in the current directory.

---

## What You Get

After running the command, you'll have:
- ✅ `ShadowNexus_Install_Certificate.exe`
- Send this to your clients
- They just double-click it
- SSL warning gone! ✓

---

## Alternative: Use the BAT File

If PS2EXE doesn't work, use the batch file instead:

```
ShadowNexus_Install_Certificate.bat
```

- Right-click → Properties
- Advanced → Check "Run as administrator"
- Send to clients
- Same result!

---

## Testing Your EXE

```powershell
# Run it to test
.\ShadowNexus_Install_Certificate.exe

# Or with -Silent flag (no prompts)
.\ShadowNexus_Install_Certificate.exe -Silent
```

---

## Files Ready for Distribution

1. **ShadowNexus_Install_Certificate.exe** ← Send this
2. **ShadowNexus_Install_Certificate.bat** ← Or this
3. **CLIENT_MKCERT_SETUP.md** ← Include instructions

That's it! Easy as pie! 🥧

