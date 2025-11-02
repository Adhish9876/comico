# 📦 Creating Standalone .EXE Installer

## How to Convert PowerShell Script to .EXE

You have two options:

---

## Option 1: Using PS2EXE (Easiest) ✅

### Step 1: Install PS2EXE
```powershell
# Run as Administrator:
Install-Module ps2exe -Force
```

### Step 2: Convert to EXE
```powershell
# Run as Administrator, in the project directory:
ps2exe -inputFile ShadowNexus_Install_Certificate.ps1 `
       -outputFile ShadowNexus_Install_Certificate.exe `
       -title "ShadowNexus Certificate Installer" `
       -description "Install trusted SSL certificates for ShadowNexus" `
       -version "1.0.0.0" `
       -iconFile "path\to\icon.ico" `
       -requireAdmin
```

### Result:
✅ `ShadowNexus_Install_Certificate.exe` created  
✅ Double-clickable  
✅ Requires admin (automatic UAC prompt)  
✅ Professional installer

---

## Option 2: Using Online Converter (No Installation)

### Step 1: Visit Online Tool
Go to: https://ps2exe.azurewebsites.net/

### Step 2: Upload File
- Select: `ShadowNexus_Install_Certificate.ps1`
- Click: "Convert"

### Step 3: Download EXE
- Download the generated `.exe` file
- Done!

---

## Option 3: Using BAT File (Already Available)

File: `ShadowNexus_Install_Certificate.bat`

This is a simpler batch script that also works:
- ✅ Double-click to run
- ✅ No dependencies
- ✅ Works on all Windows versions
- ✅ Less professional appearance but fully functional

---

## Distribution to Clients

### What to Send:
```
📦 ShadowNexus_Install_Certificate.exe
   (or .bat if using Option 3)
```

### Client Instructions:
```
1. Download the installer file
2. Double-click to run
3. Click "Yes" when asked for Administrator permission
4. Wait for completion message
5. Close browser and reopen it
6. Done! ✅
```

### Verification:
After installation, client can test:
```
1. Visit: https://10.200.14.204:5000
2. Look for: 🔒 Secure connection (not warning)
3. Everything works! ✓
```

---

## Full Distribution Package

For a complete client package, include:

```
ShadowNexus-Client-Setup/
├── ShadowNexus_Install_Certificate.exe
├── START_HERE.txt
├── README.md
└── Shortcut to app.html
```

### START_HERE.txt:
```
ShadowNexus Client Setup
========================

Step 1: Install Certificate (ONE-TIME)
   → Double-click: ShadowNexus_Install_Certificate.exe
   → Click Yes when prompted for admin
   → Wait for success message

Step 2: Connect to Server
   → Open browser
   → Go to: https://10.200.14.204:5000
   → Enter username and connect

Step 3: Start Using!
   → Chat, video, audio calls ready
   → No SSL warnings ✓

Questions?
   Contact your administrator
```

---

## Creating a Branded Installer

### Add Company Logo:
```powershell
ps2exe -inputFile ShadowNexus_Install_Certificate.ps1 `
       -outputFile ShadowNexus_Install_Certificate.exe `
       -iconFile "C:\path\to\logo.ico" `
       -title "ShadowNexus - Certificate Installer" `
       -version "1.0.0.0" `
       -requireAdmin
```

### Icon Resources:
- Can use any `.ico` file
- Free icon converters: online-convert.com, convertio.co

---

## Deployment Checklist

- [ ] Convert PowerShell script to `.exe`
- [ ] Test on clean Windows machine
- [ ] Test admin elevation (UAC)
- [ ] Create `START_HERE.txt` instructions
- [ ] Package into distribution folder
- [ ] Send to clients
- [ ] Verify clients can run without errors

---

## Files Included in Project

| File | Type | Purpose |
|------|------|---------|
| `ShadowNexus_Install_Certificate.ps1` | PowerShell | Main installer logic |
| `ShadowNexus_Install_Certificate.bat` | Batch | Alternative (simpler) installer |
| `CLIENT_MKCERT_SETUP.md` | Documentation | User instructions |

---

## Testing the Installer

### On Your Machine:
```powershell
# Test as admin:
.\ShadowNexus_Install_Certificate.ps1

# Test with -Silent flag:
.\ShadowNexus_Install_Certificate.ps1 -Silent
```

### Verify Installation:
```powershell
# Check if mkcert CA is installed:
mkcert -CAROOT

# Should return: C:\Users\<username>\AppData\Local\mkcert
```

---

## Troubleshooting Distribution

### "Installer won't run"
- Windows Defender might block it
- Add exception or sign the exe (requires certificate)

### "Admin prompt doesn't appear"
- Use `-requireAdmin` flag in ps2exe

### "mkcert not found"
- Include mkcert.exe in the package
- Or ensure Chocolatey/Scoop is available

---

## Summary

### Current Options:
1. ✅ **PS2EXE** - Professional, requires PowerShell module
2. ✅ **Online Converter** - Easy, no installation
3. ✅ **BAT File** - Simple, always works
4. ✅ **Manual .exe** - Manual setup, full control

### Recommendation:
Use **PS2EXE** for professional distribution:
```powershell
ps2exe -inputFile ShadowNexus_Install_Certificate.ps1 `
       -outputFile ShadowNexus_Install_Certificate.exe `
       -requireAdmin
```

Then send `ShadowNexus_Install_Certificate.exe` to clients!

