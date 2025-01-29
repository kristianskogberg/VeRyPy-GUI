document.addEventListener("DOMContentLoaded", function () {
  fetch("/algorithms")
    .then((response) => response.json())
    .then((algorithms) => {
      const algorithmSelect = document.getElementById("algorithm");
      algorithms.forEach((algorithm) => {
        const option = document.createElement("option");
        option.value = algorithm.value;
        option.textContent = `${algorithm.description}`;
        algorithmSelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Error fetching algorithms:", error);
      alert("An error occurred while fetching algorithms.");
    });
});

document.getElementById("vrp-file").addEventListener("change", function () {
  const file = this.files[0];
  const reader = new FileReader();

  reader.onload = function (event) {
    const fileContent = event.target.result;
    const lines = fileContent.split("\n");
    const coordinates = [];
    const customerDemands = [];
    let capacity = null;
    let edgeWeightType = null;
    let type = null;
    let inNodeCoordSection = false;
    let inDemandSection = false;

    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("NODE_COORD_SECTION")) {
        inNodeCoordSection = true;
        inDemandSection = false;
      } else if (line.startsWith("DEMAND_SECTION")) {
        inNodeCoordSection = false;
        inDemandSection = true;
      } else if (line.startsWith("DEPOT_SECTION") || line.startsWith("EOF")) {
        inNodeCoordSection = false;
        inDemandSection = false;
      } else if (line.startsWith("CAPACITY")) {
        capacity = line.split(":")[1].trim();
      } else if (line.startsWith("EDGE_WEIGHT_TYPE")) {
        edgeWeightType = line.split(":")[1].trim();
      } else if (line.startsWith("TYPE")) {
        type = line.split(":")[1].trim();
      } else if (inNodeCoordSection) {
        const parts = line.split(/\s+/);
        if (parts.length === 3) {
          coordinates.push(parts.slice(1).join(" "));
        }
      } else if (inDemandSection) {
        const parts = line.split(/\s+/);
        if (parts.length === 2) {
          customerDemands.push(parts[1]);
        }
      }
    });

    document.getElementById("coordinates").value = coordinates.join("\n");
    document.getElementById("customer-demands").value =
      customerDemands.join("\n");

    document.getElementById("capacity").value = capacity;

    // Store the extracted attributes in hidden fields
    document.getElementById("edge-weight-type").value = edgeWeightType;
    document.getElementById("type").value = type;

    const capacityElement = document.getElementById("capacity").parentElement;
    const customerDemandsElement =
      document.getElementById("customer-demands").parentElement;

    if (type === "TSP") {
      capacityElement.style.display = "none";
      customerDemandsElement.style.display = "none";
    } else {
      capacityElement.style.display = "block";
      customerDemandsElement.style.display = "block";
    }
  };

  reader.readAsText(file);
});

document.getElementById("type").addEventListener("change", function () {
  const type = document.getElementById("type").value;
  const capacityElement = document.getElementById("capacity").parentElement;
  const customerDemandsElement =
    document.getElementById("customer-demands").parentElement;

  if (type === "TSP") {
    capacityElement.style.display = "none";
    customerDemandsElement.style.display = "none";
  } else {
    capacityElement.style.display = "block";
    customerDemandsElement.style.display = "block";
  }
});

function calculateRouteCost(route, distanceMatrix) {
  let cost = 0;
  for (let i = 0; i < route.length - 1; i++) {
    cost += distanceMatrix[route[i]][route[i + 1]];
  }
  return cost;
}

function calculateUtilizationRate(route, customerDemands, capacity) {
  if (!customerDemands || !capacity) {
    return "N/A";
  }
  let totalDemand = 0;
  for (let i = 1; i < route.length - 1; i++) {
    totalDemand += customerDemands[route[i]];
  }
  utilizationRate = (totalDemand / capacity) * 100;
  return `${utilizationRate.toFixed(2)} %`;
}

