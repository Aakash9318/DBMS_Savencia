import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { asAnalyst, createOrder, dashboard, loadReports, openDatabase, orderDetails, orderOptions, RequestError } from './db/database.mjs';

const port = Number(process.env.PORT ?? 3000);
const db = await openDatabase(process.env.ADMAP_DATA_DIR ?? fileURLToPath(new URL('./.data', import.meta.url)));
const reports = await loadReports();
const mimeTypes = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', webp: 'image/webp',
  jpg: 'image/jpeg', png: 'image/png', woff2: 'font/woff2'
};

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw new RequestError('Order payload is too large.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError('Expected a JSON order payload.');
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/dashboard') {
      const period = url.searchParams.get('days') ?? '30';
      if (!['0', '7', '30', '90'].includes(period)) throw new RequestError('Choose a supported date range.');
      return json(response, 200, await dashboard(db, Number(period)));
    }
    if (request.method === 'GET' && path === '/api/order-options') {
      return json(response, 200, await orderOptions(db));
    }
    const orderRoute = path.match(/^\/api\/orders\/([1-9][0-9]{0,9})$/);
    if (request.method === 'GET' && orderRoute && Number(orderRoute[1]) <= 2147483647) {
      return json(response, 200, await orderDetails(db, Number(orderRoute[1])));
    }
    if (request.method === 'POST' && path === '/api/orders') {
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
        throw new RequestError('Use application/json for orders.', 415);
      }
      return json(response, 201, await createOrder(db, await requestBody(request)));
    }
    if (request.method === 'GET' && path === '/api/reports') return json(response, 200, reports);
    if (request.method === 'GET' && path.startsWith('/api/reports/')) {
      const report = reports.find(item => path === `/api/reports/${item.id}`);
      if (!report) throw new RequestError('Report not found.', 404);
      const preview = report.sql.replace(/;\s*$/, '');
      const result = await asAnalyst(db, tx => tx.query(`SELECT * FROM (${preview}) AS report_preview LIMIT 51`));
      return json(response, 200, {
        columns: result.fields.map(field => field.name),
        rows: result.rows.slice(0, 50), truncated: result.rows.length > 50
      });
    }
    if (!['GET', 'HEAD'].includes(request.method)) throw new RequestError('Method not allowed.', 405);
    const filename = path === '/' ? '/index.html' : path;
    const filePattern = /^\/(?:assets\/)?[a-z0-9][a-z0-9.-]*\.(html|css|js|webp|jpg|png|woff2)$/;
    const vendorPattern = /^\/vendor\/(three\.(?:module|core)\.js)$/;
    const asset = filename.match(filePattern);
    const vendor = filename.match(vendorPattern);
    if (!asset && !vendor) throw new RequestError('Page not found.', 404);
    const file = vendor
      ? new URL(`./node_modules/three/build/${vendor[1]}`, import.meta.url)
      : new URL(`./public${filename}`, import.meta.url);
    const content = await readFile(file);
    response.writeHead(200, {
      'Content-Type': vendor ? mimeTypes.js : mimeTypes[asset[1]],
      'Content-Length': content.length,
      'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error instanceof RequestError) return json(response, error.status, { error: error.message });
    if (error.code === 'ENOENT') return json(response, 404, { error: 'Page not found.' });
    console.error(error);
    return json(response, 500, { error: 'Database or server error.' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`ADMAP is running at http://127.0.0.1:${server.address().port}`));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(async () => {
    await db.close();
  }));
}
