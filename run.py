"""
run.py — One-click launcher for Argus.
Starts the FastAPI backend and automatically opens the frontend in your default browser.
"""
import os
import sys
import threading
import time
import webbrowser
import uvicorn

# Ensure the project root directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.server import app  # noqa: E402

def launch_browser():
    try:
        # Give Uvicorn a moment to bind to the port
        time.sleep(1.5)
        
        # Construct the absolute file URI for the frontend index.html
        root_dir = os.path.dirname(os.path.abspath(__file__))
        html_path = os.path.join(root_dir, "index.html")
        file_uri = f"file://{html_path}"
        
        print("\n" + "═" * 55)
        print(" 🌐 Opening Argus Frontend:")
        print(f"    {file_uri}")
        print("═" * 55 + "\n")

        # Opens the HTML file in the user's default web browser natively
        webbrowser.open(file_uri)
    except Exception as e:
        print(f"Failed to open browser automatically: {e}")

if __name__ == "__main__":
    print("🚀 Starting Argus API Server in the background...")

    # Start the browser-opener thread
    thread = threading.Thread(target=launch_browser, daemon=True)
    thread.start()

    # Start the FastAPI server (this blocks the main thread)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
