

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
**Dynamic agent creation**: Create agents with custom persona and model via UI or API
**Agent selection**: Select which agent should respond next after a user message
**Turn-lock**: Only one agent responds per turn, strict alternation enforced
**DialogManager**: Tracks dialog turns, last speaker, and selected agent for robust alternation
**Streaming backend**: SSE endpoint streams agent responses (frontend streaming in progress)
**Robust dialog sync**: Frontend now replaces temp agent turns with backend responses, preventing flicker and duplicate entries
**Extensible**: Add more agents or swap logic easily

## Agent Creation & Selection

Use the UI form or `POST /api/agents` to create a new agent with a name and persona
Select an agent from the dropdown to choose who responds next after your message
The backend uses your selected agent for the next response, then alternates among agents
Dialog sync is robust: temp agent turns are replaced by backend responses, so the UI never flickers or shows duplicate/blank entries

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
5. (API) Send POST requests to `/api/chat` with JSON body:
   ```json
   { "agentId": "Rambler", "message": "Hello agents!" }
   ```
