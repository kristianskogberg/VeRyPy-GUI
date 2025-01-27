document.addEventListener("DOMContentLoaded", function () {
  fetch("/algorithms")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((algorithms) => {
      const algorithmSelect = document.getElementById("algorithm");
      algorithms.forEach((algorithm) => {
        const option = document.createElement("option");
        option.value = algorithm.value;
        option.textContent = algorithm.description;
        algorithmSelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Error loading algorithms:", error);
    });
});

document.getElementById("vrp-file").addEventListener("change", function () {
  const file = this.files[0];
  const reader = new FileReader();

  reader.onload = function (event) {
    const content = event.target.result;
    const lines = content.split("\n");

    let capacity = null;
    let readingNodes = false;
    let readingDemands = false;
    const distanceMatrix = [];
    const customerDemands = [];

    lines.forEach((line) => {
      if (line.startsWith("CAPACITY")) {
        capacity = parseInt(line.split(":")[1].trim(), 10);
      } else if (line.startsWith("NODE_COORD_SECTION")) {
        readingNodes = true;
      } else if (line.startsWith("DEMAND_SECTION")) {
        readingNodes = false;
        readingDemands = true;
      } else if (line.startsWith("DEPOT_SECTION")) {
        readingDemands = false;
      } else if (readingNodes) {
        const parts = line.trim().split(/\s+/);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        distanceMatrix.push([x, y]);
      } else if (readingDemands) {
        const parts = line.trim().split(/\s+/);
        const demand = parseInt(parts[1], 10);
        customerDemands.push(demand);
      }
    });

    document.getElementById("capacity").value = capacity;
    const coordinatesTextarea = document.getElementById("coordinates");
    const customerDemandsTextarea = document.getElementById("customer-demands");

    let formattedCoordinates = distanceMatrix
      .map((coords) => `${coords[0]} ${coords[1]}`)
      .join("\n");
    let formattedCustomerDemands = customerDemands.join("\n");

    coordinatesTextarea.value = formattedCoordinates;
    customerDemandsTextarea.value = formattedCustomerDemands;
  };

  reader.readAsText(file);
});

function calculateRouteCost(route, distanceMatrix) {
  let cost = 0;
  for (let i = 0; i < route.length - 1; i++) {
    cost += distanceMatrix[route[i]][route[i + 1]];
  }
  return cost;
}

function calculateUtilizationRate(route, customerDemands, capacity) {
  let totalDemand = 0;
  for (let i = 1; i < route.length - 1; i++) {
    // Skip the depot at the start and end
    totalDemand += customerDemands[route[i]];
  }
  return (totalDemand / capacity) * 100; // Return as percentage
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
    cell3.textContent = `${utilizationRate.toFixed(2)} %`;
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

document.getElementById("solve").addEventListener("click", function () {
  const algorithm = document.getElementById("algorithm").value;
  const capacity = document.getElementById("capacity").value;
  const coordinates = document.getElementById("coordinates").value;
  const customerDemands = document.getElementById("customer-demands").value;
  const L = document.getElementById("L").value;
  const single = document.getElementById("single").checked;
  const minimize_K = document.getElementById("minimize_K").checked;

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

  const customerDemandsArray = customerDemands
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(Number);

  if (customerDemands && !customerDemandsArray.length) {
    alert("Please add the customer demands.");
    return;
  }

  // Clear solution metrics
  document.getElementById("total-distance").textContent = "";
  document.getElementById("num-routes").textContent = "";
  document.getElementById("computation-time").textContent = "";
  document.getElementById("covering-feasibility").textContent = "";
  document.getElementById("capacity-feasibility").textContent = "";
  document.getElementById("route-cost-feasibility").textContent = "";

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
    distance_matrix: coordinates
      .split("\n")
      .map((row, index) => [index + 1, ...row.split(" ").map(Number)]),
    customer_demands: customerDemands
      ? customerDemandsArray.map((demand, index) => [index + 1, demand])
      : null,
    L: L ? parseInt(L, 10) : null,
    single: single,
    minimize_K: minimize_K,
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

      // Draw the solution visualization
      const routes = data.routes;
      const points = data.points;
      const distanceMatrix = data.distance_matrix;
      const customerDemands = data.customer_demands;
      const capacity = data.capacity;
      drawSolution(routes, points, distanceMatrix, customerDemands, capacity);

      alert("Solution received. Check the result area.");
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
});
