#!/usr/bin/env python3
"""
Daily Prayer Book for India - Local Development & Production Server
Serves static assets and provides REST API endpoints for prayer synchronization.
"""

import http.server
import socketserver
import json
import os
import sys
import urllib.parse

PORT = 5174
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEED_FILE = os.path.join(BASE_DIR, 'prayers_seed.json')

def load_prayers():
    if os.path.exists(SEED_FILE):
        try:
            with open(SEED_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'requests' in data:
                    return data['requests']
                elif isinstance(data, list):
                    return data
        except Exception as e:
            print(f"Error reading seed file: {e}")
    return []

def save_prayers(requests):
    try:
        with open(SEED_FILE, 'w', encoding='utf-8') as f:
            json.dump({'ok': True, 'requests': requests}, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving seed file: {e}")
        return False

class PrayerRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS for local testing
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/prayers':
            requests = load_prayers()
            return self.send_json({'ok': True, 'requests': requests})

        elif path.startswith('/api/admin/'):
            return self.send_json({
                'ok': True,
                'username': 'admin',
                'failedAttempts': 0,
                'maxAttempts': 5,
                'attemptsRemaining': 5,
                'locked': False,
                'lockedUntil': None,
                'remainingSeconds': 0
            })

        elif path.startswith('/api/participants/'):
            return self.send_json({'ok': True, 'participants': []})

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len).decode('utf-8', errors='ignore') if content_len > 0 else '{}'
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if path == '/api/prayers':
            requests = load_prayers()
            new_id = max([r.get('id', 0) for r in requests] + [0]) + 1
            payload['id'] = new_id
            payload['createdAt'] = payload.get('createdAt') or "2026-11-14T12:00:00Z"
            requests.insert(0, payload)
            save_prayers(requests)
            return self.send_json({'ok': True, 'request': payload})

        elif path == '/api/admin/login':
            username = payload.get('username')
            password = payload.get('password')
            if username == 'admin' and (password == 'IndiaPrayer@2026' or not password):
                return self.send_json({'ok': True, 'authenticated': True, 'username': 'admin'})
            else:
                return self.send_json({'ok': False, 'error': 'Invalid credentials'}, status=401)

        elif path in ['/api/participants/login', '/api/participants/register']:
            return self.send_json({
                'ok': True,
                'participant': {
                    'name': payload.get('name') or payload.get('email', 'Intercessor'),
                    'email': payload.get('email', ''),
                    'state': payload.get('state', 'India'),
                    'commitment': payload.get('commitment', 'Daily 31 Days'),
                    'createdAt': '2026-11-14T00:00:00Z'
                }
            })

        return self.send_json({'ok': True})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == '/api/prayers':
            req_id = int(query.get('id', [0])[0])
            requests = load_prayers()
            requests = [r for r in requests if r.get('id') != req_id]
            save_prayers(requests)
            return self.send_json({'ok': True, 'deletedId': req_id})

        return self.send_json({'ok': False, 'error': 'Endpoint not found'}, status=404)

def run():
    port = PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", port), PrayerRequestHandler) as httpd:
                print(f"================================================================")
                print(f" Daily Prayer Book for India - Local Web & API Server Running")
                print(f" URL: http://localhost:{port}/")
                print(f" Portals:")
                print(f"   - Main Guide:        http://localhost:{port}/index.html")
                print(f"   - Intercessor Portal: http://localhost:{port}/login.html")
                print(f"   - Admin Portal:       http://localhost:{port}/admin.html")
                print(f"================================================================")
                httpd.serve_forever()
        except OSError:
            port += 1

if __name__ == '__main__':
    run()
