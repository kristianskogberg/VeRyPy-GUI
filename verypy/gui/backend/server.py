import os
import tempfile
import json
import logging
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import TCPServer
from time import time
from verypy.util import sol2routes
from verypy.cvrp_ops import normalize_solution, recalculate_objective, validate_solution_feasibility, generate_missing_coordinates
from verypy import get_algorithms
from verypy.cvrp_io import read_TSPLIB_CVRP, read_TSBLIB_additional_constraints

PORT = 8000

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

def create_temp_vrp_file(params):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".vrp") as temp_vrp_file:
        temp_vrp_file.write(f"NAME : temporary\n".encode())
        temp_vrp_file.write(f"TYPE : {params.get('type', 'CVRP')}\n".encode())
        temp_vrp_file.write(f"DIMENSION : {len(params['coordinates'])}\n".encode())
        temp_vrp_file.write(f"EDGE_WEIGHT_TYPE : {params.get('edge_weight_type', 'EUC_2D')}\n".encode())
        capacity = params.get('capacity', None)
        if capacity is not None:
            temp_vrp_file.write(f"CAPACITY : {capacity}\n".encode())
        temp_vrp_file.write(f"NODE_COORD_SECTION\n".encode())
        for i, coord in enumerate(params['coordinates']):
            if len(coord) != 2:
                logger.error(f"Invalid coordinate data: {coord}")
                continue
            temp_vrp_file.write(f"{i + 1} {coord[0]} {coord[1]}\n".encode())
        customer_demands = params.get('customer_demands', None)
        if customer_demands is not None:
            temp_vrp_file.write(f"DEMAND_SECTION\n".encode())
            for i, demand in enumerate(customer_demands):
                temp_vrp_file.write(f"{i + 1} {demand}\n".encode())
        depot_node = params.get('depot_node', 1)
        temp_vrp_file.write(f"DEPOT_SECTION\n".encode())
        temp_vrp_file.write(f"{depot_node}\n-1\nEOF\n".encode())

        # Log the contents of the temporary .vrp file
        temp_vrp_file.seek(0)
        logger.info("Temporary .vrp file contents:\n" + temp_vrp_file.read().decode())

        return temp_vrp_file.name

class Handler(SimpleHTTPRequestHandler):
    """
    This class serves the index.html file on GET requests to the root URL
    and handles POST requests to the /run endpoint to run the VeRyPy algorithm
    with the provided parameters.
    """
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        elif self.path == '/algorithms':
            self.handle_algorithms()
            return
        logging.info(f"GET request for {self.path}")
        return SimpleHTTPRequestHandler.do_GET(self)

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

                logging.info("Generating temporary .vrp file using provided parameters")
                temp_vrp_file_path = create_temp_vrp_file(params)
                problem = read_TSPLIB_CVRP(temp_vrp_file_path)
                N, points, dd_points, customer_demands, distance_matrix, C, ewt = read_TSPLIB_CVRP(temp_vrp_file_path)
                K, L, st = read_TSBLIB_additional_constraints(temp_vrp_file_path)
                os.remove(temp_vrp_file_path)

                if points is None:
                    if dd_points is not None:
                        points = dd_points
                    else:
                        points, ewt = generate_missing_coordinates(customer_demands)

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

                    # logging.info(f"Running algorithm {algo_name} with parameters: {param_values}")

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
    web_dir = os.path.join(os.path.dirname(__file__), '../frontend')
    os.chdir(web_dir)
    with HTTPServer(("", PORT), Handler) as httpd:
        logging.info(f"Serving at port {PORT}")
        httpd.serve_forever()