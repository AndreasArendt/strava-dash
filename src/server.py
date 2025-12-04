# server.py
import http.server
import json
import threading
from pathlib import Path

TOKENS_FILE = Path("tokens.json")


class TokenHandler(http.server.BaseHTTPRequestHandler):

    def do_POST(self):
        if self.path == "/save_tokens":
            length = int(self.headers.get("content-length"))
            body = self.rfile.read(length)
            tokens = json.loads(body)

            with open(TOKENS_FILE, "w") as f:
                json.dump(tokens, f, indent=2)

            print("\n🎉 Tokens received and saved to tokens.json!\n")

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Tokens saved.")
            return

        self.send_response(404)
        self.end_headers()


def start_server():
    HOST, PORT = "127.0.0.1", 5000
    print(f"Local token receiver running at http://{HOST}:{PORT}/save_tokens")

    httpd = http.server.HTTPServer((HOST, PORT), TokenHandler)
    httpd.serve_forever()


def run():
    # Start server in background
    threading.Thread(target=start_server, daemon=True).start()
