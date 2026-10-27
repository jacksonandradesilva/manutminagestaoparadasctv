import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { deleteLubrificacaoDefinitiva, fetchLubrificacoes, updateLubrificacao } from './store';
import { formatDateTime } from './utils';

const TURNOS = ['A', 'B', 'C', 'D'];
const TURMAS = ['A', 'B', 'C', 'D', 'E'];

function toTimeInput(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const EMPTY_FILTERS = {
  dataInicio: '',
  dataFim: '',
  painelLavra: '',
  equipamento: ''
};

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getHoras(item) {
  return Math.max(0, (new Date(item.fim) - new Date(item.inicio)) / 3600000);
}

function formatHoras(horas) {
  const minutos = Math.round(horas * 60);
  return `${Math.floor(minutos / 60)}h ${pad2(minutos % 60)}min`;
}

function formatNumero(value) {
  return Number(value).toFixed(1).replace('.', ',');
}

export default function GestaoLubrificacaoPage({ pagePermissions = {} }) {
  const [registros, setRegistros] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  async function carregar() {
    try {
      setRegistros(await fetchLubrificacoes({ incluirOcultos: true }));
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

  function updateEditField(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setEditForm({
      painelLavra: item.painelLavra || '',
      equipamento: item.equipamento || '',
      nomeLubrificador: item.nomeLubrificador || '',
      turno: item.turno || '',
      turma: item.turma || '',
      data: toDateKey(item.inicio),
      horaInicio: toTimeInput(item.inicio),
      horaFim: toTimeInput(item.fim),
      litros: String(item.litros ?? ''),
      tipoOleo: item.tipoOleo || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    const inicio = `${editForm.data}T${editForm.horaInicio}`;
    const fim = `${editForm.data}T${editForm.horaFim}`;

    if (new Date(fim) <= new Date(inicio)) {
      setError('O horario final deve ser posterior ao inicial.');
      return;
    }

    if (!(Number(editForm.litros) > 0)) {
      setError('Informe uma quantidade de litros maior que zero.');
      return;
    }

    setSaving(true);
    try {
      await updateLubrificacao(editingId, { ...editForm, inicio, fim });
      cancelEdit();
      await carregar();
    } catch (err) {
      setError(err?.message || 'Falha ao salvar registro.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir este registro definitivamente?')) {
      return;
    }

    try {
      await deleteLubrificacaoDefinitiva(id);
      if (editingId === id) {
        cancelEdit();
      }
      await carregar();
    } catch (err) {
      setError(err?.message || 'Falha ao excluir registro.');
    }
  }

  function updateFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  const paineis = useMemo(
    () => [...new Set(registros.map((r) => r.painelLavra).filter(Boolean))].sort(),
    [registros]
  );
  const equipamentos = useMemo(
    () => [...new Set(registros.map((r) => r.equipamento).filter(Boolean))].sort(),
    [registros]
  );

  const filtrados = useMemo(() => {
    return registros
      .filter((item) => {
        const dia = toDateKey(item.inicio);

        if (filters.dataInicio && dia < filters.dataInicio) return false;
        if (filters.dataFim && dia > filters.dataFim) return false;
        if (filters.painelLavra && item.painelLavra !== filters.painelLavra) return false;
        if (filters.equipamento && item.equipamento !== filters.equipamento) return false;
        return true;
      })
      .sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  }, [registros, filters]);

  const totais = useMemo(() => {
    const isHidraulico = (item) => String(item.tipoOleo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('hidraul');
    const soma = (lista) => lista.reduce((sum, item) => sum + (Number(item.litros) || 0), 0);
    const hidraulicos = filtrados.filter(isHidraulico);
    const lubrificantes = filtrados.filter((item) => !isHidraulico(item));
    return {
      litros: soma(filtrados),
      hidraulico: soma(hidraulicos),
      lubrificante: soma(lubrificantes),
      horas: filtrados.reduce((sum, item) => sum + getHoras(item), 0)
    };
  }, [filtrados]);

  const resumoEquipamentos = useMemo(() => {
    const map = new Map();
    filtrados.forEach((item) => {
      const key = `${item.painelLavra}||${item.equipamento}`;
      const atual = map.get(key) || { painelLavra: item.painelLavra, equipamento: item.equipamento, registros: 0, litros: 0, horas: 0 };
      atual.registros += 1;
      atual.litros += Number(item.litros) || 0;
      atual.horas += getHoras(item);
      map.set(key, atual);
    });
    return [...map.values()].sort((a, b) => b.litros - a.litros);
  }, [filtrados]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1>Gestao de Lubrificacao</h1>
        </div>
        <img className="page-header-logo" src="/img/logo-header (1).png" alt="Logo" />
      </header>

      <div className="page-actions">
        <NavLink to="/" end className="btn-link">Voltar ao painel</NavLink>
      </div>

      <div className="filter-bar date-filter-bar">
        <div className="form-field">
          <label htmlFor="gl-data-inicio">Data inicio</label>
          <input id="gl-data-inicio" type="date" value={filters.dataInicio} onChange={(e) => updateFilter('dataInicio', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="gl-data-fim">Data fim</label>
          <input id="gl-data-fim" type="date" value={filters.dataFim} onChange={(e) => updateFilter('dataFim', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="gl-painel">Painel de lavra</label>
          <select id="gl-painel" value={filters.painelLavra} onChange={(e) => updateFilter('painelLavra', e.target.value)}>
            <option value="">Todos</option>
            {paineis.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="gl-equip">Equipamento</label>
          <select id="gl-equip" value={filters.equipamento} onChange={(e) => updateFilter('equipamento', e.target.value)}>
            <option value="">Todos</option>
            {equipamentos.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        </div>
        <button className="btn perigo" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>Limpar filtros</button>
      </div>

      {editingId && editForm && (
        <form className="filter-bar date-filter-bar" onSubmit={handleSaveEdit}>
          <div className="form-field">
            <label htmlFor="ge-painel">Painel de lavra</label>
            <input id="ge-painel" type="text" required value={editForm.painelLavra} onChange={(e) => updateEditField('painelLavra', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ge-equip">Equipamento</label>
            <input id="ge-equip" type="text" required value={editForm.equipamento} onChange={(e) => updateEditField('equipamento', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ge-nome">Nome do lubrificador</label>
            <input id="ge-nome" type="text" required value={editForm.nomeLubrificador} onChange={(e) => updateEditField('nomeLubrificador', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ge-turno">Turno</label>
            <select id="ge-turno" required value={editForm.turno} onChange={(e) => updateEditField('turno', e.target.value)}>
              <option value="">Selecione</option>
              {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="ge-turma">Turma</label>
            <select id="ge-turma" required value={editForm.turma} onChange={(e) => updateEditField('turma', e.target.value)}>
              <option value="">Selecione</option>
              {TURMAS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="ge-data">Data</label>
            <input id="ge-data" type="date" required value={editForm.data} onChange={(e) => updateEditField('data', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ge-inicio">Horario inicio</label>
            <input id="ge-inicio" type="time" required value={editForm.horaInicio} onChange={(e) => updateEditField('horaInicio', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ge-fim">Horario fim</label>
            <input id="ge-fim" type="time" required value={editForm.horaFim} onChange={(e) => updateEditField('horaFim', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ge-litros">Quantidade de oleo (litros)</label>
            <input id="ge-litros" type="number" min="0.1" step="0.1" required value={editForm.litros} onChange={(e) => updateEditField('litros', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ge-tipo">Tipo de oleo</label>
            <input id="ge-tipo" type="text" required value={editForm.tipoOleo} onChange={(e) => updateEditField('tipoOleo', e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alteracoes'}</button>
          <button className="btn secundario" type="button" onClick={cancelEdit}>Cancelar edicao</button>
        </form>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="alert alert-info">Carregando registros...</div>}

      <section className="summary-cards">
        <article className="card">
          <span>Registros</span>
          <strong>{filtrados.length}</strong>
        </article>
        <article className="card">
          <span>Total de oleo</span>
          <strong>{formatNumero(totais.litros)} L</strong>
        </article>
        <article className="card">
          <span>Total hidraulico</span>
          <strong>{formatNumero(totais.hidraulico)} L</strong>
        </article>
        <article className="card">
          <span>Total lubrificante</span>
          <strong>{formatNumero(totais.lubrificante)} L</strong>
        </article>
        <article className="card">
          <span>Total de horas</span>
          <strong>{formatHoras(totais.horas)}</strong>
        </article>
      </section>

      <h2>Resumo por painel e equipamento</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Painel de lavra</th>
              <th>Equipamento</th>
              <th>Registros</th>
              <th>Oleo (L)</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            {resumoEquipamentos.length === 0 && !loading && (
              <tr><td colSpan="5">Nenhum registro para os filtros selecionados.</td></tr>
            )}
            {resumoEquipamentos.map((r) => (
              <tr key={`${r.painelLavra}-${r.equipamento}`}>
                <td>{r.painelLavra}</td>
                <td>{r.equipamento}</td>
                <td>{r.registros}</td>
                <td>{formatNumero(r.litros)}</td>
                <td>{formatHoras(r.horas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Registros detalhados</h2>
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
              <th>Horas</th>
              <th>Oleo (L)</th>
              <th>Tipo de oleo</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && !loading && (
              <tr><td colSpan="11">Nenhum registro.</td></tr>
            )}
            {filtrados.map((item) => (
              <tr key={item.id}>
                <td>{item.painelLavra}</td>
                <td>{item.equipamento}</td>
                <td>{item.nomeLubrificador}</td>
                <td>{item.turno}</td>
                <td>{item.turma}</td>
                <td>{formatDateTime(new Date(item.inicio))}</td>
                <td>{formatDateTime(new Date(item.fim))}</td>
                <td>{formatHoras(getHoras(item))}</td>
                <td>{formatNumero(item.litros)}</td>
                <td>{item.tipoOleo}</td>
                <td>
                  <div className="acoes-inline">
                    {pagePermissions['gestao-lubrificacao-editar'] && (
                      <button className="btn editar" type="button" onClick={() => handleEdit(item)}>Editar</button>
                    )}
                    {pagePermissions['gestao-lubrificacao-excluir'] && (
                      <button className="btn excluir" type="button" onClick={() => handleDelete(item.id)}>Excluir</button>
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
