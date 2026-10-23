import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { addLubrificacao, deleteLubrificacao, fetchLubrificacoes, updateLubrificacao } from './store';
import { formatDateTime } from './utils';

const TURNOS =  ['A', 'B', 'C', 'D'];
const TURMAS = ['A', 'B', 'C', 'D', 'E'];
const EMPTY_FORM = {
  painelLavra: '',
  equipamento: '',
  nomeLubrificador: '',
  turno: '',
  turma: '',
  data: '',
  horaInicio: '',
  horaFim: '',
  litros: '',
  tipoOleo: ''
};

function formatDuracao(inicio, fim) {
  const minutos = Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / 60000));
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}min`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateInput(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInput(iso) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function LubrificadoresPage({ pagePermissions = {} }) {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
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

    const inicio = `${form.data}T${form.horaInicio}`;
    const fim = `${form.data}T${form.horaFim}`;

    if (new Date(fim) <= new Date(inicio)) {
      setError('O horario final deve ser posterior ao inicial.');
      return;
    }

    if (!(Number(form.litros) > 0)) {
      setError('Informe uma quantidade de litros maior que zero.');
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        await updateLubrificacao(editingId, { ...form, inicio, fim });
      } else {
        await addLubrificacao({ ...form, inicio, fim });
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError('');
      await carregar();
    } catch (err) {
      setError(err?.message || 'Falha ao salvar registro.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    if (!pagePermissions['lubrificadores-editar']) {
      return;
    }

    setEditingId(item.id);
    setForm({
      painelLavra: item.painelLavra || '',
      equipamento: item.equipamento || '',
      nomeLubrificador: item.nomeLubrificador || '',
      turno: item.turno || '',
      turma: item.turma || '',
      data: toDateInput(item.inicio),
      horaInicio: toTimeInput(item.inicio),
      horaFim: toTimeInput(item.fim),
      litros: String(item.litros ?? ''),
      tipoOleo: item.tipoOleo || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleDelete(id) {
    if (!pagePermissions['lubrificadores-excluir']) {
      return;
    }

    if (!window.confirm('Excluir este registro?')) {
      return;
    }

    try {
      await deleteLubrificacao(id);
      if (editingId === id) {
        cancelEdit();
      }
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
          <label htmlFor="lub-data">Data</label>
          <input id="lub-data" type="date" required value={form.data} onChange={(e) => updateField('data', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-inicio">Horario inicio</label>
          <input id="lub-inicio" type="time" required value={form.horaInicio} onChange={(e) => updateField('horaInicio', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-fim">Horario fim</label>
          <input id="lub-fim" type="time" required value={form.horaFim} onChange={(e) => updateField('horaFim', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-litros">Quantidade de oleo (litros)</label>
          <input id="lub-litros" type="number" min="0.1" step="0.1" required value={form.litros} onChange={(e) => updateField('litros', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="lub-tipo">Tipo de oleo</label>
          <input id="lub-tipo" type="text" required value={form.tipoOleo} onChange={(e) => updateField('tipoOleo', e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Salvando...' : (editingId ? 'Salvar alteracoes' : 'Salvar registro')}</button>
        {editingId && <button className="btn secundario" type="button" onClick={cancelEdit}>Cancelar edicao</button>}
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
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 && !loading && (
              <tr><td colSpan="11">Nenhum registro.</td></tr>
            )}
            {registros.map((item) => (
              <tr key={item.id}>
                <td>{item.painelLavra}</td>
                <td>{item.equipamento}</td>
                <td>{item.nomeLubrificador}</td>
                <td>{item.turno}</td>
                <td>{item.turma}</td>
                <td>{formatDateTime(new Date(item.inicio))}</td>
                <td>{formatDateTime(new Date(item.fim))}</td>
                <td>{formatDuracao(item.inicio, item.fim)}</td>
                <td>{String(item.litros).replace('.', ',')}</td>
                <td>{item.tipoOleo}</td>
                <td>
                  <div className="acoes-inline">
                    {pagePermissions['lubrificadores-editar'] && (
                      <button className="btn editar" type="button" onClick={() => handleEdit(item)}>Editar</button>
                    )}
                    {pagePermissions['lubrificadores-excluir'] && (
                      <button className="btn secundario" type="button" onClick={() => handleDelete(item.id)}>Excluir</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
