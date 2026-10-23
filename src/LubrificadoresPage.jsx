import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { addLubrificacao, deleteLubrificacao, fetchLubrificacoes } from './store';
import { formatDateTime } from './utils';

const TURNOS =  ['A', 'B', 'C', 'D'];
const TURMAS = ['A', 'B', 'C', 'D', 'E'];
const EMPTY_FORM = {
  painelLavra: '',
  equipamento: '',
  nomeLubrificador: '',
  turno: '',
  turma: '',
  inicio: '',
  fim: '',
  litros: '',
  tipoOleo: ''
};

function formatDuracao(inicio, fim) {
  const minutos = Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / 60000));
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}min`;
}

export default function LubrificadoresPage() {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function carregar() {
    try {
      setRegistros(await fetchLubrificacoes());
      setError('');
    } catch (err) {
      setError(err?.message || 'Falha ao carregar registros.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const totalLitros = useMemo(
    () => registros.reduce((sum, item) => sum + (Number(item.litros) || 0), 0),
    [registros]
  );

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (new Date(form.fim) <= new Date(form.inicio)) {
      setError('O horario final deve ser posterior ao inicial.');
      return;
    }

    if (!(Number(form.litros) > 0)) {
      setError('Informe uma quantidade de litros maior que zero.');
      return;
    }

    setSaving(true);

    try {
      await addLubrificacao(form);
      setForm(EMPTY_FORM);
      await carregar();
    } catch (err) {
      setError(err?.message || 'Falha ao salvar registro.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir este registro?')) {
      return;
    }

    try {
      await deleteLubrificacao(id);
      await carregar();
    } catch (err) {
      setError(err?.message || 'Falha ao excluir registro.');
    }
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1>Controle de Lubrificadores</h1>
        </div>
        <img className="page-header-logo" src="/img/logo-header (1).png" alt="Logo" />
      </header>

      <div className="page-actions">
        <NavLink to="/" end className="btn-link">Voltar ao painel</NavLink>
      </div>

      <form className="filter-bar date-filter-bar" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="lub-painel">Painel de lavra</label>
          <input id="lub-painel" type="text" required value={form.painelLavra} onChange={(e) => updateField('painelLavra', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-equip">Equipamento</label>
          <input id="lub-equip" type="text" required value={form.equipamento} onChange={(e) => updateField('equipamento', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-nome">Nome do lubrificador</label>
          <input id="lub-nome" type="text" required value={form.nomeLubrificador} onChange={(e) => updateField('nomeLubrificador', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-turno">Turno</label>
          <select id="lub-turno" required value={form.turno} onChange={(e) => updateField('turno', e.target.value)}>
            <option value="">Selecione</option>
            {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="lub-turma">Turma</label>
          <select id="lub-turma" required value={form.turma} onChange={(e) => updateField('turma', e.target.value)}>
            <option value="">Selecione</option>
            {TURMAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="lub-inicio">Inicio</label>
          <input id="lub-inicio" type="datetime-local" required value={form.inicio} onChange={(e) => updateField('inicio', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-fim">Fim</label>
          <input id="lub-fim" type="datetime-local" required value={form.fim} onChange={(e) => updateField('fim', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-litros">Quantidade de oleo (litros)</label>
          <input id="lub-litros" type="number" min="0.1" step="0.1" required value={form.litros} onChange={(e) => updateField('litros', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-tipo">Tipo de oleo</label>
          <input id="lub-tipo" type="text" required value={form.tipoOleo} onChange={(e) => updateField('tipoOleo', e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar registro'}</button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="alert alert-info">Carregando registros...</div>}

      <p><strong>Total de oleo:</strong> {totalLitros.toFixed(1).replace('.', ',')} L em {registros.length} registro(s)</p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Painel de lavra</th>
              <th>Equipamento</th>
              <th>Lubrificador</th>
              <th>Turno</th>
              <th>Turma</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>Duracao</th>
              <th>Litros</th>
              <th>Tipo de oleo</th>
              <th>Registrado por</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 && !loading && (
              <tr><td colSpan="12">Nenhum registro.</td></tr>
            )}
            {registros.map((item) => (
              <tr key={item.id}>
                <td>{item.painelLavra}</td>
                <td>{item.equipamento}</td>
                <td>{item.nomeLubrificador}</td>
                <td>{item.turno}</td>
                <td>{item.turma}</td>
                <td>{formatDateTime(item.inicio)}</td>
                <td>{formatDateTime(item.fim)}</td>
                <td>{formatDuracao(item.inicio, item.fim)}</td>
                <td>{String(item.litros).replace('.', ',')}</td>
                <td>{item.tipoOleo}</td>
                <td>{item.createdBy || '-'}</td>
                <td><button className="btn secundario" type="button" onClick={() => handleDelete(item.id)}>Excluir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

