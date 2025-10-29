import { OllamaAgent } from './ollamaAgent';
import { DialogManager } from './dialogManager';
import express from 'express';
import path from 'path';
import logger from './logger';


const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

// Store agents by ID (in-memory for now)
const agents: Record<string, OllamaAgent> = {
	agent1: new OllamaAgent({ persona: 'You are Agent 1.' }),
	agent2: new OllamaAgent({ persona: 'You are Agent 2.' })
};

const dialogManager = new DialogManager(['agent1', 'agent2']);
let agentLoopActive = false;
let lastSpeaker: string | null = null;

// Multi-agent support
// Streaming agent response via SSE
app.get('/api/agent-stream/:agentId', async (req, res) => {
	const { agentId } = req.params;
	if (!agentId || !agents[agentId]) {
		res.status(400).json({ error: 'Invalid agentId' });
		return;
	}
	// Set SSE headers
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders?.();

	// Get dialog history (last 24 turns)
	const dialogSlice = dialogManager.getDialog().slice(-24);
	try {
		const stream = await agents[agentId].getCompletionStream(dialogSlice);
		const reader = stream.getReader();
		let done = false;
		while (!done) {
			const { value, done: streamDone } = await reader.read();
			if (streamDone) break;
			// Send each token as SSE event
			res.write(`data: ${JSON.stringify({ token: value })}\n\n`);
		}
		res.write('data: [DONE]\n\n');
		res.end();
	} catch (err) {
		res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : String(err) })}\n\n`);
		res.end();
	}
});

// Log incoming chat requests
app.use('/api/chat', (req, res, next) => {
	logger.info('POST /api/chat', { body: req.body });
	next();
});

// Log agent reset requests
app.use('/api/agents/:agentId/reset', (req, res, next) => {
	logger.info(`POST /api/agents/${req.params.agentId}/reset`);
	next();
});

// Express error-handling middleware: logs all unhandled errors and returns a generic 500 response
// Type annotations added for clarity and to resolve TypeScript lint errors
app.use((err: any, req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
	logger.error('Unhandled error', { error: err });
	res.status(500).json({ error: 'Internal server error' });
});

// List available Ollama models
app.get('/api/models', async (req, res) => {
	try {
		const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
		const response = await fetch(`${ollamaEndpoint}/api/tags`);
		if (!response.ok) {
			return res.status(500).json({ error: 'Failed to fetch models from Ollama.' });
		}
		const data = await response.json() as { models?: { name: string }[] };
		const models = data.models?.map((m) => m.name) || [];
		res.json({ models });
	} catch (err) {
		res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
	}
});

// List available agents and their status
app.get('/api/agents', (req, res) => {
	const agentList = Object.entries(agents).map(([id, agent]) => ({
		id,
		model: (agent as any).model,
		persona: (agent as any).persona,
		messageCount: (agent as any).messages.length
	}));
	res.json({ agents: agentList });
});

// Reset an agent's dialog history
app.post('/api/agents/:agentId/reset', (req, res) => {
	const { agentId } = req.params;
	if (!agentId || !agents[agentId]) {
		return res.status(400).json({ error: 'Invalid or missing agentId.' });
	}
	agents[agentId].resetMessages();
	res.json({ success: true });
});

// API endpoint for chat with a specific agent
app.post('/api/chat', async (req, res) => {
	console.log('Request body:', req.body);
	try {
		const { message } = req.body;
		if (!message || typeof message !== 'string') {
			logger.error('Invalid message received', { body: req.body });
			return res.status(400).json({ error: 'Message is required.' });
		}
		logger.info('User message received', { message });
	dialogManager.addTurn('user', message);
	dialogManager.setLastSpeaker('user');
		// Interrupt and restart agent loop from latest user message
		agentLoopActive = true;
		res.json({ dialog: dialogManager.getDialog().slice(-24) });
	} catch (err) {
		logger.error('Error in /api/chat', { error: err });
		res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
	}
	
	// Background agent dialog loop
	let agentInterval = setInterval(async () => {
		if (!agentLoopActive) return;
		const dialog = dialogManager.getDialog();
		if (dialog.length === 0) return;
		const currentLastSpeaker = dialogManager.getLastSpeaker();
		// Prevent consecutive responses by the same agent
		const lastDialogTurn = dialog.length > 0 ? dialog[dialog.length - 1].speaker : null;
		// Only allow agents to respond if the last speaker is not itself
		if ((currentLastSpeaker === 'user' || currentLastSpeaker === 'agent2') && lastDialogTurn !== 'agent1') {
			logger.info('Agent agent1 responding', { dialog: dialog.slice(-6) });
			try {
				const response1 = await agents.agent1.getCompletion(dialog);
				logger.info('Agent agent1 response', { response: response1 });
				dialogManager.addTurn('agent1', response1);
				dialogManager.setLastSpeaker('agent1');
			} catch (agentErr) {
				logger.error('Error from agent1', { error: agentErr });
				dialogManager.addTurn('agent1', `Error: ${agentErr instanceof Error ? agentErr.message : String(agentErr)}`);
				dialogManager.setLastSpeaker('agent1');
			}
			return;
		}
		if (currentLastSpeaker === 'agent1' && lastDialogTurn !== 'agent2') {
			logger.info('Agent agent2 responding', { dialog: dialog.slice(-6) });
			try {
				const response2 = await agents.agent2.getCompletion(dialog);
				logger.info('Agent agent2 response', { response: response2 });
				dialogManager.addTurn('agent2', response2);
				dialogManager.setLastSpeaker('agent2');
			} catch (agentErr) {
				logger.error('Error from agent2', { error: agentErr });
				dialogManager.addTurn('agent2', `Error: ${agentErr instanceof Error ? agentErr.message : String(agentErr)}`);
				dialogManager.setLastSpeaker('agent2');
			}
			return;
		}
	}, 1000);
	});

// Redirect root to /chat for user convenience
app.get('/', (req, res) => {
	res.redirect('/chat');
});


// Serve React build at /chat and static assets only in production
if (process.env.NODE_ENV === 'production') {
	const reactBuildPath = path.join(__dirname, '../../client/build');
	app.use('/chat', express.static(reactBuildPath));
	app.get('/chat', (req, res) => {
		res.sendFile(path.join(reactBuildPath, 'index.html'));
	});
}

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});

// Return current dialog for real-time UI polling
app.get('/api/dialog', (req, res) => {
	res.json({ dialog: dialogManager.getDialog().slice(-24) }); // Return last 24 turns for more context
});
