import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { addLubrificacao, fetchLubrificacoes, getState, saveState, writeAuditLog } from './store';

function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const table = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') { quoted = false; }
      else { cell += ch; }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      table.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); table.push(row); }

  const [header = [], ...body] = table.filter((r) => r.some((c) => c !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// Restaura tipos que a exportacao achatou (JSON aninhado, booleanos e numeros).
function restoreValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const v = value.trim();
  if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
    try { return JSON.parse(v); } catch { return value; }
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) return Number(v);
  return value;
}

function restoreRows(rows) {
  return rows
    .map((row) => Object.fromEntries(
      Object.entries(row).filter(([k, v]) => k && v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, restoreValue(v)])
    ))
    .filter((row) => Object.keys(row).length > 0);
}

async function readFileRows(file) {
  if (/\.csv$/i.test(file.name)) {
    return { Arquivo: parseCsv(await file.text()) };
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return Object.fromEntries(wb.SheetNames.map((name) => [name, XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })]));
}

function mergeUnique(current, incoming) {
  const keyOf = (item) => (item && item.id !== undefined ? `id:${item.id}` : JSON.stringify(item));
  const seen = new Set(current.map(keyOf));
  const added = incoming.filter((item) => !seen.has(keyOf(item)));
  return { merged: [...current, ...added], added: added.length };
}

const DATASETS = [
  { key: 'historico', label: 'Historico de paradas' },
  { key: 'equipamentos', label: 'Status dos equipamentos' },
  { key: 'lubrificacoes', label: 'Lubrificacoes' },
  { key: 'relatorioTurnos', label: 'Notas do relatorio de turnos' }
];

function flattenValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function normalizeRows(list) {
  return (Array.isArray(list) ? list : []).map((item) => {
    const row = {};
    Object.entries(item && typeof item === 'object' ? item : { valor: item }).forEach(([k, v]) => {
      row[k] = flattenValue(v);
    });
    return row;
  });
}

