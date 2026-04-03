import microHTTP, { HTTPError, UrlNotFoundError } from './request.ts';

try {
    const res = await microHTTP.get<{ userId: number; id: number; title: string; completed: boolean }>(
        'https://jsonplaceholder.typicode.com/todos/1',
    );
    console.log('Response:', res.body);
} catch (error) {
    if (error instanceof HTTPError) {
        console.log('HTTPError occurred:', error);
    } else if (error instanceof UrlNotFoundError) {
        console.log('UrlNotFoundError occurred:', error);
    } else {
        console.error('An error occurred:', error);
    }
}
