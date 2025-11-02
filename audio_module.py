#!/usr/bin/env python3
"""
audio_module.py - Real-time audio conferencing for Shadow Nexus
Handles audio capture, encoding, transmission, mixing, and playback
"""

import queue
import threading
import socket
import json
import base64
import time
import os
from datetime import datetime
from typing import Optional, Dict, List
from dotenv import load_dotenv
import sys

# Load environment variables - check multiple possible locations for .env
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    application_path = os.path.dirname(sys.executable)
    env_path = os.path.join(application_path, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"[AUDIO] Loaded .env from: {env_path}")
    else:
        # Try in _internal folder (PyInstaller extracts here)
        env_path = os.path.join(application_path, '_internal', '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"[AUDIO] Loaded .env from: {env_path}")
        else:
            print(f"[AUDIO] ⚠️ WARNING: .env file not found!")
else:
    # Running as Python script
    load_dotenv()
    print(f"[AUDIO] Loaded .env from script directory")

DEFAULT_AUDIO_SERVER_IP = os.getenv('SERVER_IP', 'localhost')
print(f"[AUDIO] Using SERVER_IP: {DEFAULT_AUDIO_SERVER_IP}")

# Lazy imports for heavy modules
_pyaudio = None
_numpy = None

def get_pyaudio():
    global _pyaudio
    if _pyaudio is None:
        import pyaudio
        _pyaudio = pyaudio
    return _pyaudio

def get_numpy():
    global _numpy
    if _numpy is None:
        import numpy as np
        _numpy = np
    return _numpy

# Audio configuration
SAMPLE_RATE = 16000
CHUNK_SIZE = 512
CHANNELS = 1
FRAME_SIZE = SAMPLE_RATE // 50  # 20ms frames

def get_audio_format():
    pyaudio = get_pyaudio()
    return pyaudio.paInt16

class AudioEngine:
    """Handles all audio operations"""
    
    def __init__(self, username: str, server_host: str = None, audio_port: int = 5557):
        if server_host is None:
            server_host = DEFAULT_AUDIO_SERVER_IP
        
        self.username = username
        self.server_host = server_host
        self.audio_port = audio_port
        
        # Defer heavy initialization
        self.audio = None
        self.running = False
        self.enabled = False
        
        # Audio queues
        self.input_queue: queue.Queue = queue.Queue(maxsize=10)
        self.output_queue: queue.Queue = queue.Queue(maxsize=50)
        self.playback_buffer = None
        
        # Socket for audio
        self.audio_socket: Optional[socket.socket] = None
        
        # Streams
        self.input_stream = None
        self.output_stream = None
        
        # Participants audio (for mixing)
        self.participant_audio: Dict[str, dict] = {}
        
        print(f"[AUDIO] Engine initialized for {username}")
    
    def initialize_streams(self):
        """Initialize audio input and output streams"""
        try:
            # Initialize PyAudio only when needed
            if self.audio is None:
                pyaudio = get_pyaudio()
                self.audio = pyaudio.PyAudio()
                
                # Initialize numpy buffer
                if self.playback_buffer is None:
                    np = get_numpy()
                    self.playback_buffer = np.zeros(FRAME_SIZE, dtype=np.int16)
            
            audio_format = get_audio_format()
            
            # Input stream (microphone) - without callback for better compatibility
            try:
                self.input_stream = self.audio.open(
                    format=audio_format,
                    channels=CHANNELS,
                    rate=SAMPLE_RATE,
                    input=True,
                    frames_per_buffer=CHUNK_SIZE,
                    exception_on_overflow=False
                )
                self.input_stream.start_stream()
                print("[AUDIO] Input stream initialized")
            except Exception as e:
                print(f"[AUDIO] Failed to initialize input stream: {e}")
                return False
            
            # Output stream (speaker) - without callback for better compatibility
            try:
                self.output_stream = self.audio.open(
                    format=audio_format,
                    channels=CHANNELS,
                    rate=SAMPLE_RATE,
                    output=True,
                    frames_per_buffer=CHUNK_SIZE,
                    exception_on_overflow=False
                )
                self.output_stream.start_stream()
                print("[AUDIO] Output stream initialized")
            except Exception as e:
                print(f"[AUDIO] Failed to initialize output stream: {e}")
                if self.input_stream:
                    self.input_stream.stop_stream()
                    self.input_stream.close()
                return False
            
            print("[AUDIO] Streams initialized successfully")
            return True
        except Exception as e:
            print(f"[AUDIO] Failed to initialize streams: {e}")
            return False
    
    def _input_callback(self, in_data, frame_count, time_info, status):
        """Capture audio from microphone"""
        if status:
            print(f"[AUDIO] Input status: {status}")
        
        try:
            self.input_queue.put_nowait(np.frombuffer(in_data, dtype=np.int16))
        except queue.Full:
            print("[AUDIO] Input queue full, dropping frame")
        
        return (in_data, pyaudio.paContinue)
    
    def _output_callback(self, in_data, frame_count, time_info, status):
        """Play audio to speaker"""
        if status:
            print(f"[AUDIO] Output status: {status}")
        
        try:
            audio_data = self.output_queue.get_nowait()
            return (audio_data.tobytes(), pyaudio.paContinue)
        except queue.Empty:
            # Return silence if no audio
            silence = np.zeros(frame_count, dtype=np.int16)
            return (silence.tobytes(), pyaudio.paContinue)
    
    def start(self):
        """Start audio engine"""
        if not self.initialize_streams():
            return False
        
        self.running = True
        self.enabled = True
        
        # Start capture thread
        capture_thread = threading.Thread(target=self._capture_audio, daemon=True)
        capture_thread.start()
        
        print("[AUDIO] Engine started")
        return True
    
    def stop(self):
        """Stop audio engine"""
        self.running = False
        self.enabled = False
        
        if self.input_stream:
            self.input_stream.stop_stream()
            self.input_stream.close()
        
        if self.output_stream:
            self.output_stream.stop_stream()
            self.output_stream.close()
        
        self.audio.terminate()
        print("[AUDIO] Engine stopped")
    
    def _capture_audio(self):
        """Capture and send audio to server"""
        while self.running and self.enabled:
            try:
                # Read directly from input stream
                if self.input_stream and self.input_stream.is_active():
                    audio_data = self.input_stream.read(CHUNK_SIZE, exception_on_overflow=False)
                    np = get_numpy()
                    frame = np.frombuffer(audio_data, dtype=np.int16)
                    
                    # Queue for processing
                    try:
                        self.input_queue.put_nowait(frame)
                    except queue.Full:
                        print("[AUDIO] Input queue full, dropping frame")
                    
                    if self.audio_socket:
                        # Send audio frame with header
                        header = {
                            'type': 'audio_frame',
                            'sender': self.username,
                            'timestamp': datetime.now().isoformat(),
                            'size': len(frame)
                        }
                        
                        # Send as: [HEADER_JSON]\n[AUDIO_BYTES]
                        self.audio_socket.send(
                            (json.dumps(header) + '\n').encode() + frame.tobytes()
                        )
                else:
                    time.sleep(0.01)
            except Exception as e:
                print(f"[AUDIO] Capture error: {e}")
                time.sleep(0.1)
    
    def set_audio_socket(self, sock: socket.socket):
        """Set socket for audio transmission"""
        self.audio_socket = sock
        print("[AUDIO] Audio socket configured")
    
    def add_participant_audio(self, username: str, audio_data):
        """Add participant audio for mixing"""
        self.participant_audio[username] = audio_data
    
    def mix_audio(self):
        """Mix all participant audio streams"""
        np = get_numpy()
        if not self.participant_audio:
            return np.zeros(FRAME_SIZE, dtype=np.int16)
        
        mixed = np.zeros(FRAME_SIZE, dtype=np.float32)
        
        for username, audio_data in self.participant_audio.items():
            # Ensure audio is the right size
            if len(audio_data) != FRAME_SIZE:
                audio_data = np.pad(audio_data, (0, FRAME_SIZE - len(audio_data)))
            
            mixed += audio_data.astype(np.float32)
        
        # Normalize to prevent clipping
        num_streams = len(self.participant_audio)
        if num_streams > 0:
            mixed = mixed / num_streams
        
        # Convert back to int16
        mixed = np.clip(mixed, -32768, 32767).astype(np.int16)
        
        # Clear participant audio
        self.participant_audio.clear()
        
        return mixed
    
    def queue_playback(self, audio_data):
        """Queue audio for playback"""
        try:
            self.output_queue.put_nowait(audio_data)
        except queue.Full:
            print("[AUDIO] Playback queue full, dropping frame")
    
    def toggle_audio(self, enabled: bool):
        """Toggle audio on/off"""
        self.enabled = enabled
        status = "enabled" if enabled else "disabled"
        print(f"[AUDIO] Audio {status}")


# Server-side audio handler
class ServerAudioHandler:
    """Handles audio mixing and broadcasting on server"""
    
    def __init__(self, audio_port: int = 5557):
        self.audio_port = audio_port
        self.participant_streams: Dict[str, queue.Queue] = {}
        self.running = False
        
        print("[SERVER AUDIO] Handler initialized")
    
    def add_participant(self, username: str) -> queue.Queue:
        """Add participant to audio session"""
        self.participant_streams[username] = queue.Queue(maxsize=50)
        print(f"[SERVER AUDIO] Added participant: {username}")
        return self.participant_streams[username]
    
    def remove_participant(self, username: str):
        """Remove participant from audio session"""
        if username in self.participant_streams:
            del self.participant_streams[username]
            print(f"[SERVER AUDIO] Removed participant: {username}")
    
    def process_audio_frame(self, username: str, audio_data):
        """Process incoming audio frame and distribute to others"""
        # Broadcast to all other participants
        for participant, queue_obj in self.participant_streams.items():
            if participant != username:
                try:
                    queue_obj.put_nowait(audio_data)
                except queue.Full:
                    print(f"[SERVER AUDIO] Queue full for {participant}")
    
    def get_mixed_audio(self):
        """Get mixed audio from all participants"""
        np = get_numpy()
        mixed = np.zeros(FRAME_SIZE, dtype=np.float32)
        count = 0
        
        for username, queue_obj in self.participant_streams.items():
            try:
                while True:
                    audio_data = queue_obj.get_nowait()
                    mixed += audio_data.astype(np.float32)
                    count += 1
            except queue.Empty:
                continue
        
        if count > 0:
            mixed = mixed / count
        
        # Normalize and convert back to int16
        mixed = np.clip(mixed, -32768, 32767).astype(np.int16)
        return mixed


# Integration with Eel client
import json
import eel

# Audio state (will be set from client.py)
audio_engine = None

@eel.expose
def toggle_microphone(enabled: bool):
    """Toggle microphone on/off from UI"""
    try:
        global audio_engine
        if audio_engine:
            audio_engine.toggle_audio(enabled)
            status = "Microphone enabled" if enabled else "Microphone disabled"
            eel.showNotification(status, 'info')
            return {'success': True}
        else:
            return {'success': False, 'message': 'Audio engine not initialized'}
    except Exception as e:
        print(f"[AUDIO] Toggle error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def start_audio():
    """Start audio engine"""
    try:
        global audio_engine
        if audio_engine:
            if audio_engine.start():
                eel.showNotification('Microphone started', 'success')
                return {'success': True}
        return {'success': False, 'message': 'Failed to start audio'}
    except Exception as e:
        print(f"[AUDIO] Start error: {e}")
        return {'success': False, 'message': str(e)}

@eel.expose
def stop_audio():
    """Stop audio engine"""
    try:
        global audio_engine
        if audio_engine:
            audio_engine.stop()
            eel.showNotification('Microphone stopped', 'success')
            return {'success': True}
        return {'success': False}
    except Exception as e:
        print(f"[AUDIO] Stop error: {e}")
        return {'success': False, 'message': str(e)}
        
@eel.expose
def start_audio_recording():
    """Start audio recording"""
    try:
        pyaudio = get_pyaudio()
        import threading
        import time
        
        global recording_state
        if recording_state['is_recording']:
            return {'success': False, 'message': 'Already recording'}
        
        # Audio parameters
        FORMAT = pyaudio.paInt16
        CHANNELS = 1
        RATE = 16000
        CHUNK = 1024
        
        # Initialize recording state
        recording_state['is_recording'] = True
        recording_state['frames'] = []
        recording_state['start_time'] = time.time()
        
        # Create PyAudio instance
        try:
            recording_state['audio'] = pyaudio.PyAudio()
        except Exception as e:
            print(f"[AUDIO] PyAudio initialization error: {e}")
            recording_state['is_recording'] = False
            return {'success': False, 'message': f'Audio system error: {str(e)}'}
        
        # Open stream with better error handling
        try:
            recording_state['stream'] = recording_state['audio'].open(
                format=FORMAT, 
                channels=CHANNELS,
                rate=RATE, 
                input=True,
                frames_per_buffer=CHUNK,
                exception_on_overflow=False
            )
        except Exception as e:
            print(f"[AUDIO] Stream open error: {e}")
            recording_state['audio'].terminate()
            recording_state['is_recording'] = False
            return {'success': False, 'message': f'Could not access microphone: {str(e)}. Please check permissions.'}
        
        # Start recording in a separate thread
        recording_thread = threading.Thread(target=_record_audio_thread, daemon=True)
        recording_thread.start()
        
        # Show recording state
        eel.showRecordingState(True, 60)  # Max 60 seconds
        
        print("[AUDIO] Recording started")
        return {'success': True}
    
    except Exception as e:
        print(f"[AUDIO] Start recording error: {e}")
        if 'recording_state' in globals():
            recording_state['is_recording'] = False
        return {'success': False, 'message': str(e)}

def _record_audio_thread():
    """Background thread for recording audio"""
    try:
        while recording_state['is_recording']:
            try:
                data = recording_state['stream'].read(1024, exception_on_overflow=False)
                recording_state['frames'].append(data)
            except Exception as e:
                print(f"[AUDIO] Recording thread error: {e}")
                break
    except Exception as e:
        print(f"[AUDIO] Recording thread error: {e}")

@eel.expose
def stop_audio_recording():
    """Stop audio recording and return the recorded data"""
    try:
        global recording_state
        if not recording_state['is_recording']:
            return {'success': False, 'message': 'Not recording'}
        
        # Stop recording
        recording_state['is_recording'] = False
        
        # Calculate duration
        duration = int(time.time() - recording_state['start_time'])
        
        # Stop and close the stream
        if recording_state['stream']:
            recording_state['stream'].stop_stream()
            recording_state['stream'].close()
        
        if recording_state['audio']:
            recording_state['audio'].terminate()
        
        # Hide recording state
        eel.showRecordingState(False)
        
        # Process recorded audio
        if recording_state['frames']:
            import wave
            import tempfile
            import os
            import base64
            
            # Create a temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Audio parameters
            FORMAT = pyaudio.paInt16
            CHANNELS = 1
            RATE = 16000
            
            # Write to WAV file
            wf = wave.open(temp_path, 'wb')
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(RATE)
            wf.writeframes(b''.join(recording_state['frames']))
            wf.close()
            
            # Read the file and convert to base64
            with open(temp_path, 'rb') as audio_file:
                audio_data = base64.b64encode(audio_file.read()).decode('utf-8')
            
            # Clean up
            os.unlink(temp_path)
            
            print(f"[AUDIO] Recording stopped, duration: {duration}s")
            return {
                'success': True, 
                'audio_data': audio_data,
                'duration': duration,
                'timestamp': datetime.now().isoformat()
            }
        else:
            return {'success': False, 'message': 'No audio data recorded'}
    
    except Exception as e:
        print(f"[AUDIO] Stop recording error: {e}")
        return {'success': False, 'message': str(e)}

# Initialize recording state
recording_state = {
    'is_recording': False,
    'frames': [],
    'start_time': 0,
    'audio': None,
    'stream': None
}

@eel.expose
def play_audio(audio_data):
    """Play audio from base64 data"""
    try:
        pyaudio = get_pyaudio()
        import wave
        import tempfile
        import os
        import base64
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
            
        # Decode base64 and write to file
        audio_bytes = base64.b64decode(audio_data)
        with open(temp_path, 'wb') as f:
            f.write(audio_bytes)
            
        # Open the WAV file
        wf = wave.open(temp_path, 'rb')
        
        # Create PyAudio instance
        audio = pyaudio.PyAudio()
        
        # Open stream
        stream = audio.open(format=audio.get_format_from_width(wf.getsampwidth()),
                          channels=wf.getnchannels(),
                          rate=wf.getframerate(),
                          output=True)
        
        # Read and play data
        data = wf.readframes(1024)
        while data:
            stream.write(data)
            data = wf.readframes(1024)
            
        # Stop and close
        stream.stop_stream()
        stream.close()
        audio.terminate()
        
        # Clean up
        os.unlink(temp_path)
        
        return {'success': True}
    
    except Exception as e:
        print(f"[AUDIO] Playback error: {e}")
        return {'success': False, 'message': str(e)}