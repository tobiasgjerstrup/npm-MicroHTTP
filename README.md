# MicroHTTP

A small, lightweight, zero-dependency wrapper around Node.js's built-in `http` and `https` modules for making HTTP requests.

## Installation

```bash
npm install @tobiasgjerstrup/microhttp
```

## Usage

```typescript
import microHTTP from '@tobiasgjerstrup/microhttp';

// GET request
const response = await microHTTP.get<{ userId: number; id: number }>(
  'https://jsonplaceholder.typicode.com/todos/1'
);
console.log(response.body);

// POST request
const postResponse = await microHTTP.post('https://api.example.com/data', {
  body: { name: 'John', age: 30 }
});

// GET with Basic Auth
const authResponse = await microHTTP.get('https://api.example.com/protected', {
  basicAuth: {
    username: 'john',
    password: 'secret'
  }
});

// PUT request
const putResponse = await microHTTP.put('https://api.example.com/data/1', {
  body: { name: 'Jane' }
});

// DELETE request
const deleteResponse = await microHTTP.del('https://api.example.com/data/1');
```

## Error Handling

```typescript
import microHTTP, { HTTPError, UrlNotFoundError } from '@tobiasgjerstrup/microhttp';

try {
  const response = await microHTTP.get('https://api.example.com/data');
} catch (error) {
  if (error instanceof HTTPError) {
    console.log('HTTP Error:', error.status, error.body);
  } else if (error instanceof UrlNotFoundError) {
    console.log('URL not found:', error.url);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## API

### `microHTTP.get<T>(url, options?)`
### `microHTTP.post<T>(url, options)`
### `microHTTP.put<T>(url, options)`
### `microHTTP.del<T>(url, options)`

All methods return a `Promise<Response<T>>` where `Response` contains:
- `status: number` - HTTP status code
- `headers: Record<string, string | string[]>` - Response headers
- `body: T` - Parsed response body

## Options

```typescript
interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;  // Will be JSON stringified
  ignoreLocalIssuerCertificate?: boolean; // HTTPS only: sets rejectUnauthorized to false
  basicAuth?: {
    username: string;
    password: string;
  };
}
```

## License

ISC
