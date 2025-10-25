# 🚀 ShadowNexus Client - Quick Start Guide

## ⚡ Instant Startup!

Your ShadowNexus client now starts in **~1 second** thanks to optimized folder-based packaging!

---

## 📂 What You Have

```
your-project/
├── ShadowNexusClient.bat          ← Double-click this! (easiest)
├── launch_client.bat               ← Alternative launcher with tips
├── dist/
│   └── ShadowNexusClient/         ← The application folder
│       ├── ShadowNexusClient.exe  ← Main executable
│       └── _internal/             ← Required files (don't touch!)
└── build_exe.bat                  ← Rebuild after code changes
```

---

## 🎯 How to Run

### Method 1: Quick Launch (Easiest)
1. Double-click **`ShadowNexusClient.bat`**
2. Wait ~1 second
3. Browser opens automatically!

### Method 2: Direct Launch
1. Go to `dist/ShadowNexusClient/`
2. Double-click `ShadowNexusClient.exe`
3. Done!

### Method 3: With Tips
1. Double-click `launch_client.bat`
2. Read the helpful tips
3. Application starts

---

## 📤 Sharing with Others

### To distribute your client:

1. **Zip the folder:**
   - Right-click `dist/ShadowNexusClient/`
   - Send to → Compressed (zipped) folder
   - Share the zip file

2. **Recipients:**
   - Extract the zip
   - Run `ShadowNexusClient.exe`
   - No installation needed!

### Optional: Include the launcher
- Also share `ShadowNexusClient.bat` for easier access
- Place it in the same directory as the `dist` folder

---

## 🔧 Troubleshooting

### "Application won't start"
- Make sure you're running the .exe from inside the `ShadowNexusClient` folder
- Don't move the .exe out of its folder!
- Check Windows Defender isn't blocking it

### "Takes longer than 1 second"
- First run might be slower (Windows scanning)
- Subsequent runs will be instant
- Add folder to antivirus exclusions for best performance

### "Can't find files"
- The `_internal` folder must stay next to the .exe
- Don't separate or rename these files
- Re-extract from zip if files are missing

---

## 🔄 Rebuilding After Changes

If you modify the Python code:

1. Run `build_exe.bat`
2. Wait for build to complete (~30 seconds)
3. New version will be in `dist/ShadowNexusClient/`
4. Test the new build

---

## 💡 Pro Tips

- **Startup time:** ~1 second (vs 30 seconds with old single-file mode!)
- **No extraction:** Files stay on disk, no temp folder extraction
- **Portable:** Copy the folder anywhere, it just works
- **Updates:** Just replace the folder with a new build
- **Antivirus:** Add to exclusions for instant startup

---

## 📊 Performance Comparison

| Mode | Startup Time | Size | Portability |
|------|-------------|------|-------------|
| Old (onefile) | 30 seconds | 60MB | Single file |
| New (onedir) | ~1 second | 200MB | Folder |

**Winner:** Onedir mode - 30x faster startup! 🎉

---

## ❓ FAQ

**Q: Why is it a folder now instead of a single .exe?**  
A: Folder mode is 30x faster! No extraction to temp directory needed.

**Q: Can I make it a single file?**  
A: Yes, but it will be much slower (30 seconds). Not recommended.

**Q: How do I share it?**  
A: Zip the `ShadowNexusClient` folder and share the zip.

**Q: Does it need installation?**  
A: No! Just extract and run.

**Q: Can I rename the folder?**  
A: Yes, but don't rename files inside it.

---

## 🎉 Enjoy Your Lightning-Fast Client!

From 30 seconds to 1 second - that's a 97% improvement! 🚀
