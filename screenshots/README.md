# Screenshots Directory

This directory contains all screenshots used in the main README.md file.

## Required Screenshots

### Main Interface Screenshots
- `main-chat.png` - Main chat interface showing global, private, and group chats
- `video-call.png` - Video call interface with multiple participants
- `login-screen.png` - Login and authentication screens

### Setup & Build Screenshots
- `setup-process.png` - Step-by-step setup process (signup → login → connect)
- `build-process.png` - Building executable with build_exe.bat

### Feature Showcase Screenshots
- `chat-features.png` - Message replies, audio messages, file sharing
- `video-features.png` - Screen sharing, reactions, hand raise, thumbnails
- `file-sharing.png` - File upload/download interface
- `audio-messages.png` - Audio recording and playback interface

### Network Setup Screenshots
- `network-setup.png` - Different network configuration examples

## Screenshot Guidelines

### Recommended Dimensions
- **Main screenshots**: 1200x800px or 1920x1080px
- **Feature highlights**: 800x600px
- **UI components**: 600x400px

### Image Format
- Use PNG for UI screenshots (better quality)
- Use JPG for photos/complex images (smaller size)
- Optimize file sizes (keep under 500KB each)

### Content Guidelines
- Show the app in action with realistic data
- Use clean, professional-looking content
- Avoid personal information in screenshots
- Show different themes/states when relevant

### Naming Convention
- Use kebab-case (lowercase with hyphens)
- Be descriptive but concise
- Match the filename used in README.md

## How to Take Screenshots

### For Main Interface
1. Open the app with sample data
2. Show multiple chat types (global, private, group)
3. Include some messages, files, and audio
4. Capture at good resolution

### For Video Calls
1. Start a video call with multiple participants
2. Show different features (screen share, reactions)
3. Include camera-off thumbnails with different colors
4. Capture the full interface

### For Setup Process
1. Create a collage showing: signup → login → server connect
2. Or take separate screenshots and combine
3. Show the progression clearly

## File Structure
```
screenshots/
├── README.md                 # This file
├── main-chat.png            # Main interface
├── video-call.png           # Video calling
├── login-screen.png         # Authentication
├── setup-process.png        # Setup steps
├── build-process.png        # Build process
├── chat-features.png        # Chat features
├── video-features.png       # Video features
├── file-sharing.png         # File sharing
├── audio-messages.png       # Audio messages
└── network-setup.png        # Network setup
```

## Adding New Screenshots

1. Take the screenshot following the guidelines above
2. Save it in this directory with appropriate name
3. Add reference in main README.md:
   ```markdown
   ![Description](screenshots/filename.png)
   *Caption describing the screenshot*
   ```

## Notes

- Screenshots should be updated when UI changes significantly
- Keep screenshots current with latest version
- Consider creating animated GIFs for complex interactions
- Test that all screenshot links work in README.md