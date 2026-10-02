# Format Studio

A React interface for formatting and previewing JSON, HTML, XML, and Markdown with the `dev-utils` document API.

## Run locally

```sh
npm install
npm run dev
```

The app is preconfigured to use the current dev-utils API endpoint. To use a different deployment, change the URL in connection settings; the UI appends `/documents/process`, and the value is saved in browser storage. Alternatively, set `VITE_DOCUMENT_API_URL` before starting the dev server.

The API accepts documents up to 1 MiB. HTML and Markdown previews use the sanitized `previewHtml` returned by the backend and are displayed in a sandboxed frame.

## Build

```sh
npm run build
```