import { type RequestHandler } from '@qwikdev/city';

export const onGet: RequestHandler = async ({ html }) => {
  html(
    200,
    ` 
      <html>
        <body>
          <h1>HTML response</h1>
        </body>
      </html>`
  );
};
