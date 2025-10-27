// Multi-agent support
import { OllamaAgent } from './ollamaAgent';
import express from 'express';
import path from 'path';
import logger from './logger';
import { AgentManager } from './manager';

import { Request, Response, NextFunction } from 'express';


const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

const manager = new AgentManager();

// Store agents by ID (in-memory for now)
const agents: Record<string, OllamaAgent> = {
	agent1: new OllamaAgent({ persona: 'You are Agent 1.' }),
	agent2: new OllamaAgent({ persona: 'You are Agent 2.' })
};

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
	try {
		const { agentId, message, model, persona } = req.body;
		if (!agentId || !agents[agentId]) {
			return res.status(400).json({ error: 'Invalid or missing agentId.' });
		}
		if (!message || typeof message !== 'string') {
			return res.status(400).json({ error: 'Message is required.' });
		}
		const agent = agents[agentId];
		if (model) agent.setModel(model);
		if (persona) agent.setPersona(persona);
		agent.addUserMessage(message);
		const response = await agent.getCompletion();
		agent.addAssistantMessage(response);
		res.json({ response });
	} catch (err) {
		res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
	}
});

// Redirect root to /chat for user convenience
app.get('/', (req, res) => {
	res.redirect('/chat');
});

// Serve React build at /chat and static assets
const reactBuildPath = path.join(__dirname, '../../client/build');
app.use('/chat', express.static(reactBuildPath));
app.get('/chat', (req, res) => {
	res.sendFile(path.join(reactBuildPath, 'index.html'));
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
