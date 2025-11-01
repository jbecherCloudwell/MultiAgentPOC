

# MultiAgentPOC

Proof-of-concept Node.js app (TypeScript + Express) for multi-agent dialog:
- User chats with two agents in parallel
- Each agent can respond to the user and to the other agent
- Simulates a 3-person conversation
- **Turn-lock mechanism**: Agents and user take strict turns; agents cannot respond multiple times in a row
- **DialogManager**: Tracks dialog turns and last speaker for robust turn-taking
- **Streaming backend (SSE)**: Agent responses are streamed token-by-token (frontend integration in progress)
- **Extensible agent logic**: Easy to add more agents or swap out agent logic
- `/` endpoint redirects to `/chat` for user convenience
- See `CHANGELOG.md` for version history

## Usage

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the server (dev mode):
   ```sh
   npx nodemon src/index.ts
   ```
3. Open [http://localhost:3000/](http://localhost:3000/) in your browser
   - You will be redirected to `/chat` and see the interactive chat UI
4. (API) Send POST requests to `/chat` with JSON body:
   ```json
   { "user": "Alice", "message": "Hello agents!" }
   ```

## Endpoints

- `GET /` → Redirects to `/chat`
- `GET /chat` → Serves browser chat UI
- `POST /chat` → Accepts `{ agentId, message }` JSON and returns updated dialog. The selected agent will respond next.
- `POST /api/agents` → Create a new agent with `{ name, persona, model }`.
- `GET /api/agents` → List all agents.
- `POST /api/agents/:agentId/reset` → Reset an agent's dialog history.
- `DELETE /api/agents/:agentId` → Delete an agent.
- `POST /api/user-typing` → Set user typing state.
- `GET /api/dialog` → Get current dialog history.
- `POST /api/dialog/reset` → Reset dialog history.

## Project Structure
- `server/src/index.ts`: Express entry point, serves UI, handles redirects and API
- `server/src/dialogManager.ts`: Orchestrates dialog turns, tracks last speaker, and manages selected agent
- `server/src/ollamaAgent.ts`: Agent logic (replaceable with real AI)
- `client/src/MultiAgentChat.tsx`: React chat UI component for agent selection, agent creation, and messaging


## Features
**Dynamic agent creation**: Create agents with custom persona and model via UI or API. The agent creation form supports default instructions (e.g., markdown formatting) via checkboxes.
**Persona modal**: Click any agent's persona preview to open a modal with the full persona. Use the modal to copy or fill the new agent form with the selected persona.
**Markdown rendering**: All agent messages (except user/System) are rendered with markdown formatting in the chat box.
**Clear Chat**: Instantly reset the conversation and start fresh with the "Clear Chat" button.
**Export Chat**: Download the full chat session as a .txt file with the "Export Chat" button.
**Agent selection**: Select which agent should respond next after a user message.
**Turn-lock**: Only one agent responds per turn, strict alternation enforced.
**DialogManager**: Tracks dialog turns, last speaker, and selected agent for robust alternation.
**Streaming backend**: SSE endpoint streams agent responses (frontend streaming in progress).
**Robust dialog sync**: Frontend now replaces temp agent turns with backend responses, preventing flicker and duplicate entries.
**Live participant sync**: Agents can be added or removed from the conversation at any time; backend updates immediately and only selected agents respond.
**Extensible**: Add more agents or swap logic easily.


## Agent Creation & Persona Management

- Use the UI form or `POST /api/agents` to create a new agent with a name and persona.
- The agent creation form includes checkboxes for default instructions (e.g., markdown formatting, honesty, conciseness).
- Click any agent's persona preview to open a modal with the full persona. In the modal, click "Use for New Agent" to fill the agent creation form with the selected persona.
- Select agents to participate in the conversation at any time—even mid-dialog. The backend updates instantly and only selected agents will respond.

## Changelog
See `CHANGELOG.md` for a summary of recent changes and version history.


## Usage

1. Install dependencies in both `server/` and `client/`:
   ```sh
   cd server && npm install
   cd ../client && npm install
   ```
2. Start the server (dev mode):
   ```sh
   cd server
   npx nodemon src/index.ts
   ```
3. Start the React client (dev mode):
   ```sh
   cd ../client
   npm start
   ```
4. Open [http://localhost:3000/](http://localhost:3000/) in your browser
   - You will be redirected to `/chat` and see the interactive chat UI
5. Use the chat UI to:
   - Create agents with custom persona and default instructions
   - Click agent persona previews to view/copy personas
   - Clear or export the chat session
   - Select agents to participate in the conversation
6. (API) Send POST requests to `/api/chat` with JSON body:
   ```json
   { "agentId": "Rambler", "message": "Hello agents!" }
   ```