function drawSolution(
  routes,
  points,
  distanceMatrix,
  customerDemands,
  capacity
) {
  const canvas = document.getElementById("solution-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Normalize coordinates to fit within the canvas
  const margin = 20;
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const scaleX = (canvas.width - 2 * margin) / (maxX - minX);
  const scaleY = (canvas.height - 2 * margin) / (maxY - minY);

  function normalizePoint(point) {
    return [
      margin + (point[0] - minX) * scaleX,
      canvas.height - margin - (point[1] - minY) * scaleY,
    ];
  }

  // Draw points
  points.forEach((point, index) => {
    const [x, y] = normalizePoint(point);
    ctx.fillStyle = index === 0 ? "red" : "blue"; // Depot in red, customers in blue
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Clear the route costs table
  const routeCostsTableBody = document
    .getElementById("route-costs-table")
    .getElementsByTagName("tbody")[0];
  routeCostsTableBody.innerHTML = "";

  // Draw routes and display route costs and utilization rates
  routes.forEach((route, routeIndex) => {
    const routeColor = `hsl(${(routeIndex * 240) / routes.length}, 100%, 40%)`; // Different color for each route, avoiding light colors
    ctx.strokeStyle = routeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    route.forEach((pointIndex, i) => {
      const [x, y] = normalizePoint(points[pointIndex]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.stroke();

    // Calculate and display route cost and utilization rate
    const routeCost = calculateRouteCost(route, distanceMatrix);
    const utilizationRate = calculateUtilizationRate(
      route,
      customerDemands,
      capacity
    );

    // Add route cost, utilization rate, and details to the table
    const row = routeCostsTableBody.insertRow();
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);
    const cell4 = row.insertCell(3);
    cell1.textContent = `Route #${routeIndex + 1}`;
    cell1.style.color = routeColor; // Set the color of the route name
    cell2.textContent = routeCost.toFixed(2);
    cell3.textContent = utilizationRate;
    cell4.textContent = route.join(" -> ");
  });
}

function exportVisualization() {
  const canvas = document.getElementById("solution-canvas");
  const link = document.createElement("a");
  link.download = "visualization.png";
  link.href = canvas.toDataURL();
  link.click();
}

function exportMetrics() {
  // Collect solution metrics
  const totalDistance = document.getElementById("total-distance").textContent;
  const numRoutes = document.getElementById("num-routes").textContent;
  const computationTime =
    document.getElementById("computation-time").textContent;
  const coveringFeasibility = document.getElementById(
    "covering-feasibility"
  ).textContent;
  const capacityFeasibility = document.getElementById(
    "capacity-feasibility"
  ).textContent;
  const routeCostFeasibility = document.getElementById(
    "route-cost-feasibility"
  ).textContent;

  const solutionMetrics = {
    totalDistance,
    numRoutes,
    computationTime,
    coveringFeasibility,
    capacityFeasibility,
    routeCostFeasibility,
  };

  // Collect route metrics
  const rows = document.querySelectorAll("#route-costs-table tbody tr");
  const routeMetrics = Array.from(rows).map((row) => {
    const cols = row.querySelectorAll("td");
    return {
      route: cols[0].textContent,
      cost: cols[1].textContent,
      utilizationRate: cols[2].textContent,
      details: cols[3].textContent,
    };
  });

  // Get selected algorithm text and value
  const algorithmSelect = document.getElementById("algorithm");
  const algorithmText =
    algorithmSelect.options[algorithmSelect.selectedIndex].textContent;
  const algorithmValue = algorithmSelect.value;

  // Combine solution metrics, route metrics, and algorithm into a JSON structure
  const metrics = {
    algorithm: algorithmText,
    solutionMetrics,
    routeMetrics,
  };

  // Create JSON file and trigger download
  const jsonContent = JSON.stringify(metrics, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });
  const link = document.createElement("a");
  const timestamp = new Date()
    .toLocaleString("en-US", { hour12: false })
    .replace(/[:/]/g, "-")
    .replace(/, /g, "_");
  const filename = `verypy_vrp_${algorithmValue}_metrics_${timestamp}.json`;
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document
  .getElementById("export-visualization")
  .addEventListener("click", exportVisualization);
document
  .getElementById("export-metrics")
  .addEventListener("click", exportMetrics);

document
  .getElementById("export-visualization")
  .addEventListener("click", exportVisualization);
document
  .getElementById("export-metrics")
  .addEventListener("click", exportMetrics);

document.getElementById("solve").addEventListener("click", function () {
  const algorithm = document.getElementById("algorithm").value;
  let capacity = document.getElementById("capacity").value;
  const coordinates = document.getElementById("coordinates").value;
  const customerDemands = document.getElementById("customer-demands").value;
  const L = document.getElementById("L").value;
  const single = document.getElementById("single").checked;
  const minimize_K = document.getElementById("minimize_K").checked;
  const edgeWeightType = document.getElementById("edge-weight-type").value;
  const type = document.getElementById("type").value;

  if (!algorithm) {
    alert("Please select an algorithm.");
    return;
  }
  if (
    capacity &&
    (isNaN(parseInt(capacity, 10)) || parseInt(capacity, 10) <= 0)
  ) {
    alert("Please enter a valid number for vehicle capacity.");
    return;
  }
  if (!coordinates.trim()) {
    alert("Please add the coordinates.");
    return;
  }

  let customerDemandsArray = customerDemands
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => parseInt(line, 10));

  if (customerDemands && !customerDemandsArray.length) {
    alert("Please add the customer demands.");
    return;
  }

  if (type === "TSP") {
    // Capacity and customer demands are not used for TSP
    capacity = null;
    customerDemandsArray = null;
  } else if (type === "CVRP") {
    const coordinatesArray = coordinates
      .split("\n")
      .filter((line) => line.trim() !== "");
    if (coordinatesArray.length !== customerDemandsArray.length) {
      alert(
        "For CVRP, the number of coordinates and customer demands must match."
      );
      return;
    }
    document.getElementById("capacity").style.display = "block";
    document.getElementById("customer-demands").style.display = "block";
  }

  // Clear solution metrics
  document.getElementById("total-distance").textContent = "...";
  document.getElementById("num-routes").textContent = "...";
  document.getElementById("computation-time").textContent = "...";
  document.getElementById("covering-feasibility").textContent = "...";
  document.getElementById("capacity-feasibility").textContent = "...";
  document.getElementById("route-cost-feasibility").textContent = "...";

  const elementsToDisable = document.querySelectorAll(
    "button, input, select, textarea"
  );
  elementsToDisable.forEach((element) => (element.disabled = true));

  const solveButton = document.getElementById("solve");
  solveButton.textContent = "Solving...";

  document.body.classList.add("no-hover");

  const data = {
    algorithm: algorithm,
    capacity: capacity ? parseInt(capacity, 10) : null,
    coordinates: coordinates
      .split("\n")
      .map((row) => row.split(" ").map(Number)),
    customer_demands: customerDemands ? customerDemandsArray : null,
    L: L ? parseInt(L, 10) : null,
    single: single,
    minimize_K: minimize_K,
    edge_weight_type: edgeWeightType,
    type: type,
  };

  console.log(data);

  fetch("/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((error) => {
          throw new Error(error.error);
        });
      }
      return response.json();
    })
    .then((data) => {
      document.getElementById("total-distance").textContent = data.objective;
      document.getElementById("num-routes").textContent = data.num_routes;
      document.getElementById(
        "computation-time"
      ).textContent = `${data.elapsed_time.toFixed(4)} seconds`;
      document.getElementById("covering-feasibility").textContent = data
        .feasibility[0]
        ? "Feasible"
        : "Infeasible";
      document.getElementById("capacity-feasibility").textContent = data
        .feasibility[1]
        ? "Feasible"
        : "Infeasible";
      document.getElementById("route-cost-feasibility").textContent = data
        .feasibility[2]
        ? "Feasible"
        : "Infeasible";

      console.log(data);

      // Draw the solution visualization
      const routes = data.routes;
      const points = data.points;
      const distanceMatrix = data.distance_matrix;
      const customerDemands = data.customer_demands;
      const capacity = data.capacity;
      drawSolution(routes, points, distanceMatrix, customerDemands, capacity);
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("An error occurred: " + error.message);
    })
    .finally(() => {
      elementsToDisable.forEach((element) => (element.disabled = false));
      solveButton.textContent = "Solve";
      document.body.classList.remove("no-hover");
    });
});

document.getElementById("reset").addEventListener("click", function () {
  document.getElementById("vrp-file").value = "";
  document.getElementById("capacity").value = "";
  document.getElementById("coordinates").value = "";
  document.getElementById("customer-demands").value = "";
  document.getElementById("L").value = "";
  document.getElementById("single").checked = false;
  document.getElementById("minimize_K").checked = false;
  document.getElementById("algorithm").value = "";
  document.getElementById("edge-weight-type").value = "";
  document.getElementById("type").value = "";

  // Clear solution metrics
  document.getElementById("total-distance").textContent = "";
  document.getElementById("num-routes").textContent = "";
  document.getElementById("computation-time").textContent = "";
  document.getElementById("covering-feasibility").textContent = "";
  document.getElementById("capacity-feasibility").textContent = "";
  document.getElementById("route-cost-feasibility").textContent = "";

  // Clear solution visualization
  const canvas = document.getElementById("solution-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Clear route costs table
  const routeCostsTableBody = document
    .getElementById("route-costs-table")
    .getElementsByTagName("tbody")[0];
  routeCostsTableBody.innerHTML = "";
});
