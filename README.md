
# MultiAgentPOC

Proof-of-concept Node.js app (TypeScript + Express) for 3-way dialog:
- User chats with two agents in parallel
- Each agent can respond to the user and to the other agent
- Simulates a 3-person conversation
- Browser-based chat UI at `/chat` (GET)
- `/` endpoint redirects to `/chat` for user convenience

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
- `src/index.ts`: Express entry point, serves UI, handles redirects and API
- `src/manager.ts`: Orchestrates dialog between user and agents
- `src/agent.ts`: Simple agent logic (replace with real AI as needed)

## Extending
- Replace `Agent.respond` with real AI logic or API calls
- Add more agents or dialog logic in `AgentManager`
- You can update the `/` endpoint to show a custom message if desired (currently a redirect)
