const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

let backendProcess;
let mainWindow;

const expressAppUrl = 'http://localhost:3000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const checkServerRunning = (callback) => {
    const maxRetries = 30; 
    let retries = 0;

    const attemptConnection = () => {
      http.get(expressAppUrl, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) { 
          console.log('Express server is up and responding.');
          callback(true);
        } else {
          console.log(`Express server responded with status: ${res.statusCode}. Retrying...`);
          retry();
        }
      }).on('error', (err) => {
        console.log(`Connection attempt to Express server failed: ${err.message}. Retrying...`);
        retry();
      });
    };

    const retry = () => {
      retries++;
      if (retries < maxRetries) {
        setTimeout(attemptConnection, 1000); 
      } else {
        console.error('Express server did not start or become responsive in time.');
        callback(false);
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.error("Could not load the application page.");
        }
      }
    };
    attemptConnection();
  };

  checkServerRunning((isRunning) => {
    if (isRunning && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(expressAppUrl);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  console.log('Starting Express backend via "npm run start"...');
  
  backendProcess = spawn('npm', ['run', 'start'], {
    shell: true, 
    stdio: 'inherit', 
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend process:', err);
    app.quit();
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`Backend process exited with code ${code} and signal ${signal}.`);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    console.log('Terminating backend process...');
    if (process.platform === "win32") {
        spawn("taskkill", ["/pid", backendProcess.pid.toString(), '/f', '/t']);
    } else {
        process.kill(-backendProcess.pid, 'SIGINT'); 
    }
  }
});