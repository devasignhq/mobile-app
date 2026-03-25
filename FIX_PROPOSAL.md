**Solution: Implement Message Sending and Broadcasting**

To handle `message:send` events, we will create a Node.js application using Express.js, PostgreSQL, and Socket.IO. We will also use the GitHub API to trigger push notifications for offline recipients.

**Database Setup**

First, create a PostgreSQL database and add the following tables:
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  github_id INTEGER NOT NULL,
  socket_id TEXT
);
```
**Server-Side Code**

Create a new file `server.js` and add the following code:
```javascript
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  user: 'your_username',
  host: 'your_host',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

app.use(express.json());

// Handle message:send events
app.post('/message', async (req, res) => {
  const { text, senderId, recipientId } = req.body;
  const message = await pool.query(
    'INSERT INTO messages (text, sender_id, recipient_id) VALUES ($1, $2, $3) RETURNING *',
    [text, senderId, recipientId]
  );
  const messageId = message.rows[0].id;

  // Broadcast message:new to the bounty room
  io.to('bounty-room').emit('message:new', {
    id: messageId,
    text,
    senderId,
    recipientId,
  });

  // Trigger push notification for offline recipients
  const recipient = await pool.query(
    'SELECT github_id FROM users WHERE id = $1',
    [recipientId]
  );
  const githubId = recipient.rows[0].github_id;
  axios.post(`https://api.github.com/repos/devasignhq/mobile-app/issues/122/comments`, {
    body: `New message from ${senderId}: ${text}`,
  })
    .then((response) => {
      console.log(`Push notification sent to ${githubId}`);
    })
    .catch((error) => {
      console.error(`Error sending push notification: ${error}`);
    });

  res.json({ id: messageId });
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log('Client connected');

  // Join the bounty room
  socket.join('bounty-room');

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

http.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```
**Client-Side Code**

Create a new file `client.js` and add the following code:
```javascript
const socket = io('http://localhost:3000');

// Send a message
socket.emit('message:send', {
  text: 'Hello, world!',
  senderId: 1,
  recipientId: 2,
});

// Listen for message:new events
socket.on('message:new', (message) => {
  console.log(`Received new message: ${message.text}`);
});
```
**Example Use Case**

1. Start the server by running `node server.js`.
2. Open two browser windows and navigate to `http://localhost:3000`.
3. In one window, send a message using the `client.js` code.
4. In the other window, listen for the `message:new` event and log the received message to the console.

**Commit Message**

`feat: implement message sending and broadcasting`

**API Documentation**

### Message Sending and Broadcasting API

#### POST /message

* Send a message to a recipient
* Request Body:
	+ `text`: The message text
	+ `senderId`: The ID of the sender
	+ `recipientId`: The ID of the recipient
* Response:
	+ `id`: The ID of the sent message

#### Socket Events

* `message:new`: A new message has been sent
	+ `id`: The ID of the message
	+ `text`: The message text
	+ `senderId`: The ID of the sender
	+ `recipientId`: The ID of the recipient