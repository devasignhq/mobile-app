**Socket.io WebSocket Server with JWT Auth Solution**

### Step 1: Install Required Packages

First, install the required packages using npm or yarn:
```bash
npm install socket.io express jsonwebtoken cors
```

### Step 2: Initialize Socket.io Server

Create a new file `socket.js` and initialize the Socket.io server:
```javascript
// socket.js
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Import JWT secret key
const jwtSecret = 'your-jwt-secret-key';

// Import JWT verification function
const verifyJWT = (token) => {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    return null;
  }
};

// Auth middleware
const authenticate = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Unauthorized'));
  }

  const user = verifyJWT(token);
  if (!user) {
    return next(new Error('Invalid token'));
  }

  socket.userId = user.id;
  next();
};

// Apply auth middleware
io.use(authenticate);

// Handle connection
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);

  // Join user to active bounty rooms
  socket.join(`bounty-${socket.userId}`);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});

// Start server
const port = 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

### Step 3: Integrate with Existing HTTP Server

If you already have an HTTP server, you can integrate the Socket.io server with it:
```javascript
// server.js
const express = require('express');
const app = express();
const httpServer = require('http').createServer(app);
const io = require('./socket');

// Initialize Socket.io server
io.initialize(httpServer);

// Start server
const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

### Step 4: Client-Side Implementation

On the client-side, you need to establish a connection to the Socket.io server and pass the JWT token:
```javascript
// client.js
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token',
  },
});

// Handle connection
socket.on('connect', () => {
  console.log('Connected to server');
});

// Handle disconnection
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

**Example Use Case:**

1. User logs in to the application and receives a JWT token.
2. The client-side establishes a connection to the Socket.io server, passing the JWT token.
3. The server verifies the JWT token and extracts the user ID.
4. The user is joined to the active bounty rooms.
5. The user can now receive real-time updates and communicate with other users in the same bounty rooms.

**Code Fix:**

To fix the issue, you need to initialize the Socket.io server with CORS configuration and implement the auth middleware to validate JWT tokens. The above code provides a complete solution to set up a Socket.io WebSocket server with JWT auth.

**Commit Message:**
```markdown
feat: Initialize Socket.io server with CORS config and JWT auth

* Install required packages
* Initialize Socket.io server with CORS config
* Implement auth middleware to validate JWT tokens
* Join users to active bounty rooms
```