#!/usr/bin/env node

const { execSync, spawn } = require("child_process");

const colors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    execSync(command, {
      encoding: "utf-8",
      stdio: options.stdio || "pipe",
      ...options,
    });
    return true;
  } catch (error) {
    return false;
  }
}

function isDockerRunning() {
  return exec("docker info", { stdio: "ignore" });
}

function isMailDevRunning() {
  try {
    const output = execSync('docker ps --format "{{.Names}}"', {
      encoding: "utf-8",
    });
    return output && output.includes("finwise-maildev");
  } catch {
    return false;
  }
}

function getDockerComposeCommand() {
  // Try newer 'docker compose' first, fallback to 'docker-compose'
  try {
    execSync("docker compose version", { stdio: "ignore" });
    return "docker compose";
  } catch {
    try {
      execSync("docker-compose version", { stdio: "ignore" });
      return "docker-compose";
    } catch {
      return null;
    }
  }
}

function startMailDev() {
  return new Promise((resolve, reject) => {
    log("Starting MailDev...", "yellow");

    const dockerComposeCmd = getDockerComposeCommand();
    if (!dockerComposeCmd) {
      reject(new Error("docker-compose or docker compose not found"));
      return;
    }

    const started = exec(
      `${dockerComposeCmd} -f docker-compose.maildev.yml up -d`,
      {
        stdio: "inherit",
      }
    );

    if (!started) {
      reject(new Error("Failed to start MailDev"));
      return;
    }

    // Wait for MailDev to be ready
    setTimeout(() => {
      if (isMailDevRunning()) {
        log("✓ MailDev started successfully", "green");
        log("  SMTP: localhost:1025", "green");
        log("  Web UI: http://localhost:1080", "green");
        resolve();
      } else {
        reject(new Error("MailDev container did not start"));
      }
    }, 3000);
  });
}

function cleanup() {
  log("\nShutting down MailDev...", "yellow");
  const dockerComposeCmd = getDockerComposeCommand();
  if (dockerComposeCmd) {
    exec(`${dockerComposeCmd} -f docker-compose.maildev.yml down`, {
      stdio: "ignore",
    });
  }
  process.exit(0);
}

function startDevServer() {
  log("Starting development server...", "green");
  console.log("");

  const nodemon = spawn(
    "npx",
    [
      "nodemon",
      "--watch",
      "src",
      "--exec",
      "ts-node",
      "--project",
      "tsconfig.dev.json",
      "src/server.ts",
    ],
    {
      stdio: "inherit",
      shell: true,
    }
  );

  nodemon.on("close", (code) => {
    cleanup();
  });

  nodemon.on("error", (error) => {
    log(`❌ Failed to start nodemon: ${error.message}`, "red");
    cleanup();
  });
}

// Main execution
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Check Docker
if (!isDockerRunning()) {
  log("❌ Docker is not running. Please start Docker and try again.", "red");
  process.exit(1);
}

// Check if MailDev is running
if (isMailDevRunning()) {
  log("✓ MailDev is already running", "green");
  startDevServer();
} else {
  startMailDev()
    .then(() => {
      startDevServer();
    })
    .catch((error) => {
      log(`❌ ${error.message}`, "red");
      process.exit(1);
    });
}
