function solveClickHandler() {
  const algorithm = document.getElementById("algorithm").value;
  const capacity = parseInt(document.getElementById("capacity").value, 10);
  if (isNaN(capacity) || capacity <= 0) {
    alert("Please enter a valid number for vehicle capacity.");
    return;
  }
  const locations = document.getElementById("locations").value;

  // Data validation
  if (!algorithm) {
    alert("Please select an algorithm.");
    return;
  }
  if (capacity === null || isNaN(capacity) || capacity <= 0) {
    alert("Please enter a valid vehicle capacity.");
    return;
  }
  if (!locations.trim()) {
    alert("Please add at least one location.");
    return;
  }

  // Parse locations into an array of coordinates
  const locationsArray = locations.split("\n").map((location) => {
    const coords = location.replace(/[()]/g, "").split(",");
    const x = parseFloat(coords[0]);
    const y = parseFloat(coords[1]);
    if (isNaN(x) || isNaN(y)) {
      throw new Error("Invalid location coordinates");
    }
    return { x: x, y: y };
  });

  const data = {
    algorithm: algorithm,
    capacity: capacity,
    locations: locationsArray,
  };

  fetch("/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      return response.text();
    })
    .then((data) => {
      document.getElementById("result").innerText = data;
      alert(data);
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("An error occurred: " + error.message);
    });
}

document.getElementById("solve").addEventListener("click", solveClickHandler);

document.getElementById("add-location").addEventListener("click", function () {
  const xCoord = document.getElementById("x-coord").value;
  const yCoord = document.getElementById("y-coord").value;
  const locations = document.getElementById("locations");
  if (xCoord && yCoord) {
    locations.value += `(${xCoord}, ${yCoord})\n`;
  } else {
    alert("Please enter both X and Y coordinates.");
  }
});

document.getElementById("vrp-file").addEventListener("change", function () {
  const file = this.files[0];
  const reader = new FileReader();
  reader.onload = function (event) {
    const content = event.target.result;
    const lines = content.split("\n");
    let capacity = null;
    let locations = [];
    let readingNodes = false;

    lines.forEach((line) => {
      if (line.startsWith("CAPACITY")) {
        capacity = parseInt(line.split(":")[1].trim());
      } else if (line.startsWith("NODE_COORD_SECTION")) {
        readingNodes = true;
      } else if (
        line.startsWith("DEMAND_SECTION") ||
        line.startsWith("DEPOT_SECTION")
      ) {
        readingNodes = false;
      } else if (readingNodes) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 3) {
          const x = parseFloat(parts[1]);
          const y = parseFloat(parts[2]);
          if (!isNaN(x) && !isNaN(y)) {
            locations.push(`(${x}, ${y})`);
          } else {
            console.warn(`Invalid coordinates found in line: ${line}`);
          }
        }
      }
    });

    if (locations.length === 0) {
      alert("No valid locations found in the file.");
    }

    document.getElementById("capacity").value = capacity;
    document.getElementById("locations").value = locations.join("\n");
  };
  reader.readAsText(file);
});

document.getElementById("reset").addEventListener("click", function () {
  document.getElementById("vrp-file").value = "";
  document.getElementById("capacity").value = "";
  document.getElementById("x-coord").value = "";
  document.getElementById("y-coord").value = "";
  document.getElementById("locations").value = "";
  document.getElementById("algorithm").value = "";
});
