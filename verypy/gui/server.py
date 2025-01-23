import http.server
import socketserver
import urllib.parse
import json
import logging
import os
import base64
import verypy.cvrp_io as cvrp_io
from verypy.util import sol2routes
from verypy.cvrp_ops import normalize_solution, recalculate_objective, validate_solution_feasibility
from verypy import get_algorithms
from urllib.parse import parse_qs
import numpy as np
from time import time

PORT = 8000

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

class Handler(http.server.SimpleHTTPRequestHandler):
    """
    This class serves the index.html file on GET requests to the root URL
    and handles POST requests to the /run endpoint to run the VeRyPy algorithm
    with the provided parameters.
    """
    def do_GET(self):
        if self.path == '/':
            self.path = 'index.html'
        elif self.path == '/algorithms':
            self.handle_algorithms()
            return
        logging.info(f"GET request for {self.path}")
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def handle_algorithms(self):
        try:
            # Get algorithms using get_algorithms function
            algos = get_algorithms('all')
            algorithms = [{'name': algo[1], 'value': algo[0], 'description': algo[2]} for algo in algos]

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(algorithms).encode('utf-8'))
        except Exception as e:
            logging.error(f"Error getting algorithms: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

    def do_POST(self):
        if self.path == '/run':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                params = json.loads(post_data.decode('utf-8'))

                if 'vrp_file' in params:
                    logging.info("Handling base64-encoded .vrp file")
                    vrp_file_content = base64.b64decode(params['vrp_file'])
                    file_path = "/tmp/uploaded_file.vrp"
                    with open(file_path, "wb") as f:
                        f.write(vrp_file_content)

                    problem = cvrp_io.read_TSPLIB_CVRP(file_path)
                    os.remove(file_path)

                    distance_matrix = problem.distance_matrix
                    customer_demands = problem.customer_demands
                    points = problem.coordinate_points

                    algorithm = params.get('algorithm', 'No algorithm selected')

                    try:
                        algos = get_algorithms('all')
                        selected_algorithm = next((algo for algo in algos if algo[0] == algorithm), None)
                        if not selected_algorithm:
                            raise ValueError(f"Algorithm {algorithm} not found")

                        _, algo_name, _, algorithm_function = selected_algorithm

                        param_values = {
                            'points': points,
                            'D': distance_matrix,
                            'd': customer_demands,
                            'C': params.get('capacity', None),
                            'L': params.get('L', None),
                            'st': None,
                            'wtt': None,
                            'single': params.get('single', False),
                            'minimize_K': params.get('minimize_K', False)
                        }

                        start_time = time()
                        solution = algorithm_function(**param_values)
                        elapsed_time = time() - start_time

                        solution = normalize_solution(solution)
                        objective = recalculate_objective(solution, distance_matrix)
                        K = solution.count(0) - 1
                        feasibility = validate_solution_feasibility(solution, distance_matrix, customer_demands, params.get('capacity', None), None, False)
                        routes = sol2routes(solution)

                        logging.info(f"Solution: {solution}")
                        logging.info(f"Routes: {routes}")

                        # Convert distance_matrix to a list
                        distance_matrix_list = distance_matrix.tolist()

                        response_data = {
                            'objective': int(objective),
                            'num_routes': int(K),
                            'elapsed_time': elapsed_time,
                            'feasibility': feasibility,
                            'routes': routes,
                            'points': points,
                            'distance_matrix': distance_matrix_list,
                            'customer_demands': customer_demands,
                            'capacity': params.get('capacity', None)  # Add capacity to the response
                        }

                        logging.info(f"Response data: {response_data}")

                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps(response_data).encode('utf-8'))
                    except ImportError as e:
                        logging.error(f"Error importing algorithm module: {e}")
                        self.send_response(500)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': f"Error importing algorithm module: {e}"}).encode('utf-8'))
                    except AttributeError as e:
                        logging.error(f"Error accessing algorithm function: {e}")
                        self.send_response(500)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': f"Error accessing algorithm function: {e}"}).encode('utf-8'))
                    except Exception as e:
                        logging.error(f"Error running algorithm: {e}")
                        self.send_response(500)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': f"Error running algorithm: {e}"}).encode('utf-8'))
                else:
                    raise ValueError("No vrp_file parameter found in the request")

            except (KeyError, ValueError) as e:
                logging.error(f"Error handling /run request: {e}")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            except Exception as e:
                logging.error(f"Unexpected error: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        logging.info(f"Serving at port {PORT}")
        httpd.serve_forever()