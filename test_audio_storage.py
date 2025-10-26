#!/usr/bin/env python3
"""
Test script to verify audio messages are stored and retrieved correctly
"""

from storage import storage

# Get global chat messages
messages = storage.get_global_chat(100)

print(f"Total messages: {len(messages)}")
print("\nAudio messages:")

audio_count = 0
audio_with_data = 0
audio_without_data = 0

for msg in messages:
    if msg.get('type') in ['audio_message', 'private_audio', 'group_audio']:
        audio_count += 1
        has_data = 'audio_data' in msg and msg['audio_data']
        
        if has_data:
            audio_with_data += 1
            data_length = len(msg['audio_data'])
            print(f"✓ {msg.get('sender')} - {msg.get('timestamp')} - {data_length} chars")
        else:
            audio_without_data += 1
            print(f"✗ {msg.get('sender')} - {msg.get('timestamp')} - NO DATA")

print(f"\nSummary:")
print(f"  Total audio messages: {audio_count}")
print(f"  With audio_data: {audio_with_data}")
print(f"  Without audio_data: {audio_without_data}")

if audio_without_data > 0:
    print("\n⚠️  WARNING: Some audio messages are missing audio_data!")
else:
    print("\n✓ All audio messages have audio_data!")
