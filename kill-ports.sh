#!/bin/bash
# Kill processes using ports 3000 and 8080

echo "🔍 Checking for processes on ports 3000 and 8080..."

# Kill port 3000 (backend)
PORT_3000=$(lsof -ti:3000)
if [ ! -z "$PORT_3000" ]; then
    echo "🛑 Killing process on port 3000 (PID: $PORT_3000)..."
    kill -9 $PORT_3000
    echo "✅ Port 3000 is now free"
else
    echo "✅ Port 3000 is already free"
fi

# Kill port 8080 (frontend - optional)
PORT_8080=$(lsof -ti:8080)
if [ ! -z "$PORT_8080" ]; then
    echo "🛑 Killing process on port 8080 (PID: $PORT_8080)..."
    kill -9 $PORT_8080
    echo "✅ Port 8080 is now free"
else
    echo "✅ Port 8080 is already free"
fi

echo "✨ Done! You can now start your dev servers."









