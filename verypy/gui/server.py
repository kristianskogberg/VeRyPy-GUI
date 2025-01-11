import http.server
import socketserver
import urllib.parse
import json
import logging
import os

PORT = 8000

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

def parse_vrp_file(file_path):
    with open(file_path, 'r') as file:
        lines = file.readlines()

    capacity = None
def parse_vrp_file(file_path):
    capacity = None
    locations = []
    reading_nodes = False

    with open(file_path, 'r') as file:
        for line in file:
            if line.startswith('CAPACITY'):
                capacity = int(line.split(':')[1].strip())
            elif line.startswith('NODE_COORD_SECTION'):
                reading_nodes = True
            elif line.startswith('DEMAND_SECTION') or line.startswith('DEPOT_SECTION'):
                reading_nodes = False
            elif reading_nodes:
                parts = line.split()
                node_id = int(parts[0])
                x_coord = float(parts[1])
                y_coord = float(parts[2])
                locations.append((x_coord, y_coord))
    return capacity, locations

class Handler(http.server.SimpleHTTPRequestHandler):
    """
    This class serves the index.html file on GET requests to the root URL
    and handles POST requests to the /run endpoint to run the VeRyPy algorithm
    with the provided parameters.
    """
    def do_GET(self):
        # Serve the index.html file for the root path
        if self.path == '/':
            self.path = 'index.html'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path == '/run':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                params = json.loads(post_data.decode('utf-8'))

                # Extract and log the selected algorithm
                algorithm = params.get('algorithm', 'No algorithm selected')
                capacity = params.get('capacity', 'No capacity specified')
                locations = params.get('locations', 'No locations specified')

                logging.info(f"Selected algorithm: {algorithm}")
                logging.info(f"Vehicle capacity: {capacity}")
                logging.info(f"Locations: {locations}")

                # Placeholder function to run VeRyPy
                # Replace this with actual code to run VeRyPy
                logging.info(params)

                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'VeRyPy has been run successfully!')
            except (KeyError, ValueError) as e:
                logging.error(f"Invalid or missing Content-Length header: {e}")
                self.send_response(400)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'Bad Request: Invalid or missing Content-Length header')
            except json.JSONDecodeError:
                logging.error("Invalid JSON received")
                self.send_response(400)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'Invalid JSON')
            except Exception as e:
                logging.error(f"Error handling /run request: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'Internal Server Error')

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        logging.info(f"Serving at port {PORT}")
        httpd.serve_forever()