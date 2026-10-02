import React, { useRef, useState } from 'react';
import {
  Braces,
  Check,
  ChevronDown,
  CircleAlert,
  Clipboard,
  Code2,
  Download,
  FileCode2,
  FileJson,
  FileText,
  FileUp,
  LoaderCircle,
  PanelTop,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

const API_PATH = '/documents/process';
const MAX_BYTES = 1_048_576;
const FORMATS = [
  { id: 'json', label: 'JSON', extension: 'json', icon: Braces },
  { id: 'html', label: 'HTML', extension: 'html', icon: Code2 },
  { id: 'xml', label: 'XML', extension: 'xml', icon: FileCode2 },
  { id: 'markdown', label: 'Markdown', extension: 'md', icon: FileText },
];
const CONTENT_TYPES = {
  json: 'application/json',
  html: 'text/html',
  xml: 'application/xml',
  markdown: 'text/markdown',
};
const DEFAULT_API_URL = import.meta.env.VITE_DOCUMENT_API_URL ?? 'https://fictional-giggle-594p4jw4q6xh4q9j-8000.app.github.dev';

function getInitialApiUrl() {
  try {
    return localStorage.getItem('format-studio-api-url') || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

function getEndpoint(url) {
  const normalized = url.trim().replace(/\/+$/, '');
  return normalized.endsWith(API_PATH) ? normalized : `${normalized}${API_PATH}`;
}

function getPreviewDocument(markup) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;color:#26332d;background:#fff;font:15px/1.65 Georgia,serif;overflow-wrap:anywhere}
    h1,h2,h3,h4,h5,h6{font-family:Arial,sans-serif;line-height:1.2;margin:1.4em 0 .55em}h1{margin-top:0}
    p,ul,ol,blockquote,pre,table{margin:0 0 1em}a{color:#176a4b}blockquote{border-left:3px solid #c9d6cc;padding-left:16px;color:#52635a}
    pre,code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#f2f5f1}pre{padding:14px;white-space:pre-wrap;border-radius:4px}
    code{padding:2px 4px;border-radius:3px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dce3dd;padding:8px 10px;text-align:left}
    img{max-width:100%;height:auto}hr{border:0;border-top:1px solid #dce3dd;margin:24px 0}
  </style></head><body>${markup}</body></html>`;
}

function App() {
  const [format, setFormat] = useState('json');
  const [fileName, setFileName] = useState('untitled.json');
  const [content, setContent] = useState('');
  const [result, setResult] = useState(null);
  const [outputMode, setOutputMode] = useState('source');
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
  const [endpointDraft, setEndpointDraft] = useState(getInitialApiUrl);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);

  const byteCount = new TextEncoder().encode(content).length;
  const activeFormat = FORMATS.find((item) => item.id === format);

  function updateContent(value) {
    setContent(value);
    setResult(null);
    setError('');
    setNotice('');
  }

  function selectFormat(nextFormat) {
    setFormat(nextFormat);
    setFileName((current) => {
      const baseName = current.replace(/\.[^.]+$/, '') || 'untitled';
      const extension = FORMATS.find((item) => item.id === nextFormat).extension;
      return `${baseName}.${extension}`;
    });
    setResult(null);
    setError('');
    setOutputMode(nextFormat === 'html' || nextFormat === 'markdown' ? 'preview' : 'source');
  }

  async function processDocument() {
    setError('');
    setNotice('');
    if (!content.trim()) {
      setError('Add some content before formatting.');
      return;
    }
    if (!apiUrl.trim()) {
      setError('Set your dev-utils API URL in connection settings first.');
      setSettingsOpen(true);
      return;
    }
    if (byteCount > MAX_BYTES) {
      setError('This document is over the 1 MiB limit.');
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(getEndpoint(apiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          content,
          contentType: CONTENT_TYPES[format],
        }),
      });
      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = {};
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('The API tunnel denied access. Authenticate with GitHub or make the forwarded API port accessible to this app.');
        }
        throw new Error(payload.error || `Request failed (${response.status}).`);
      }
      if (!responseText) throw new Error('The API returned an empty response.');
      setResult(payload);
      setOutputMode(format === 'html' || format === 'markdown' ? 'preview' : 'source');
      setNotice('Document processed');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reach the dev-utils API.');
    } finally {
      setBusy(false);
    }
  }

  async function copyOutput() {
    if (!result) return;
    const value = outputMode === 'preview' ? result.previewHtml : result.formattedContent;
    try {
      await navigator.clipboard.writeText(value);
      setNotice(outputMode === 'preview' ? 'Preview markup copied' : 'Formatted source copied');
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  }

  function downloadOutput() {
    if (!result) return;
    const blob = new Blob([result.formattedContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = result.fileName || fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice('File downloaded');
  }

  function saveEndpoint() {
    const nextUrl = endpointDraft.trim();
    setApiUrl(nextUrl);
    try {
      if (nextUrl) localStorage.setItem('format-studio-api-url', nextUrl);
      else localStorage.removeItem('format-studio-api-url');
    } catch {
      setError('Could not save the API URL in this browser.');
    }
    setSettingsOpen(false);
    setNotice(nextUrl ? 'API endpoint saved' : 'API endpoint cleared');
  }

  async function loadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const matchingFormat = FORMATS.find((item) => item.extension === extension || (item.id === 'markdown' && extension === 'markdown'));
    if (!matchingFormat) {
      setError('Choose a JSON, HTML, XML, or Markdown file.');
      event.target.value = '';
      return;
    }
    setFileName(file.name);
    setFormat(matchingFormat.id);
    setContent(await file.text());
    setResult(null);
    setError('');
    setOutputMode(matchingFormat.id === 'html' || matchingFormat.id === 'markdown' ? 'preview' : 'source');
    event.target.value = '';
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Format Studio home">
          <span className="brand-mark"><Braces size={20} strokeWidth={2.2} /></span>
          <span>format<span className="brand-light">studio</span></span>
        </a>
        <div className="topbar-right">
          <span className={`connection-status ${apiUrl.trim() ? 'is-connected' : ''}`}>
            <span className="status-dot" />
            {apiUrl.trim() ? 'API configured' : 'API not configured'}
          </span>
          <button className="icon-button top-settings" type="button" aria-label="Connection settings" title="Connection settings" onClick={() => { setEndpointDraft(apiUrl); setSettingsOpen((open) => !open); }}>
            <Settings2 size={17} />
          </button>
        </div>
        {settingsOpen && (
          <section className="settings-popover" aria-label="Connection settings">
            <div className="popover-heading">
              <div><span className="eyebrow">CONNECTION</span><h2>API endpoint</h2></div>
              <button className="icon-button close-settings" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={17} /></button>
            </div>
            <label className="field-label" htmlFor="api-url">Base URL or full endpoint</label>
            <input id="api-url" className="endpoint-input" type="url" placeholder="https://your-api.execute-api.region.amazonaws.com/Prod" value={endpointDraft} onChange={(event) => setEndpointDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEndpoint(); }} />
            <p className="field-hint">The app sends requests to <code>/documents/process</code>. Saved only in this browser.</p>
            <div className="popover-actions">
              <button className="text-button" type="button" onClick={() => { setEndpointDraft(''); }}>Clear</button>
              <button className="button button-small button-primary" type="button" onClick={saveEndpoint}>Save endpoint</button>
            </div>
          </section>
        )}
      </header>

      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">DEVELOPER TOOLKIT <span className="eyebrow-rule" /></div>
            <h1>Format <span>Studio</span></h1>
          </div>
          <div className="format-count"><span>04</span> FORMATS</div>
        </div>

        <nav className="format-tabs" aria-label="Document format">
          {FORMATS.map(({ id, label, icon: Icon }) => (
            <button className={`format-tab ${format === id ? 'active' : ''}`} type="button" key={id} aria-pressed={format === id} onClick={() => selectFormat(id)}>
              <Icon size={16} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
          <span className="tabs-spacer" />
          <button className="subtle-action upload-action" type="button" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={15} /><span>Open file</span>
          </button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,.html,.htm,.xml,.md,.markdown" onChange={loadFile} />
        </nav>

        <section className="editor-grid" aria-label={`${activeFormat.label} formatter`}>
          <article className="editor-panel input-panel">
            <div className="panel-heading">
              <div className="panel-title-group">
                <span className="panel-index">01</span>
                <h2>Input</h2>
                <span className="panel-caption">Paste or write your document</span>
              </div>
              <div className="panel-tools">
                <button className="icon-button" type="button" aria-label="Clear input" title="Clear input" onClick={() => { updateContent(''); setFileName(`untitled.${activeFormat.extension}`); }} disabled={!content}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="document-bar">
              <div className="filename-wrap"><FileJson size={15} /><input aria-label="Document filename" value={fileName} onChange={(event) => setFileName(event.target.value)} /></div>
              <span className="format-chip">{activeFormat.label}</span>
            </div>
            <label className="visually-hidden" htmlFor="document-input">Unformatted {activeFormat.label} content</label>
            <textarea
              id="document-input"
              className="code-input"
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={`Paste your ${activeFormat.label} here...`}
              value={content}
              onChange={(event) => updateContent(event.target.value)}
            />
            <div className="editor-footer">
              <span className={byteCount > MAX_BYTES ? 'size-warning' : ''}>{byteCount.toLocaleString()} bytes <span className="footer-divider">/</span> 1 MiB</span>
              <span>{content.length.toLocaleString()} characters</span>
            </div>
          </article>

          <div className="process-rail" aria-hidden="true"><span><ChevronDown size={17} /></span></div>

          <article className="editor-panel output-panel">
            <div className="panel-heading output-heading">
              <div className="panel-title-group">
                <span className="panel-index">02</span>
                <h2>Result</h2>
                {result && <span className="success-label"><Check size={12} /> Ready</span>}
              </div>
              <div className="panel-tools output-tools">
                <button className="icon-button" type="button" aria-label="Copy result" title="Copy result" onClick={copyOutput} disabled={!result}><Clipboard size={15} /></button>
                <button className="icon-button" type="button" aria-label="Download formatted file" title="Download formatted file" onClick={downloadOutput} disabled={!result}><Download size={15} /></button>
              </div>
            </div>
            <div className="result-bar">
              <div className="view-switch" role="tablist" aria-label="Result view">
                <button className={outputMode === 'preview' ? 'selected' : ''} type="button" role="tab" aria-selected={outputMode === 'preview'} onClick={() => setOutputMode('preview')}><PanelTop size={14} /> Preview</button>
                <button className={outputMode === 'source' ? 'selected' : ''} type="button" role="tab" aria-selected={outputMode === 'source'} onClick={() => setOutputMode('source')}><Code2 size={14} /> Source</button>
              </div>
              <span className="result-type">{outputMode === 'preview' ? 'RENDERED VIEW' : 'FORMATTED SOURCE'}</span>
            </div>
            <div className={`result-content ${outputMode === 'preview' ? 'preview-content' : ''}`}>
              {result ? (
                outputMode === 'preview' ? (
                  <iframe className="preview-frame" title={`${activeFormat.label} rendered preview`} sandbox="" srcDoc={getPreviewDocument(result.previewHtml)} />
                ) : (
                  <pre className="code-output"><code>{result.formattedContent}</code></pre>
                )
              ) : (
                <div className="empty-result">
                  <div className="empty-icon"><Sparkles size={19} /></div>
                  <p>Your formatted document<br />will appear here</p>
                  <span>Ready when you are</span>
                </div>
              )}
              {busy && <div className="loading-overlay"><LoaderCircle size={23} className="spinner" /><span>Processing {activeFormat.label}...</span></div>}
            </div>
            <div className="editor-footer result-footer">
              <span>{result ? `${(result.characterCount ?? 0).toLocaleString()} input characters` : 'Output will appear here'}</span>
              <span className="result-footer-mark">FORMAT STUDIO <span>•</span></span>
            </div>
          </article>
        </section>

        <div className="action-row">
          <div className="feedback" aria-live="polite">
            {error ? <><CircleAlert size={15} /><span>{error}</span></> : notice ? <><Check size={15} /><span>{notice}</span></> : <span className="quiet-feedback">{format === 'html' || format === 'markdown' ? 'Preview is isolated in a sandbox' : 'Source is formatted by the dev-utils API'}</span>}
          </div>
          <button className="button button-primary process-button" type="button" onClick={processDocument} disabled={busy || !content.trim()}>
            {busy ? <LoaderCircle size={16} className="spinner" /> : <Sparkles size={16} />}
            <span>{busy ? 'Formatting...' : 'Format document'}</span>
          </button>
        </div>
        <div className="workspace-bottom"><span>JSON <i /> HTML <i /> XML <i /> MARKDOWN</span><span>LOCAL INPUT <i /> NO FILES STORED</span></div>
      </main>
    </div>
  );
}

export default App;