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
        # Serve the index.html file for the root path
        if self.path == '/':
            self.path = 'index.html'
        # Log the request path
        logging.info(f"GET request for {self.path}")
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

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
                    capacity_constraint = problem.capacity_constraint
                    points = problem.coordinate_points

                    algorithm = params.get('algorithm', 'No algorithm selected')

                    logging.info(f"Selected algorithm: {algorithm}")
                    logging.info(f"Distance Matrix: {distance_matrix}")
                    logging.info(f"Customer Demands: {customer_demands}")
                    logging.info(f"Capacity Constraint: {capacity_constraint}")

                    try:
                        # Load algorithms.json to get the import path and function name
                        with open('algorithms.json', 'r') as f:
                            algorithms = json.load(f)

                        # Find the selected algorithm
                        selected_algorithm = next((algo for algo in algorithms if algo['value'] == algorithm), None)
                        if not selected_algorithm:
                            raise ValueError(f"Algorithm {algorithm} not found in algorithms.json")

                        import_path = selected_algorithm['import_path']
                        function_name = selected_algorithm['function_name']
                        parameters = selected_algorithm['parameters']

                        # Dynamically import and run the selected algorithm
                        algorithm_module = __import__(import_path, fromlist=[function_name])
                        algorithm_function = getattr(algorithm_module, function_name)

                        # Prepare parameters for the algorithm
                        param_values = {
                            'points': points,
                            'D': distance_matrix,
                            'd': customer_demands,
                            'C': capacity_constraint,
                            'L': None  # Optional route length constraint
                        }

                        # Extract additional parameters from the request if needed
                        for param in parameters:
                            if param not in param_values and param in params:
                                param_values[param] = params[param]

                        # Filter the parameters to match the function signature
                        func_params = {param: param_values[param] for param in parameters if param in param_values}

                        # Measure the elapsed time for solving the VRP
                        start_time = time()
                        solution = algorithm_function(**func_params)
                        elapsed_time = time() - start_time

                        # Normalize and calculate the objective of the solution
                        solution = normalize_solution(solution)
                        objective = recalculate_objective(solution, distance_matrix)
                        K = solution.count(0) - 1

                        # Validate the solution feasibility
                        feasibility = validate_solution_feasibility(solution, distance_matrix, customer_demands, capacity_constraint, None, False)

                        # Convert solution to routes
                        routes = sol2routes(solution)
                        formatted_solution = "\n".join([f"Route #{route_idx + 1} : {route}" for route_idx, route in enumerate(routes)])

                        logging.info(f"Solution: {formatted_solution}")
                        logging.info(f"Objective: {objective}")
                        logging.info(f"Number of routes (K): {K}")
                        logging.info(f"Elapsed time: {elapsed_time:.2f} seconds")
                        logging.info(f"Feasibility: {feasibility}")

                        # Ensure all data is JSON serializable
                        response_data = {
                            'solution': formatted_solution,
                            'objective': int(objective),
                            'num_routes': int(K),
                            'elapsed_time': elapsed_time,
                            'feasibility': feasibility
                        }

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
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        logging.info(f"Serving at port {PORT}")
        httpd.serve_forever()