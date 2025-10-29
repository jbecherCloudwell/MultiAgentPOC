

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

- `GET /` &rarr; Redirects to `/chat`
- `GET /chat` &rarr; Serves browser chat UI
- `POST /chat` &rarr; Accepts `{ user, message }` JSON and returns updated dialog


## Project Structure
- `server/src/index.ts`: Express entry point, serves UI, handles redirects and API
- `server/src/dialogManager.ts`: Orchestrates dialog turns and tracks last speaker
- `server/src/ollamaAgent.ts`: Agent logic (replaceable with real AI)
- `client/src/MultiAgentChat.tsx`: React chat UI component for agent selection and messaging
## Features
- Turn-lock: Only one agent responds per turn, strict alternation enforced
- User-agent-agent dialog: User triggers agent1, then agent2 responds to agent1
- DialogManager: Tracks dialog turns and last speaker
- Streaming backend: SSE endpoint streams agent responses (frontend streaming in progress)
- Extensible: Add more agents or swap logic easily
## Changelog
See `CHANGELOG.md` for a summary of recent changes and version history.


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
   { "agentId": "agent1", "message": "Hello agents!" }
   ```
