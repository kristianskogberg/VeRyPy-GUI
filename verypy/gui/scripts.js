document.addEventListener("DOMContentLoaded", function () {
  fetch("algorithms.json")
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
        option.textContent = algorithm.name;
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
      line = line.trim();
      if (line.startsWith("CAPACITY")) {
        capacity = parseInt(line.split(":")[1].trim(), 10);
      } else if (line.startsWith("NODE_COORD_SECTION")) {
        readingNodes = true;
        readingDemands = false;
      } else if (line.startsWith("DEMAND_SECTION")) {
        readingNodes = false;
        readingDemands = true;
      } else if (line.startsWith("DEPOT_SECTION") || line.startsWith("EOF")) {
        readingNodes = false;
        readingDemands = false;
      } else if (readingNodes) {
        const parts = line.split(/\s+/);
        const index = parseInt(parts[0], 10);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        distanceMatrix.push([index, x, y]);
      } else if (readingDemands) {
        const parts = line.split(/\s+/);
        const index = parseInt(parts[0], 10);
        const demand = parseInt(parts[1], 10);
        customerDemands.push([index, demand]);
      }
    });

    // Update the UI with the parsed data
    document.getElementById("capacity").value = capacity;
    const coordinatesTextarea = document.getElementById("coordinates");
    const customerDemandsTextarea = document.getElementById("customer-demands");

    // Format the distance matrix and demands similar to the .vrp file
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

    console.log("Distance Matrix:", distanceMatrix);
    console.log("Customer Demands:", customerDemands);
    console.log("Capacity Constraint:", capacity);
  };

  reader.readAsText(file);
});

document.getElementById("solve").addEventListener("click", function () {
  const algorithm = document.getElementById("algorithm").value;
  const capacity = parseInt(document.getElementById("capacity").value, 10);
  const coordinates = document.getElementById("coordinates").value;
  const customerDemands = document.getElementById("customer-demands").value;
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

  // Check if the number of rows in coordinates and customer demands match
  const coordinatesRows = coordinates.trim().split("\n").length;
  const customerDemandsRows = customerDemands.trim().split("\n").length;
  if (coordinatesRows !== customerDemandsRows) {
    alert("The number of rows in coordinates and customer demands must match.");
    return;
  }

  // Disable all buttons and input fields
  const elementsToDisable = document.querySelectorAll(
    "button, input, select, textarea"
  );
  elementsToDisable.forEach((element) => (element.disabled = true));

  // Change the text of the solve button to "solving..."
  const solveButton = document.getElementById("solve");
  solveButton.textContent = "Solving...";

  // Disable hover effects
  document.body.classList.add("no-hover");

  const reader = new FileReader();
  reader.onload = function (event) {
    const vrpFileContent = event.target.result.split(",")[1]; // Get base64 content

    const data = {
      algorithm: algorithm,
      capacity: capacity,
      distance_matrix: coordinates
        .split("\n")
        .map((row) => row.split(" ").map(Number)),
      customer_demands: customerDemands.split("\n").map(Number),
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
        alert("Solution received. Check the result area.");
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("An error occurred: " + error.message);
      })
      .finally(() => {
        // Enable all buttons and input fields
        elementsToDisable.forEach((element) => (element.disabled = false));
        // Restore the text of the solve button
        solveButton.textContent = "Solve";
        // Enable hover effects
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
        alert("Solution received. Check the result area.");
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("An error occurred: " + error.message);
      })
      .finally(() => {
        // Enable all buttons and input fields
        elementsToDisable.forEach((element) => (element.disabled = false));
        // Restore the text of the solve button
        solveButton.textContent = "Solve";
        // Enable hover effects
        document.body.classList.remove("no-hover");
      });
  }
});

document.getElementById("reset").addEventListener("click", function () {
  document.getElementById("vrp-file").value = "";
  document.getElementById("capacity").value = "";
  document.getElementById("coordinates").value = "";
  document.getElementById("customer-demands").value = "";
  document.getElementById("algorithm").value = "";
});
