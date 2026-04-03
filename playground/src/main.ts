import microHTTP, { HTTPError, UrlNotFoundError } from '../../src/request.ts';
import * as http from 'http';

async function main() {
    try {
        const res = await microHTTP.post('http://localhost:3000/api/data', {
            body: { name: 'John Doe', age: 30 },
            headers: { 'Custom-Header': 'CustomValue' },
        });
        console.log('Response:', res);
    } catch (error) {
        if (error instanceof HTTPError) {
            console.log('HTTPError occurred:', error);
        } else if (error instanceof UrlNotFoundError) {
            console.log('UrlNotFoundError occurred:', error);
        } else {
            console.error('An error occurred:', error);
        }
    }
}

const PORT = 3000;

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // Handle different routes
    if (req.url === '/' && req.method === 'GET') {
        res.statusCode = 200;
        res.end(JSON.stringify({ message: 'Welcome to the HTTP Server!' }));
    } else if (req.url === '/api/hello' && req.method === 'GET') {
        res.statusCode = 200;
        res.end(JSON.stringify({ message: 'Hello, World!' }));
    } else if (req.url === '/api/time' && req.method === 'GET') {
        res.statusCode = 200;
        res.end(JSON.stringify({ timestamp: new Date().toISOString() }));
    } else if (req.url === '/api/data' && req.method === 'POST') {
        res.statusCode = 200;
        let body = '';

        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const data = JSON.parse(body);
            console.log('Request headers:', req.headers);
            console.log('Request body:', data);
            res.end(JSON.stringify({ message: 'Data received successfully!' }));
        });
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Route not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}/`);
    main(); // Call the main function to execute the HTTP request
});
