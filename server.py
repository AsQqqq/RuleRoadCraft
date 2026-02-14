from http.server import SimpleHTTPRequestHandler, HTTPServer
import mimetypes
from urllib.parse import urlparse

mimetypes.add_type("application/javascript", ".js")

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path

        # Редирект ТОЛЬКО для корня
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/ui/index.html")
            self.end_headers()
            return

        super().do_GET()

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)

server = HTTPServer(("0.0.0.0", 5500), Handler)
print("Serving on http://localhost:5500")
server.serve_forever()
