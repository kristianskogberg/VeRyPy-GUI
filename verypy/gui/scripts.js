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
        const index = parseInt(parts[0], 10);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        distanceMatrix.push([index, x, y]);
      } else if (readingDemands) {
        const parts = line.trim().split(/\s+/);
        const index = parseInt(parts[0], 10);
        const demand = parseInt(parts[1], 10);
        customerDemands.push([index, demand]);
      }
    });

    document.getElementById("capacity").value = capacity;
    const coordinatesTextarea = document.getElementById("coordinates");
    const customerDemandsTextarea = document.getElementById("customer-demands");

    let formattedCoordinates = "NODE_COORD_SECTION\n";
    distanceMatrix.forEach((coords) => {
      formattedCoordinates += `${coords[0]} ${coords[1]} ${coords[2]}\n`;
    });

    let formattedCustomerDemands = "DEMAND_SECTION\n";
    customerDemands.forEach((demand) => {
      formattedCustomerDemands += `${demand[0]} ${demand[1]}\n`;
    });

    coordinatesTextarea.value = formattedCoordinates;
    customerDemandsTextarea.value = formattedCustomerDemands;
  };

  reader.readAsText(file);
});

document.getElementById("solve").addEventListener("click", function () {
  const algorithm = document.getElementById("algorithm").value;
  const capacity = parseInt(document.getElementById("capacity").value, null);
  const coordinates = document.getElementById("coordinates").value;
  const customerDemands = document.getElementById("customer-demands").value;
  const L = document.getElementById("L").value;
  const single = document.getElementById("single").checked;
  const minimize_K = document.getElementById("minimize_K").checked;
  const vrpFile = document.getElementById("vrp-file").files[0];

  if (!algorithm) {
    alert("Please select an algorithm.");
    return;
  }
  if (isNaN(capacity) || capacity <= 0) {
    alert("Please enter a valid number for vehicle capacity.");
    return;
  }
  if (!coordinates.trim()) {
    alert("Please add the coordinates.");
    return;
  }
  if (!customerDemands.trim()) {
    alert("Please add the customer demands.");
    return;
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

  const reader = new FileReader();
  reader.onload = function (event) {
    const vrpFileContent = event.target.result.split(",")[1];

    const data = {
      algorithm: algorithm,
      capacity: capacity,
      distance_matrix: coordinates
        .split("\n")
        .map((row) => row.split(" ").map(Number)),
      customer_demands: customerDemands.split("\n").map(Number),
      L: L ? parseInt(L, 10) : null,
      single: single,
      minimize_K: minimize_K,
      vrp_file: vrpFileContent,
    };

    fetch("/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
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
  };

  if (vrpFile) {
    reader.readAsDataURL(vrpFile);
  } else {
    const data = {
      algorithm: algorithm,
      capacity: capacity,
      distance_matrix: coordinates
        .split("\n")
        .map((row) => row.split(" ").map(Number)),
      customer_demands: customerDemands.split("\n").map(Number),
      L: L ? parseInt(L, 10) : null,
      single: single,
      minimize_K: minimize_K,
    };

    fetch("/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
      .then((data) => {
        document.getElementById("total-distance").textContent = data.objective;
        document.getElementById("num-routes").textContent = data.num_routes;
        document.getElementById(
          "computation-time"
        ).textContent = `${data.elapsed_time.toFixed(2)} seconds`;
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
  }
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
