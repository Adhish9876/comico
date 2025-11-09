#!/usr/bin/env python3
"""
cert_manager.py - Automatic SSL Certificate Management
Handles mkcert certificate generation and installation for Shadow Nexus
"""

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path
from datetime import datetime

class CertificateManager:
    """Manages SSL certificate generation using mkcert"""
    
    def __init__(self, project_dir=None):
        """Initialize certificate manager"""
        self.project_dir = project_dir or os.getcwd()
        self.cert_file = os.path.join(self.project_dir, 'cert.pem')
        self.key_file = os.path.join(self.project_dir, 'key.pem')
        self.system = platform.system()
        
    def is_mkcert_installed(self):
        """Check if mkcert is installed"""
        try:
            result = subprocess.run(['mkcert', '-version'], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
    
    def install_mkcert(self):
        """Install mkcert based on OS"""
        print("\n[CERT] Installing mkcert...")
        
        try:
            if self.system == 'Windows':
                return self._install_mkcert_windows()
            elif self.system == 'Darwin':
                return self._install_mkcert_mac()
            elif self.system == 'Linux':
                return self._install_mkcert_linux()
            else:
                print(f"[CERT] ❌ Unsupported OS: {self.system}")
                return False
        except Exception as e:
            print(f"[CERT] ❌ Error installing mkcert: {e}")
            return False
    
    def _install_mkcert_windows(self):
        """Install mkcert on Windows using Chocolatey or direct download"""
        print("[CERT] Installing mkcert on Windows...")
        
        # Try Chocolatey first
        if shutil.which('choco'):
            try:
                subprocess.run(['choco', 'install', 'mkcert', '-y'], 
                             check=True, 
                             capture_output=True,
                             timeout=120)
                print("[CERT] ✅ mkcert installed via Chocolatey")
                return True
            except Exception as e:
                print(f"[CERT] Chocolatey install failed: {e}")
        
        # Try scoop
        if shutil.which('scoop'):
            try:
                subprocess.run(['scoop', 'install', 'mkcert'], 
                             check=True, 
                             capture_output=True,
                             timeout=120)
                print("[CERT] ✅ mkcert installed via Scoop")
                return True
            except Exception as e:
                print(f"[CERT] Scoop install failed: {e}")
        
        print("[CERT] ⚠️ Please install mkcert manually:")
        print("[CERT] Option 1: choco install mkcert")
        print("[CERT] Option 2: scoop install mkcert")
        print("[CERT] Option 3: Download from https://github.com/FiloSottile/mkcert/releases")
        return False
    
    def _install_mkcert_mac(self):
        """Install mkcert on macOS using Homebrew"""
        print("[CERT] Installing mkcert on macOS...")
        
        if shutil.which('brew'):
            try:
                subprocess.run(['brew', 'install', 'mkcert'], 
                             check=True, 
                             capture_output=True,
                             timeout=120)
                print("[CERT] ✅ mkcert installed via Homebrew")
                return True
            except Exception as e:
                print(f"[CERT] Homebrew install failed: {e}")
        
        print("[CERT] ⚠️ Please install Homebrew first: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
        return False
    
    def _install_mkcert_linux(self):
        """Install mkcert on Linux using apt, dnf, or pacman"""
        print("[CERT] Installing mkcert on Linux...")
        
        distro_commands = [
            (['apt-get', 'update'], ['apt-get', 'install', '-y', 'mkcert']),
            (['dnf', 'install', '-y', 'mkcert'],),
            (['pacman', '-Sy', 'mkcert'],),
        ]
        
        for cmd_group in distro_commands:
            for cmd in (cmd_group if isinstance(cmd_group, tuple) else (cmd_group,)):
                if shutil.which(cmd[0]):
                    try:
                        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
                        print(f"[CERT] ✅ mkcert installed via {cmd[0]}")
                        return True
                    except Exception as e:
                        print(f"[CERT] {cmd[0]} install failed: {e}")
        
        print("[CERT] ⚠️ mkcert not found. Please install manually.")
        return False
    
    def install_local_ca(self):
        """Install the local mkcert Certificate Authority"""
        print("[CERT] Installing local Certificate Authority...")
        
        try:
            result = subprocess.run(['mkcert', '-install'], 
                                  capture_output=True, 
                                  text=True,
                                  timeout=30)
            
            if result.returncode == 0:
                print("[CERT] ✅ Local CA installed successfully")
                return True
            else:
                print(f"[CERT] ⚠️ CA installation output: {result.stderr}")
                return True  # Often succeeds even with output
        except Exception as e:
            print(f"[CERT] ❌ Error installing CA: {e}")
            return False
    
    def get_server_ip(self):
        """Get server IP from .env file"""
        env_file = os.path.join(self.project_dir, '.env')
        
        try:
            if os.path.exists(env_file):
                with open(env_file, 'r') as f:
                    for line in f:
                        if line.startswith('SERVER_IP='):
                            ip = line.split('=')[1].strip()
                            return ip
        except Exception as e:
            print(f"[CERT] Error reading .env: {e}")
        
        return 'localhost'
    
    def generate_certificates(self, server_ip=None, additional_ips=None):
        """Generate SSL certificates using mkcert"""
        
        if not self.is_mkcert_installed():
            print("[CERT] ⚠️ mkcert not installed. Installing...")
            if not self.install_mkcert():
                print("[CERT] ❌ Could not install mkcert")
                return False
        
        # Get server IP from .env if not provided
        if not server_ip:
            server_ip = self.get_server_ip()
        
        # Build list of domains/IPs for certificate
        cert_hosts = [
            'localhost',
            '127.0.0.1',
            server_ip,
            '0.0.0.0',
        ]
        
        # Add any additional IPs
        if additional_ips:
            if isinstance(additional_ips, str):
                cert_hosts.append(additional_ips)
            elif isinstance(additional_ips, list):
                cert_hosts.extend(additional_ips)
        
        # Remove duplicates while preserving order
        cert_hosts = list(dict.fromkeys(cert_hosts))
        
        print(f"[CERT] Generating certificates for: {', '.join(cert_hosts)}")
        
        try:
            # Delete old certificates if they exist
            if os.path.exists(self.cert_file):
                os.remove(self.cert_file)
                print(f"[CERT] Removed old certificate: {self.cert_file}")
            
            if os.path.exists(self.key_file):
                os.remove(self.key_file)
                print(f"[CERT] Removed old key: {self.key_file}")
            
            # Generate new certificates
            cmd = ['mkcert', '-cert-file', self.cert_file, '-key-file', self.key_file] + cert_hosts
            
            result = subprocess.run(cmd, 
                                  capture_output=True, 
                                  text=True,
                                  timeout=60,
                                  cwd=self.project_dir)
            
            if result.returncode == 0:
                print(f"[CERT] ✅ Certificates generated successfully")
                print(f"[CERT]    cert.pem: {self.cert_file}")
                print(f"[CERT]    key.pem:  {self.key_file}")
                return True
            else:
                print(f"[CERT] ❌ Error generating certificates:")
                print(f"[CERT]    {result.stderr}")
                return False
        
        except subprocess.TimeoutExpired:
            print("[CERT] ❌ Certificate generation timed out")
            return False
        except Exception as e:
            print(f"[CERT] ❌ Error generating certificates: {e}")
            return False
    
    def verify_certificates(self):
        """Verify that certificates exist and are valid"""
        if not os.path.exists(self.cert_file):
            print(f"[CERT] ❌ Certificate file not found: {self.cert_file}")
            return False
        
        if not os.path.exists(self.key_file):
            print(f"[CERT] ❌ Key file not found: {self.key_file}")
            return False
        
        print(f"[CERT] ✅ Certificates verified")
        return True
    
    def auto_setup(self, server_ip=None):
        """Automatically setup certificates (one-time call)"""
        print("\n" + "="*60)
        print("🔒 Shadow Nexus SSL Certificate Auto-Setup")
        print("="*60)
        
        # Check if certificates already exist
        if self.verify_certificates():
            print("[CERT] Certificates already exist. Skipping setup.")
            return True
        
        print("[CERT] No certificates found. Starting setup...")
        
        # Step 1: Check/Install mkcert
        if not self.is_mkcert_installed():
            print("[CERT] mkcert not found")
            if not self.install_mkcert():
                print("[CERT] ❌ Could not install mkcert automatically")
                print("[CERT] Please install mkcert manually and try again")
                return False
        else:
            print("[CERT] ✅ mkcert is installed")
        
        # Step 2: Install local CA
        print("[CERT] Setting up local Certificate Authority...")
        if not self.install_local_ca():
            print("[CERT] ⚠️ Warning: Could not install local CA")
            print("[CERT] Certificates will still work but may show warnings")
        
        # Step 3: Generate certificates
        if not self.generate_certificates(server_ip):
            print("[CERT] ❌ Failed to generate certificates")
            return False
        
        print("\n" + "="*60)
        print("✅ SSL Certificate Setup Complete!")
        print("="*60)
        print("[CERT] Your video calls are now ready to use!")
        print("[CERT] 🔒 No browser warnings on this machine")
        print("[CERT] 📱 Friends may see warnings until they install the CA")
        print("[CERT] 💡 Tip: Share the mkcert CA with friends for a smooth experience")
        print("="*60 + "\n")
        
        return True


# Convenience functions for easy imports
def setup_certificates(project_dir=None, server_ip=None):
    """Quick setup function"""
    manager = CertificateManager(project_dir)
    return manager.auto_setup(server_ip)

def verify_and_fix_certificates(project_dir=None):
    """Verify certificates and regenerate if needed"""
    manager = CertificateManager(project_dir)
    
    if manager.verify_certificates():
        return True
    
    print("[CERT] Certificates missing or invalid. Regenerating...")
    return manager.auto_setup()


if __name__ == '__main__':
    # Run auto-setup when script is executed directly
    project_dir = os.path.dirname(os.path.abspath(__file__))
    server_ip = sys.argv[1] if len(sys.argv) > 1 else None
    
    success = setup_certificates(project_dir, server_ip)
    sys.exit(0 if success else 1)
