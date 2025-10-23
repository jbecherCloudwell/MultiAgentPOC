
import express from 'express';
import { AgentManager } from './manager';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const manager = new AgentManager();

// Redirect root to /chat for user convenience
app.get('/', (req, res) => {
  res.redirect('/chat');
});

// Serve a simple chat UI at GET /chat
app.get('/chat', (req, res) => {
  res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MultiAgentPOC Chat</title>
      <style>
        body { font-family: sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 500px; margin: 40px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 24px; }
        h2 { text-align: center; }
        #dialog { min-height: 120px; margin-bottom: 16px; background: #f9f9f9; border-radius: 4px; padding: 12px; font-size: 1rem; }
        .turn { margin-bottom: 8px; }
        .user { color: #1976d2; }
        .agent1 { color: #388e3c; }
        .agent2 { color: #d32f2f; }
        form { display: flex; gap: 8px; }
        input[type=text] { flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
        button { padding: 8px 16px; border: none; border-radius: 4px; background: #1976d2; color: #fff; cursor: pointer; }
        button:disabled { background: #aaa; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>MultiAgentPOC Chat</h2>
        <div id="dialog"></div>
        <form id="chatForm">
          <input type="text" id="user" placeholder="Your name" required style="max-width:120px">
          <input type="text" id="message" placeholder="Type your message..." required autocomplete="off">
          <button type="submit">Send</button>
        </form>
      </div>
      <script>
        const dialogDiv = document.getElementById('dialog');
        const form = document.getElementById('chatForm');
        const userInput = document.getElementById('user');
        const messageInput = document.getElementById('message');
        let dialog = [];
        function renderDialog() {
          dialogDiv.innerHTML = dialog.map(function(turn) {
            var cls = turn.speaker;
            var who = turn.speaker === 'user' ? turn.user : turn.speaker;
            return '<div class="turn ' + cls + '\"><b>' + who + ':</b> ' + turn.message + '</div>';
          }).join('');
        }
        form.onsubmit = async function(e) {
          e.preventDefault();
          const user = userInput.value.trim();
          const message = messageInput.value.trim();
          if (!user || !message) return;
          form.querySelector('button').disabled = true;
          try {
            const res = await fetch('/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user, message })
            });
            dialog = await res.json();
            dialog = dialog.map(function(turn) { return turn.speaker === 'user' ? Object.assign({}, turn, { user: user }) : turn; });
            renderDialog();
            messageInput.value = '';
            messageInput.focus();
          } catch (err) {
            alert('Error: ' + err);
          }
          form.querySelector('button').disabled = false;
        };
      </script>
    </body>
    </html>`);
});

// POST /chat { user: string, message: string }
app.post('/chat', async (req, res) => {
  const { user, message } = req.body;
  if (!user || !message) {
    return res.status(400).json({ error: 'Missing user or message' });
  }
  const dialog = await manager.handleUserMessage(user, message);
  res.json(dialog);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
