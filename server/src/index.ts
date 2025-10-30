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
	// agent1: new OllamaAgent({ persona: 'You are designed strictly for testing purposes. You provide responses that are 5 words long.' }),
	// agent2: new OllamaAgent({ persona: 'You are designed strictly for testing purposes. You provide responses that are 5 words long.' })
	agent1: new OllamaAgent({ persona: 'You are designed strictly for testing purposes. You provide responses that are 50 words long.' }),
	agent2: new OllamaAgent({ persona: 'You are designed strictly for testing purposes. You provide responses that are 50 words long.' })
};

const dialogManager = new DialogManager(['agent1', 'agent2']);
let agentLoopActive = false;
let lastSpeaker: string | null = null;
let agentResponseInProgress = false;
// userTyping now managed by dialogManager
// API endpoint to set userTyping flag
app.post('/api/user-typing', (req, res) => {
	logger.info('[api/user-typing] Received request', { body: req.body });
	const { typing } = req.body;
	dialogManager.setUserTyping(Boolean(typing));
	logger.info(`[userTyping] Set to ${dialogManager.getUserTyping()} by /api/user-typing`, { typing });
	// If userTyping is now false (user cleared box), restart agent loop if last speaker is user
	if (!Boolean(typing)) {
		const dialog = dialogManager.getDialog();
		const lastTurn = dialog.length > 0 ? dialog[dialog.length - 1] : null;
		if (lastTurn) {
			agentLoopActive = true;
			logger.info('[userTyping] Restarting agent loop after user cleared text box', { lastUserMessage: lastTurn.message });
		}
	}
	res.json({ success: true, userTyping: dialogManager.getUserTyping() });
});

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
	if (!agentLoopActive || agentResponseInProgress) return;
	if (dialogManager.getUserTyping()) {
		agentLoopActive = false;
		logger.info('[agentLoop] Pausing agent loop due to user typing', { userTyping: dialogManager.getUserTyping() });
		return;
	}
		const dialog = dialogManager.getDialog();
		if (dialog.length === 0) return;
		const currentLastSpeaker = dialogManager.getLastSpeaker();
		const lastDialogTurn = dialog.length > 0 ? dialog[dialog.length - 1].speaker : null;

		if ((currentLastSpeaker === 'user' || currentLastSpeaker === 'agent2') && lastDialogTurn !== 'agent1') {
			agentResponseInProgress = true;
			logger.info(`[agentLoop] agent1 responding (userTyping=${dialogManager.getUserTyping()})`, { dialog: dialog.slice(-6) });
			try {
				// Check before generating response
				if (dialogManager.getUserTyping()) {
					logger.info('[agentLoop] Agent agent1 skipped due to user typing', { userTyping: dialogManager.getUserTyping() });
					agentResponseInProgress = false;
					return;
				}
				// Use AbortController to interrupt agent response if userTyping becomes true
				const abortController = new AbortController();
				// Poll userTyping every 100ms during await
				let response1: string | undefined;
				let done = false;
				const poll = setInterval(() => {
					if (dialogManager.getUserTyping() && !done) {
						abortController.abort();
						logger.info('[agentLoop] Agent agent1 response aborted due to user typing', { userTyping: dialogManager.getUserTyping() });
					}
				}, 100);
				try {
					response1 = await agents.agent1.getCompletion(dialog, abortController.signal);
					done = true;
				} catch (err) {
					if (abortController.signal.aborted) {
						agentResponseInProgress = false;
						clearInterval(poll);
						return;
					}
					throw err;
				}
				clearInterval(poll);
				// Check again after response in case user started typing during await
				if (dialogManager.getUserTyping()) {
					logger.info('[agentLoop] Agent agent1 response discarded due to user typing', { userTyping: dialogManager.getUserTyping() });
					agentResponseInProgress = false;
					return;
				}
				logger.info('[agentLoop] Agent agent1 response accepted', { response: response1 });
				dialogManager.addTurn('agent1', response1);
				dialogManager.setLastSpeaker('agent1');
			} catch (agentErr) {
				logger.error('[agentLoop] Error from agent1', { error: agentErr });
				dialogManager.addTurn('agent1', `Error: ${agentErr instanceof Error ? agentErr.message : String(agentErr)}`);
				dialogManager.setLastSpeaker('agent1');
			}
			agentResponseInProgress = false;
			return;
		}
		if (currentLastSpeaker === 'agent1' && lastDialogTurn !== 'agent2') {
			agentResponseInProgress = true;
			logger.info(`[agentLoop] agent2 responding (userTyping=${dialogManager.getUserTyping()})`, { dialog: dialog.slice(-6) });
			try {
				// Check before generating response
				if (dialogManager.getUserTyping()) {
					logger.info('[agentLoop] Agent agent2 skipped due to user typing', { userTyping: dialogManager.getUserTyping() });
					agentResponseInProgress = false;
					return;
				}
				// Use AbortController to interrupt agent response if userTyping becomes true
				const abortController = new AbortController();
				let response2: string | undefined;
				let done = false;
				const poll = setInterval(() => {
					if (dialogManager.getUserTyping() && !done) {
						abortController.abort();
						logger.info('[agentLoop] Agent agent2 response aborted due to user typing', { userTyping: dialogManager.getUserTyping() });
					}
				}, 100);
				try {
					response2 = await agents.agent2.getCompletion(dialog, abortController.signal);
					done = true;
				} catch (err) {
					if (abortController.signal.aborted) {
						agentResponseInProgress = false;
						clearInterval(poll);
						return;
					}
					throw err;
				}
				clearInterval(poll);
				// Check again after response in case user started typing during await
				if (dialogManager.getUserTyping()) {
					logger.info('[agentLoop] Agent agent2 response discarded due to user typing', { userTyping: dialogManager.getUserTyping() });
					agentResponseInProgress = false;
					return;
				}
				logger.info('[agentLoop] Agent agent2 response accepted', { response: response2 });
				dialogManager.addTurn('agent2', response2);
				dialogManager.setLastSpeaker('agent2');
			} catch (agentErr) {
				logger.error('[agentLoop] Error from agent2', { error: agentErr });
				dialogManager.addTurn('agent2', `Error: ${agentErr instanceof Error ? agentErr.message : String(agentErr)}`);
				dialogManager.setLastSpeaker('agent2');
			}
			agentResponseInProgress = false;
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