function relatorioToRows(notas) {
  return Object.entries(notas && typeof notas === 'object' ? notas : {}).map(([chave, valor]) => ({
    chave,
    valor: flattenValue(valor)
  }));
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getColumns(rows) {
  const cols = [];
  rows.forEach((row) => Object.keys(row).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
  return cols;
}

function toCsv(rows) {
  const cols = getColumns(rows);
  const lines = [cols.map(escapeCsv).join(';')];
  rows.forEach((row) => lines.push(cols.map((c) => escapeCsv(row[c])).join(';')));
  return `\uFEFF${lines.join('\r\n')}`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function ExportacaoDadosPage({ isAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('historico');
  const [importTarget, setImportTarget] = useState('historico');
  const [importMode, setImportMode] = useState('adicionar');
  const [sheets, setSheets] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importErr, setImportErr] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [state, lubs] = await Promise.all([getState(), fetchLubrificacoes({ incluirOcultos: true })]);
      setData({
        historico: normalizeRows(state.historicoParadas),
        equipamentos: normalizeRows(state.equipamentos),
        lubrificacoes: normalizeRows(lubs),
        relatorioTurnos: relatorioToRows(state.relatorioTurnosNotas)
      });
    } catch (err) {
      setError(err.message || 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      load();
    }
  }, [isAdmin]);

  const rows = useMemo(() => (data ? data[selected] : []), [data, selected]);
  const columns = useMemo(() => getColumns(rows), [rows]);

  if (!isAdmin) {
    return (
      <main className="page-shell">
        <p>Acesso restrito ao administrador.</p>
        <NavLink to="/" className="btn secundario">Voltar</NavLink>
      </main>
    );
  }

  function exportCsv() {
    download(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${selected}_${stamp()}.csv`);
    writeAuditLog('exportacao_dados', { formato: 'csv', conjunto: selected, registros: rows.length }).catch(() => {});
  }

  function exportXlsx(all) {
    const wb = XLSX.utils.book_new();
    const sets = all ? DATASETS : DATASETS.filter((d) => d.key === selected);
    sets.forEach((d) => {
      const sheetRows = data[d.key];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), d.label.slice(0, 31));
    });
    XLSX.writeFile(wb, `${all ? 'todos_os_dados' : selected}_${stamp()}.xlsx`);
    writeAuditLog('exportacao_dados', { formato: 'xlsx', conjunto: all ? 'todos' : selected }).catch(() => {});
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    setImportMsg('');
    setImportErr('');
    setSheets(null);
    if (!file) return;
    try {
      const result = await readFileRows(file);
      const names = Object.keys(result);
      setSheets(result);
      setSheetName(names[0] || '');
      setFileName(file.name);
      // Sugere o destino pelo nome da aba/arquivo quando coincide com um conjunto.
      const guess = DATASETS.find((d) => names[0] === d.label.slice(0, 31) || file.name.startsWith(d.key));
      if (guess) setImportTarget(guess.key);
    } catch (err) {
      setImportErr(`Nao foi possivel ler o arquivo: ${err.message || err}`);
    }
  }

  async function runImport() {
    setImportMsg('');
    setImportErr('');
    const incoming = restoreRows(sheets?.[sheetName] || []);
    if (!incoming.length) {
      setImportErr('Nenhum registro encontrado na planilha selecionada.');
      return;
    }
    const label = DATASETS.find((d) => d.key === importTarget).label;
    const replace = importMode === 'substituir' && importTarget !== 'lubrificacoes';
    if (!window.confirm(`${replace ? 'SUBSTITUIR todos os dados de' : 'Adicionar a'} "${label}" com ${incoming.length} registro(s) de ${fileName}?`)) {
      return;
    }

    setImporting(true);
    try {
      let added = incoming.length;
      if (importTarget === 'lubrificacoes') {
        added = 0;
        const invalid = [];
        for (const [i, r] of incoming.entries()) {
          const ok = !Number.isNaN(new Date(r.inicio).getTime()) && !Number.isNaN(new Date(r.fim).getTime()) && Number.isFinite(Number(r.litros));
          if (!ok) { invalid.push(i + 2); continue; }
          await addLubrificacao(r);
          added += 1;
        }
        if (invalid.length) {
          setImportErr(`Linhas ignoradas por data/litros invalidos: ${invalid.slice(0, 20).join(', ')}`);
        }
      } else {
        const state = await getState();
        if (importTarget === 'relatorioTurnos') {
          const notas = Object.fromEntries(incoming.filter((r) => r.chave !== undefined).map((r) => [String(r.chave), r.valor]));
          state.relatorioTurnosNotas = replace ? notas : { ...state.relatorioTurnosNotas, ...notas };
          added = Object.keys(notas).length;
        } else {
          const field = importTarget === 'historico' ? 'historicoParadas' : 'equipamentos';
          if (replace) {
            state[field] = incoming;
          } else {
            const res = mergeUnique(state[field] || [], incoming);
            state[field] = res.merged;
            added = res.added;
          }
        }
        await saveState(state);
      }
      await writeAuditLog('importacao_dados', { conjunto: importTarget, modo: replace ? 'substituir' : 'adicionar', registros: added }).catch(() => {});
      setImportMsg(`Importacao concluida: ${added} registro(s) em "${label}".`);
      setSheets(null);
      await load();
    } catch (err) {
      setImportErr(`Falha na importacao: ${err.message || err}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="page-shell">
      <h1>Exportacao e Importacao de Dados</h1>
      <NavLink to="/" className="btn secundario">Voltar</NavLink>

      {error && <p className="erro">{error}</p>}

      <div className="filtros" style={{ margin: '16px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {DATASETS.map((d) => (
            <option key={d.key} value={d.key}>{d.label}{data ? ` (${data[d.key].length})` : ''}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={exportCsv} disabled={loading || !rows.length}>Exportar CSV</button>
        <button type="button" className="btn" onClick={() => exportXlsx(false)} disabled={loading || !rows.length}>Exportar Excel</button>
        <button type="button" className="btn" onClick={() => exportXlsx(true)} disabled={loading || !data}>Exportar tudo (Excel)</button>
        <button type="button" className="btn secundario" onClick={load} disabled={loading}>Recarregar</button>
      </div>

      {loading ? <p>Carregando...</p> : (
        <>
          <p>{rows.length} registro(s). Pre-visualizacao dos primeiros 50:</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ marginTop: 32 }}>Importar dados</h2>
      <p>Aceita arquivos .csv ou .xlsx no mesmo formato da exportacao (primeira linha com os nomes das colunas).</p>
      {importMsg && <p>{importMsg}</p>}
      {importErr && <p className="erro">{importErr}</p>}
      <div className="filtros" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} disabled={importing} />
        {sheets && Object.keys(sheets).length > 1 && (
          <select value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
            {Object.keys(sheets).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <select value={importTarget} onChange={(e) => setImportTarget(e.target.value)} disabled={importing}>
          {DATASETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <select value={importMode} onChange={(e) => setImportMode(e.target.value)} disabled={importing || importTarget === 'lubrificacoes'}>
          <option value="adicionar">Adicionar (ignora duplicados)</option>
          <option value="substituir">Substituir tudo</option>
        </select>
        <button
          type="button"
          className="btn"
          style={{ backgroundColor: '#facc15', borderColor: '#facc15', color: '#1f2937', opacity: !sheets || importing ? 0.6 : 1 }}
          onClick={runImport}
          disabled={!sheets || importing}
        >
          {importing ? 'Importando...' : 'Importar'}
        </button>
      </div>
      {importTarget === 'lubrificacoes' && (
        <p>Lubrificacoes sao sempre adicionadas como novos registros (colunas: inicio, fim, litros, tipoOleo, painelLavra, equipamento, nomeLubrificador, turno, turma).</p>
      )}
    </main>
  );
}

export default ExportacaoDadosPage;
